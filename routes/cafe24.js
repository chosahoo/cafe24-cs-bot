const express = require('express');
const router = express.Router();
const cafe24Service = require('../services/cafe24Service');
const aiService = require('../services/aiService');
const db = require('../config/database');

// OAuth 콜백 처리
router.get('/callback', async (req, res) => {
  try {
    console.log('OAuth 콜백 수신 - 전체 쿼리:', req.query);
    
    const { code, state } = req.query; // state는 mall_id
    
    if (!code) {
      console.error('인증 코드 없음. 쿼리 파라미터:', req.query);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>인증 오류</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              padding: 2rem;
              background: #f7f7f8;
            }
            .error-box {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              max-width: 600px;
              margin: 0 auto;
            }
            pre {
              background: #f1f3f4;
              padding: 1rem;
              border-radius: 8px;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <div class="error-box">
            <h1>인증 코드가 없습니다</h1>
            <p>받은 파라미터:</p>
            <pre>${JSON.stringify(req.query, null, 2)}</pre>
          </div>
        </body>
        </html>
      `);
    }

    console.log('OAuth 콜백 수신:', { code: code.substring(0, 10) + '...', mall_id: state });

    // 액세스 토큰 발급
    const tokenData = await cafe24Service.getAccessToken(code, state);
    
    console.log('액세스 토큰 발급 완료');

    // 데이터베이스에 저장
    await saveAccessToken(state, tokenData);

    // 성공 페이지로 리다이렉트
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>인증 완료</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f7f7f8;
          }
          .success-box {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            font-size: 4rem;
            color: #10a37f;
            margin-bottom: 1rem;
          }
          h1 {
            color: #1a1a1a;
            margin-bottom: 1rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 2rem;
          }
          .btn {
            background: #10a37f;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
          }
          .btn:hover {
            background: #0d8c6d;
          }
        </style>
      </head>
      <body>
        <div class="success-box">
          <div class="success-icon">✓</div>
          <h1>인증 완료!</h1>
          <p>카페24 ${state} 쇼핑몰과 성공적으로 연결되었습니다.<br>이제 CS Bot을 사용할 수 있습니다.</p>
          <a href="/" class="btn">대시보드로 이동</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('OAuth 콜백 처리 오류:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>인증 실패</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f7f7f8;
          }
          .error-box {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            font-size: 4rem;
            color: #ef4444;
            margin-bottom: 1rem;
          }
          h1 {
            color: #1a1a1a;
            margin-bottom: 1rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 0.5rem;
          }
          .error-message {
            color: #ef4444;
            font-size: 0.875rem;
            background: #fee;
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="error-box">
          <div class="error-icon">✗</div>
          <h1>인증 실패</h1>
          <p>카페24 인증 중 오류가 발생했습니다.</p>
          <div class="error-message">${error.message}</div>
        </div>
      </body>
      </html>
    `);
  }
});

