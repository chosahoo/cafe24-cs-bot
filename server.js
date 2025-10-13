const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy 설정 (ngrok 사용 시 필요)
app.set('trust proxy', true);

// 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // 최대 100 요청
});
app.use('/api/', limiter);

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 라우트 설정
app.use('/api/cafe24', require('./routes/cafe24'));
app.use('/api/manual', require('./routes/manual'));
app.use('/api/answers', require('./routes/answers'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/install', require('./routes/install'));
app.use('/cafe24/install', require('./routes/install')); // OAuth 시작 URL
app.use('/auth', require('./routes/cafe24')); // OAuth 콜백 URL

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

app.listen(PORT, () => {
  console.log(`🚀 카페24 CS 봇 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📱 앱스토어 등록용 URL: http://localhost:${PORT}`);
});

module.exports = app;
