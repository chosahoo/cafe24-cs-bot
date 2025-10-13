const express = require('express');
const router = express.Router();
const cafe24Service = require('../services/cafe24Service');
const db = require('../config/database');

// OAuth 인증 시작 (앱 설치 URL)
router.get('/', async (req, res) => {
  try {
    const { mall_id } = req.query;
    
    if (!mall_id) {
      return res.status(400).json({
        success: false,
        error: 'mall_id가 필요합니다.'
      });
    }

    console.log('OAuth 인증 시작:', mall_id);

    const clientId = process.env.CAFE24_CLIENT_ID;
    const redirectUri = process.env.REDIRECT_URI || `${process.env.BASE_URL}/auth/callback`;
    // 카페24 게시판(Community) 권한
    const scope = 'mall.read_community,mall.write_community';

    // 카페24 OAuth 인증 URL 생성
    const authUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${mall_id}`;

    console.log('=== OAuth 인증 시작 ===');
    console.log('Mall ID:', mall_id);
    console.log('Client ID:', clientId);
    console.log('Redirect URI:', redirectUri);
    console.log('OAuth URL:', authUrl);
    console.log('======================');

    // 카페24 인증 페이지로 리다이렉트
    res.redirect(authUrl);

  } catch (error) {
    console.error('OAuth 인증 시작 오류:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth 인증 시작에 실패했습니다.',
      message: error.message
    });
  }
});

// 앱 설치 처리 (카페24에서 호출)
router.post('/', async (req, res) => {
  try {
    const { 
      mall_id, 
      access_token, 
      refresh_token, 
      expires_at,
      client_id,
      client_secret 
    } = req.body;

    console.log('앱 설치 요청:', { mall_id, client_id });

    // 액세스 토큰 저장
    cafe24Service.accessToken = access_token;
    
    // 설정 저장
    await saveInstallSettings({
      mall_id,
      access_token,
      refresh_token,
      expires_at,
      client_id,
      client_secret,
      installed_at: new Date().toISOString()
    });

    // 기본 설정 초기화
    await initializeDefaultSettings();

    // 웹훅 등록 (선택사항)
    await registerWebhooks(mall_id, access_token);

    // 설치 완료 로그
    console.log('앱 설치 완료:', mall_id);

    res.json({
      success: true,
      message: '앱이 성공적으로 설치되었습니다.',
      redirect_url: process.env.BASE_URL || 'http://localhost:3000'
    });

  } catch (error) {
    console.error('앱 설치 오류:', error);
    res.status(500).json({
      success: false,
      error: '앱 설치에 실패했습니다.',
      message: error.message
    });
  }
});

// 앱 제거 처리
router.delete('/', async (req, res) => {
  try {
    const { mall_id } = req.body;

    console.log('앱 제거 요청:', mall_id);

    // 설정 삭제
    await removeInstallSettings(mall_id);

    // 모니터링 중인 게시글 정리
    await cleanupMonitoredPosts();

    // 설치 제거 로그
    console.log('앱 제거 완료:', mall_id);

    res.json({
      success: true,
      message: '앱이 성공적으로 제거되었습니다.'
    });

  } catch (error) {
    console.error('앱 제거 오류:', error);
    res.status(500).json({
      success: false,
      error: '앱 제거에 실패했습니다.',
      message: error.message
    });
  }
});

// 설치 상태 확인
router.get('/status', async (req, res) => {
  try {
    const { mall_id } = req.query;

    const settings = await getInstallSettings(mall_id);
    
    if (settings) {
      res.json({
        success: true,
        installed: true,
        installed_at: settings.installed_at,
        mall_id: settings.mall_id
      });
    } else {
      res.json({
        success: true,
        installed: false
      });
    }

  } catch (error) {
    console.error('설치 상태 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: '설치 상태 확인에 실패했습니다.',
      message: error.message
    });
  }
});

// 설치 설정 저장
async function saveInstallSettings(settings) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO install_settings 
      (mall_id, access_token, refresh_token, expires_at, client_id, client_secret, installed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      settings.mall_id,
      settings.access_token,
      settings.refresh_token,
      settings.expires_at,
      settings.client_id,
      settings.client_secret,
      settings.installed_at
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
    
    stmt.finalize();
  });
}

// 설치 설정 조회
async function getInstallSettings(mallId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM install_settings WHERE mall_id = ?',
      [mallId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// 설치 설정 삭제
async function removeInstallSettings(mallId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM install_settings WHERE mall_id = ?',
      [mallId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// 기본 설정 초기화
async function initializeDefaultSettings() {
  const defaultSettings = {
    'answer_mode': 'semi-auto',
    'auto_reply_enabled': 'false',
    'monitoring_enabled': 'true',
    'notification_enabled': 'true',
    'max_answer_length': '500',
    'ai_temperature': '0.7',
    'ai_model': 'gpt-4',
    'email_notification': 'false',
    'slack_webhook_url': ''
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
  console.log('기본 설정 초기화 완료');
}

// 웹훅 등록
async function registerWebhooks(mallId, accessToken) {
  try {
    // 웹훅 등록 로직 구현
    console.log('웹훅 등록:', mallId);
    // 실제 구현에서는 카페24 API를 통해 웹훅을 등록
  } catch (error) {
    console.error('웹훅 등록 오류:', error);
    // 웹훅 등록 실패는 치명적이지 않으므로 계속 진행
  }
}

// 모니터링 게시글 정리
async function cleanupMonitoredPosts() {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM monitored_posts WHERE status = "new"',
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

module.exports = router;