// 액세스 토큰 저장 함수
function saveAccessToken(mallId, tokenData) {
  return new Promise((resolve, reject) => {
    // 먼저 기존 레코드가 있는지 확인
    db.get('SELECT id FROM install_settings WHERE mall_id = ?', [mallId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row) {
        // 기존 레코드 업데이트
        db.run(
          `UPDATE install_settings 
           SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
           WHERE mall_id = ?`,
          [tokenData.access_token, tokenData.refresh_token || null, tokenData.expires_at || null, mallId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      } else {
        // 새 레코드 삽입
        db.run(
          `INSERT INTO install_settings 
           (mall_id, access_token, refresh_token, expires_at, client_id, client_secret) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            mallId, 
            tokenData.access_token, 
            tokenData.refresh_token || null, 
            tokenData.expires_at || null,
            process.env.CAFE24_CLIENT_ID,
            process.env.CAFE24_CLIENT_SECRET
          ],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      }
    });
  });
}

// 카페24 OAuth 인증
router.post('/auth', async (req, res) => {
  try {
    const { authorizationCode } = req.body;
    const accessToken = await cafe24Service.getAccessToken(authorizationCode);
    res.json({ success: true, accessToken });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '인증에 실패했습니다.',
      message: error.message 
    });
  }
});

// 게시판 목록 조회
router.get('/boards', async (req, res) => {
  try {
    const boards = await cafe24Service.getBoardList();
    console.log('게시판 API 응답:', JSON.stringify(boards, null, 2));
    
    // 프론트엔드에 맞게 데이터 변환
    const transformedBoards = boards.boards.map(board => ({
      id: board.board_no,
      name: board.board_name,
      type: board.board_type,
      isActive: board.use_board === 'T',
      isDisplayed: board.use_display === 'T',
      guide: board.board_guide
    }));
    
    res.json({ success: true, data: transformedBoards });
  } catch (error) {
    console.error('게시판 조회 오류:', error);
    res.status(400).json({ 
      success: false, 
      error: '게시판 목록 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 게시판의 개별 게시글 조회
router.get('/boards/:boardId/posts/:postId', async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    const post = await cafe24Service.getPost(boardId, postId);
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('게시글 조회 오류:', error);
    res.status(400).json({ 
      success: false, 
      error: '게시글 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 게시판의 게시글 목록 조회
router.get('/boards/:boardId/posts', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const posts = await cafe24Service.getPosts(boardId, page, limit);
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '게시글 목록 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 게시글 상세 조회
router.get('/boards/:boardId/posts/:postId', async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    const post = await cafe24Service.getPost(boardId, postId);
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '게시글 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 미답변 게시글 조회
router.get('/boards/:boardId/unanswered', async (req, res) => {
  try {
    const { boardId } = req.params;
    
    // 설정에서 제목 필터와 답변 제목 필터 가져오기
    const db = require('../config/database');
    const titleFilter = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['cs_title_filter'], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
    
    const answerTitleFilter = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['cs_answer_title'], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
    
    console.log('미답변 게시글 필터링 전:', boardId);
    console.log('제목 필터:', titleFilter);
    console.log('답변 제목 필터:', answerTitleFilter);
    
    // 설정값이 없으면 경고 메시지
    if (!titleFilter) {
      console.warn('⚠️ 고객 문의 제목 필터가 설정되지 않았습니다!');
    }
    if (!answerTitleFilter) {
      console.warn('⚠️ 답변 제목 필터가 설정되지 않았습니다!');
    }
    
    const unansweredPosts = await cafe24Service.getUnansweredPosts(boardId, titleFilter, answerTitleFilter);
    res.json({ success: true, data: unansweredPosts });
  } catch (error) {
    console.error('미답변 게시글 조회 오류:', error);
    res.status(400).json({ 
      success: false, 
      error: '미답변 게시글 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 게시판 통계 조회 (대시보드용)
router.get('/boards/:boardId/stats', async (req, res) => {
  try {
    const { boardId } = req.params;
    
    // 설정에서 제목 필터와 답변 제목 필터 가져오기
    const db = require('../config/database');
    const titleFilter = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['cs_title_filter'], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
    
    const answerTitleFilter = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['cs_answer_title'], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
    
    const stats = await cafe24Service.getBoardStats(boardId, titleFilter, answerTitleFilter);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('게시판 통계 조회 오류:', error);
    res.status(400).json({ 
      success: false, 
      error: '게시판 통계 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 게시글에 답글 작성
router.post('/boards/:boardId/posts/:postId/replies', async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: '답글 내용을 입력해주세요.' 
      });
    }

    const result = await cafe24Service.createReply(boardId, postId, content);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답글 작성에 실패했습니다.',
      message: error.message 
    });
  }
});

// 게시글 모니터링 (새로운 게시글 감지)
router.get('/boards/:boardId/monitor', async (req, res) => {
  try {
    const { boardId } = req.params;
    const newPosts = await cafe24Service.monitorNewPosts(boardId);
    res.json({ success: true, data: newPosts });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '게시글 모니터링에 실패했습니다.',
      message: error.message 
    });
  }
});

// 자동 답변 처리
router.post('/boards/:boardId/posts/:postId/auto-reply', async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    
    // 게시글 정보 조회
    const post = await cafe24Service.getPost(boardId, postId);
    
    // AI 답변 생성
    const question = `${post.title}\n\n${post.content}`;
    const suggestedAnswer = await aiService.generateAnswer(question);
    
    // 답변 로그 저장
    const logId = await aiService.saveAnswerLog(
      postId, 
      question, 
      suggestedAnswer, 
      'auto'
    );

    // 자동 답변 게시
    const replyResult = await cafe24Service.createReply(boardId, postId, suggestedAnswer);
    
    // 로그 업데이트
    await aiService.updateAnswerLog(logId, suggestedAnswer, 'posted');
    
    // 모니터링 상태 업데이트
    await cafe24Service.updateMonitoredPostStatus(postId, 'answered');

    res.json({ 
      success: true, 
      data: {
        reply: replyResult,
        logId: logId,
        answer: suggestedAnswer
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '자동 답변 처리에 실패했습니다.',
      message: error.message 
    });
  }
});

// 반자동 답변 생성 (답변 제안만)
router.post('/boards/:boardId/posts/:postId/suggest-reply', async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    
    // 게시글 정보 조회
    const post = await cafe24Service.getPost(boardId, postId);
    
    // AI 답변 생성
    const question = `${post.title}\n\n${post.content}`;
    const suggestedAnswer = await aiService.generateAnswer(question);
    
    // 답변 로그 저장 (승인 대기 상태)
    const logId = await aiService.saveAnswerLog(
      postId, 
      question, 
      suggestedAnswer, 
      'semi-auto',
      'pending'
    );

    res.json({ 
      success: true, 
      data: {
        logId: logId,
        suggestedAnswer: suggestedAnswer,
        post: {
          id: postId,
          title: post.title,
          content: post.content
        }
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 제안 생성에 실패했습니다.',
      message: error.message 
    });
  }
});

// 제안된 답변 승인 및 게시
router.post('/answers/:logId/approve', async (req, res) => {
  try {
    const { logId } = req.params;
    const { boardId, postId, customAnswer } = req.body;
    
    // 답변 로그 조회
    const log = await aiService.getAnswerLog(logId);
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        error: '답변 로그를 찾을 수 없습니다.' 
      });
    }

    // 최종 답변 결정 (사용자 수정 답변이 있으면 사용, 없으면 제안된 답변 사용)
    const finalAnswer = customAnswer || log.suggested_answer;
    
    // 답변 게시
    const replyResult = await cafe24Service.createReply(boardId, postId, finalAnswer);
    
    // 로그 업데이트
    await aiService.updateAnswerLog(logId, finalAnswer, 'posted');
    
    // 모니터링 상태 업데이트
    await cafe24Service.updateMonitoredPostStatus(postId, 'answered');

    res.json({ 
      success: true, 
      data: {
        reply: replyResult,
        logId: logId,
        answer: finalAnswer
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 승인 및 게시에 실패했습니다.',
      message: error.message 
    });
  }
});

// 제안된 답변 거부
router.post('/answers/:logId/reject', async (req, res) => {
  try {
    const { logId } = req.params;
    
    // 답변 로그 조회
    const log = await aiService.getAnswerLog(logId);
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        error: '답변 로그를 찾을 수 없습니다.' 
      });
    }

    // 로그 상태를 거부로 업데이트
    await aiService.updateAnswerLog(logId, null, 'rejected');

    res.json({ 
      success: true, 
      message: '답변이 거부되었습니다.'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 거부 처리에 실패했습니다.',
      message: error.message 
    });
  }
});

module.exports = router;
