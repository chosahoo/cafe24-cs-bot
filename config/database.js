const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/cs_bot.db';

// 데이터 디렉토리 생성
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('데이터베이스 연결 오류:', err.message);
  } else {
    console.log('✅ SQLite 데이터베이스에 연결되었습니다.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // 설정 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 매뉴얼 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS manuals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 답변 기록 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS answer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      suggested_answer TEXT,
      final_answer TEXT,
      answer_mode TEXT NOT NULL, -- auto, semi-auto, manual
      status TEXT NOT NULL, -- pending, approved, rejected, posted
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 게시글 모니터링 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS monitored_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER UNIQUE NOT NULL,
      title TEXT,
      content TEXT,
      status TEXT DEFAULT 'new', -- new, processing, answered
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 설치 설정 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS install_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mall_id TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at DATETIME,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ 데이터베이스 테이블이 초기화되었습니다.');
}

module.exports = db;
