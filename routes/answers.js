const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// 답변 로그 목록 조회
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const logs = await aiService.getAnswerLogs(page, limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 로그 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 답변 로그 조회
router.get('/logs/:logId', async (req, res) => {
  try {
    const { logId } = req.params;
    const log = await aiService.getAnswerLog(logId);
    
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        error: '답변 로그를 찾을 수 없습니다.' 
      });
    }
    
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 로그 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 답변 품질 검증
router.post('/validate', async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: '질문과 답변을 모두 입력해주세요.' 
      });
    }

    const validation = await aiService.validateAnswer(question, answer);
    res.json({ success: true, data: { validation } });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 검증에 실패했습니다.',
      message: error.message 
    });
  }
});

// 답변 통계 조회
router.get('/stats', async (req, res) => {
  try {
    const db = require('../config/database');
    
    // 전체 답변 수
    const totalAnswers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM answer_logs', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // 자동 답변 수
    const autoAnswers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM answer_logs WHERE answer_mode = "auto"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // 반자동 답변 수
    const semiAutoAnswers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM answer_logs WHERE answer_mode = "semi-auto"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // 승인된 답변 수
    const approvedAnswers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM answer_logs WHERE status = "posted"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // 거부된 답변 수
    const rejectedAnswers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM answer_logs WHERE status = "rejected"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // 최근 7일 답변 현황
    const weeklyStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          answer_mode,
          status
        FROM answer_logs 
        WHERE created_at >= date('now', '-7 days')
        GROUP BY DATE(created_at), answer_mode, status
        ORDER BY date DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      success: true,
      data: {
        total: totalAnswers,
        auto: autoAnswers,
        semiAuto: semiAutoAnswers,
        approved: approvedAnswers,
        rejected: rejectedAnswers,
        weekly: weeklyStats
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '답변 통계 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

module.exports = router;
