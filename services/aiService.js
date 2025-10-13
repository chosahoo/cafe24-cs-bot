const OpenAI = require('openai');
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
  }

  // 매뉴얼 데이터를 벡터화하여 컨텍스트로 사용
  async getManualContext() {
    try {
      const manuals = await this.getAllManuals();
      return manuals.map(manual => ({
        title: manual.title,
        content: manual.content
      }));
    } catch (error) {
      console.error('매뉴얼 컨텍스트 조회 오류:', error);
      return [];
    }
  }

  // 모든 매뉴얼 조회
  getAllManuals() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM manuals ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // 고객 문의에 대한 답변 생성
  async generateAnswer(question, context = '') {
    try {
      // context가 이미 제공된 경우 (키워드 매뉴얼 등) 해당 context 사용
      // 없으면 전체 매뉴얼 context 사용
      let systemPrompt;
      
      if (context && context.includes('답변 템플릿')) {
        // 프론트엔드에서 전달한 키워드 기반 프롬프트 사용
        systemPrompt = `당신은 카페24 쇼핑몰 '페흐도도'의 전문 CS 담당자입니다.
고객의 문의에 대해 친절하고 자연스러운 답변을 제공해야 합니다.`;
        
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context }
          ],
          max_tokens: 500,
          temperature: 0.8
        });
        
        return completion.choices[0].message.content.trim();
      } else {
        // 기존 방식: 전체 매뉴얼 기반
        const manualContext = await this.getManualContext();
        
        systemPrompt = `당신은 카페24 쇼핑몰 '페흐도도'의 전문 CS 담당자입니다. 
고객의 문의에 대해 친절하고 정확한 답변을 제공해야 합니다.

다음은 고객 대응 매뉴얼입니다:
${manualContext.map(manual => `
제목: ${manual.title}
내용: ${manual.content}
`).join('\n')}

답변 작성 시 다음 사항을 준수해주세요:
1. 고객에게 친절하고 정중한 어조 사용
2. 매뉴얼의 톤앤매너를 참고하되, 고객 질문에 맞게 자연스럽게 작성
3. 구체적이고 실용적인 해결 방법 제시
4. 필요시 단계별 안내 제공
5. 답변이 불가능한 경우 담당자 연결 안내
6. 한국어로 답변 작성

답변은 간결하면서도 충분한 정보를 제공하도록 작성해주세요.`;

        const userPrompt = `고객 문의: ${question}
${context ? `추가 정보: ${context}` : ''}

위 문의에 대한 전문적이고 친절한 답변을 매뉴얼의 스타일을 참고하여 자연스럽게 작성해주세요.`;

        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          temperature: 0.8
        });

        return completion.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('AI 답변 생성 오류:', error);
      throw new Error('답변 생성 중 오류가 발생했습니다.');
    }
  }

  // 답변 품질 검증
  async validateAnswer(question, answer) {
    try {
      const validationPrompt = `다음 고객 문의와 생성된 답변을 검토해주세요:

고객 문의: ${question}
생성된 답변: ${answer}

다음 기준으로 평가해주세요 (각각 1-5점):
1. 적절성: 문의 내용에 적절히 답변했는가?
2. 친절성: 고객에게 친절하고 정중한가?
3. 정확성: 정보가 정확하고 유용한가?
4. 완성도: 답변이 완전하고 구체적인가?

총점과 개선 사항을 제시해주세요.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'user', content: validationPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('답변 검증 오류:', error);
      return '검증 중 오류가 발생했습니다.';
    }
  }

  // 답변 기록 저장
  saveAnswerLog(postId, question, suggestedAnswer, answerMode, status = 'pending') {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO answer_logs (post_id, question, suggested_answer, answer_mode, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [postId, question, suggestedAnswer, answerMode, status],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // 답변 로그 업데이트
  updateAnswerLog(logId, finalAnswer, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE answer_logs 
         SET final_answer = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [finalAnswer, status, logId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // 답변 로그 조회
  getAnswerLogs(page = 1, limit = 20) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      db.all(
        `SELECT * FROM answer_logs 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // 특정 답변 로그 조회
  getAnswerLog(logId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM answer_logs WHERE id = ?',
        [logId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

module.exports = new AIService();
