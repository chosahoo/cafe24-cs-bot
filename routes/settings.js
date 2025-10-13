const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 설정 조회
router.get('/', async (req, res) => {
  try {
    db.all('SELECT * FROM settings', (err, rows) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '설정 조회에 실패했습니다.',
          message: err.message 
        });
      }

      // 객체 형태로 변환
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });

      res.json({ success: true, data: settings });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '설정 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 설정 조회
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    db.get('SELECT * FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '설정 조회에 실패했습니다.',
          message: err.message 
        });
      }

      if (!row) {
        return res.status(404).json({ 
          success: false, 
          error: '설정을 찾을 수 없습니다.' 
        });
      }

      res.json({ success: true, data: { key: row.key, value: row.value } });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '설정 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 설정 저장/수정
router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: '키와 값을 모두 입력해주세요.' 
      });
    }

    db.run(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, value],
      function(err) {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            error: '설정 저장에 실패했습니다.',
            message: err.message 
          });
        }

        res.json({ 
          success: true, 
          message: '설정이 성공적으로 저장되었습니다.',
          data: { key, value }
        });
      }
    );
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '설정 저장에 실패했습니다.',
      message: error.message 
    });
  }
});

// 여러 설정 일괄 저장
router.post('/batch', async (req, res) => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '설정 데이터가 올바르지 않습니다.' 
      });
    }

    const promises = Object.entries(settings).map(([key, value]) => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO settings (key, value, updated_at) 
           VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [key, value],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    await Promise.all(promises);

    res.json({ 
      success: true, 
      message: '모든 설정이 성공적으로 저장되었습니다.',
      data: settings
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '설정 일괄 저장에 실패했습니다.',
      message: error.message 
    });
  }
});

// 설정 삭제
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    db.run('DELETE FROM settings WHERE key = ?', [key], function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '설정 삭제에 실패했습니다.',
          message: err.message 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: '설정을 찾을 수 없습니다.' 
        });
      }

      res.json({ 
        success: true, 
        message: '설정이 성공적으로 삭제되었습니다.'
      });
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '설정 삭제에 실패했습니다.',
      message: error.message 
    });
  }
});

// 기본 설정 초기화
router.post('/reset', async (req, res) => {
  try {
    const defaultSettings = {
      'answer_mode': 'semi-auto',
      'auto_reply_enabled': 'false',
      'monitoring_enabled': 'true',
      'notification_enabled': 'true',
      'max_answer_length': '500',
      'ai_temperature': '0.7',
      'ai_model': 'gpt-4'
    };

    const promises = Object.entries(defaultSettings).map(([key, value]) => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO settings (key, value, updated_at) 
           VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [key, value],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    await Promise.all(promises);

    res.json({ 
      success: true, 
      message: '기본 설정으로 초기화되었습니다.',
      data: defaultSettings
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '설정 초기화에 실패했습니다.',
      message: error.message 
    });
  }
});

module.exports = router;
