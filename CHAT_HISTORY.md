# Cafe24 CS Bot 개발 대화 히스토리

## 프로젝트 개요
- **목적**: Cafe24 쇼핑몰의 고객 문의(Q&A)를 AI로 자동 답변하는 봇
- **기술 스택**: Node.js, Express, SQLite, OpenAI GPT-4, Cafe24 API
- **개발 환경**: WSL (Ubuntu 24.04), ngrok

---

## 주요 구현 사항

### 1. 초기 셋업 및 환경 구성
- **문제**: WSL 환경 설정, Docker 설정
- **해결**: 
  - WSL Ubuntu 24.04 사용
  - Node.js로 직접 실행 (Docker 대신)
  - ngrok으로 로컬 서버를 외부에 공개

### 2. Cafe24 OAuth 연동
- **문제**: OAuth 인증 흐름 구현
- **해결**:
  - `/cafe24/install?mall_id=luiv` → OAuth 인증 시작
  - `/auth/callback` → 토큰 발급 및 DB 저장
  - `scope`: `mall.read_community,mall.write_community`
  - 토큰을 `install_settings` 테이블에 저장

### 3. UI 리디자인
- **요구사항**: ChatGPT처럼 깔끔한 UI
- **해결**:
  - 모던한 색상 스킴 (민트 그린 계열)
  - 카드 기반 레이아웃
  - 부드러운 애니메이션
  - Bootstrap 모달 대신 커스텀 모달 시스템

### 4. 게시판 연동
- **문제**: Cafe24 API로 게시판/게시글 조회
- **해결**:
  - `GET /api/v2/admin/boards` → 게시판 목록
  - `GET /api/v2/admin/boards/{boardId}/articles` → 게시글 목록
  - `reply_count`로 미답변 글 필터링

### 5. CS 게시판 고정 및 제목 필터링
- **요구사항**: 
  - CS 게시판을 한 번 선택하면 계속 고정
  - 특정 제목("문의해요~")으로 시작하는 글만 필터링
- **해결**:
  - 설정에 `cs_board_id`, `cs_title_filter` 저장
  - 게시글 관리 페이지에서 자동으로 CS 게시판 선택
  - 제목 필터로 고객 문의만 표시

### 6. 대시보드 통계
- **요구사항**: 
  - 총 고객문의: 답변완료/미답변
  - 오늘 고객문의: 답변완료/미답변
- **해결**:
  - `getBoardStats()` 메서드 구현
  - 제목 필터 적용한 통계
  - 오늘 날짜 기준으로 필터링

### 7. 키워드 기반 매뉴얼 시스템
- **요구사항**: 
  - 메모장 형태로 CS 매뉴얼 입력
  - 사이즈표 이미지 업로드
  - GPT가 매뉴얼을 가공하여 답변 생성
- **해결**:
  - 키워드 매뉴얼: 텍스트 형태로 저장
  - 사이즈표: 이미지 파일로 저장
  - AI가 매뉴얼 내용을 기반으로 자연스러운 답변 생성

---

## 데이터베이스 스키마

### settings 테이블
```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME,
  updated_at DATETIME
)
```

주요 설정:
- `cs_board_id`: CS 게시판 ID
- `cs_title_filter`: 고객 문의 제목 필터 (예: "문의해요~")
- `answer_mode`: 답변 모드 (auto/semi-auto/manual)
- `ai_model`: AI 모델 (gpt-4)

### install_settings 테이블
```sql
CREATE TABLE install_settings (
  id INTEGER PRIMARY KEY,
  mall_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at DATETIME,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  installed_at DATETIME,
  updated_at DATETIME
)
```

### manuals 테이블
```sql
CREATE TABLE manuals (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT,           -- 'text', 'file', 'keyword', 'sizechart'
  file_path TEXT,
  size_data TEXT,      -- JSON 형태의 사이즈 데이터
  created_at DATETIME,
  updated_at DATETIME
)
```

---

## API 엔드포인트

### Cafe24 연동
- `GET /cafe24/install?mall_id={mall_id}` - OAuth 인증 시작
- `GET /auth/callback` - OAuth 콜백
- `GET /api/cafe24/boards` - 게시판 목록
- `GET /api/cafe24/boards/:boardId/articles` - 게시글 목록
- `GET /api/cafe24/boards/:boardId/unanswered` - 미답변 게시글
- `GET /api/cafe24/boards/:boardId/stats` - 게시판 통계 (대시보드용)

### 설정
- `GET /api/settings` - 설정 조회
- `POST /api/settings/batch` - 설정 일괄 저장

### 매뉴얼
- `GET /api/manual` - 매뉴얼 목록
- `POST /api/manual/text` - 텍스트 매뉴얼 추가
- `POST /api/manual/upload` - 파일 업로드 (사이즈표 포함)

---

## 주요 이슈 및 해결

### 1. `SQLITE_ERROR: no such column: setting_value`
- **원인**: 컬럼명이 `key`, `value`인데 `setting_key`, `setting_value`로 조회
- **해결**: 올바른 컬럼명 사용

### 2. OAuth 인증 실패 (`invalid_scope`)
- **원인**: Cafe24 개발자센터에서 scope 권한이 활성화되지 않음
- **해결**: 개발자센터에서 `mall.read_community`, `mall.write_community` 활성화

### 3. 게시판 목록이 표시되지 않음
- **원인**: API 응답 구조 불일치 (`board_no` vs `id`, `board_name` vs `name`)
- **해결**: 백엔드에서 데이터 변환 (`transformedBoards`)

### 4. 모달이 열리지 않음
- **원인**: Bootstrap JS 의존성 제거 후 모달 핸들링 코드 미수정
- **해결**: CSS 클래스 기반 모달 시스템 구현 (`show` 클래스 토글)

### 5. `ERR_ERL_PERMISSIVE_TRUST_PROXY`
- **원인**: `trust proxy` 설정으로 인한 rate limit 경고
- **해결**: `app.set('trust proxy', true)` 추가 (ngrok 사용을 위해 필요)

---

## 환경 변수 (.env)

```bash
# Cafe24 API 설정
CAFE24_API_URL=https://api.cafe24.com
CAFE24_CLIENT_ID=GLCvWe3bBKRR51yfeWQSsH
CAFE24_CLIENT_SECRET=FuaplbZVF11qlWulVVTX2B
CAFE24_MALL_ID=luiv

# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# 서버 설정
PORT=3000
NODE_ENV=development
BASE_URL=https://mazie-curricular-janella.ngrok-free.dev
REDIRECT_URI=https://mazie-curricular-janella.ngrok-free.dev/auth/callback

# 데이터베이스 설정
DB_PATH=./data/cs_bot.db

# 보안 설정
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key

# 파일 업로드 설정
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# 답변 모드 설정
DEFAULT_ANSWER_MODE=semi-auto
```

---

## 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp env.example .env
nano .env  # 필요한 값 입력
```

### 3. 서버 실행
```bash
npm start
```

### 4. ngrok으로 외부 노출
```bash
# 새 터미널에서
ngrok http 3000
```

### 5. Cafe24 개발자센터 설정
- Redirect URI: `{ngrok_url}/auth/callback`
- Webhook URL: `{ngrok_url}/api/webhook`
- Scope: `mall.read_community`, `mall.write_community`

### 6. 앱 설치
브라우저에서: `{ngrok_url}/cafe24/install?mall_id=luiv`

---

## 현재 상태

✅ **완료된 기능**
- Cafe24 OAuth 인증
- 게시판/게시글 조회
- CS 게시판 자동 선택 및 고정
- 제목 기반 필터링
- 대시보드 통계 (총/오늘 답변완료/미답변)
- 키워드 매뉴얼 시스템 (UI만 구현, 백엔드 로직 필요)
- 사이즈표 이미지 업로드 (UI만 구현, 백엔드 로직 필요)

⏳ **진행 중/필요한 기능**
- AI 답변 생성 (OpenAI API 연동)
- 실제 답글 작성 (Cafe24 API)
- 웹훅 처리 (새 게시글 알림)
- 자동 답변 모드
- 답변 승인/거부 워크플로우

---

## 테스트 환경

- **Mall ID**: luiv
- **게시판**: Q & A (board_no: 6)
- **고객 문의 제목**: "문의해요~"
- **답변 제목**: "답변드립니다 🙂"

---

## 유용한 명령어

```bash
# WSL 진입
wsl -d Ubuntu-24.04

# 프로젝트 디렉토리로 이동
cd /home/chosahoo/dev/cafe24-cs-bot

# 서버 실행
npm start

# ngrok 실행 (새 터미널)
ngrok http 3000

# 환경 변수 편집
nano .env

# 로그 확인
# 서버 터미널에서 실시간으로 확인 가능
```

---

## 참고 링크

- [Cafe24 API 문서](https://developers.cafe24.com/docs/api/admin)
- [OpenAI API 문서](https://platform.openai.com/docs/api-reference)
- [ngrok 문서](https://ngrok.com/docs)

---

---

## 📅 개발 일지

### 2025-10-13 (오늘 작업)

#### ✅ 완료한 작업 (오후)

1. **게시판 UI 개선**
   - "고객 문의 게시판:" 레이블 추가
   - 게시판 선택 드롭다운을 더 명확하게 표시
   - 선택한 게시판이 다른 메뉴 갔다와도 고정되도록 구현

2. **제목 필터링 시스템 구현**
   - 설정에 "고객 문의 제목" 입력 필드 추가
   - 입력한 제목으로 시작하는 글만 필터링
   - 예: "문의해요~"로 시작하는 글만 CS 문의로 인식
   - DB 컬럼명 오류 수정 (`setting_key` → `key`)

3. **대시보드 통계 재구성**
   - 기존 4개 카드 → 2x2 그리드로 변경
   - **총 고객문의**: 답변 완료 / 미답변
   - **오늘 고객문의**: 답변 완료 / 미답변
   - `getBoardStats()` 메서드 구현
   - 제목 필터 적용한 통계 계산
   - 오늘 날짜 기준 필터링 (한국 시간)

4. **백엔드 API 추가**
   - `GET /api/cafe24/boards/:boardId/stats` 엔드포인트 추가
   - 제목 필터를 설정에서 가져와 자동 적용
   - Cafe24 API 응답 구조에 맞춰 데이터 변환

5. **프론트엔드 로직 개선**
   - `loadDashboard()` 함수 수정하여 통계 API 호출
   - `loadPosts()` 함수에서 설정된 CS 게시판 자동 선택
   - 게시판 선택 상태 유지 (localStorage 대신 설정 DB 사용)

#### 🐛 해결한 버그

1. **SQLITE_ERROR: no such column: setting_value**
   - 원인: 테이블 컬럼명이 `key`, `value`인데 `setting_key`, `setting_value`로 조회
   - 해결: `routes/cafe24.js`에서 올바른 컬럼명으로 수정

2. **게시판 선택이 고정되지 않는 문제**
   - 원인: 페이지 이동 시 선택 상태가 초기화됨
   - 해결: 설정 DB에서 `cs_board_id`를 읽어와 자동 선택

3. **대시보드 통계가 표시되지 않는 문제**
   - 원인: API 엔드포인트가 없었음
   - 해결: `/api/cafe24/boards/:boardId/stats` 엔드포인트 추가

#### 📝 설정 항목 추가

- `cs_board_id`: CS 게시판 ID (예: 6)
- `cs_title_filter`: 고객 문의 제목 필터 (예: "문의해요~")

#### ✅ 완료한 작업 (오후 추가)

1. **OAuth 재연동 버튼 추가**
   - 대시보드에 "Cafe24 재연동" 버튼 추가
   - 테스트 실행 후 쉽게 재인증 가능

2. **게시판 선택 자동 저장**
   - 게시판 선택 시 자동으로 DB에 저장
   - 다른 메뉴 갔다 와도 선택 유지

3. **대시보드 통계 재구성**
   - "총 고객문의" 제거
   - **오늘 고객문의** (답변완료/미답변) - 맨 위 배치
   - **이번주 고객문의** (답변완료/미답변) - 추가
   - 이번주 시작일 = 월요일 기준

4. **답변 제목 설정 추가**
   - 설정에 "답변 제목" 필드 추가 (예: "답변드립니다")
   - 답변 글 인식용 (추후 구현 예정)

5. **게시글 UI 대폭 개선**
   - ✅ **답변 완료된 글은 버튼 숨김** (제안/자동답변 버튼)
   - ✅ 답변 완료 글에 "답변 완료" 배지 표시
   - ✅ 제목/내용 텍스트 안 잘리게 개선 (`word-break: break-word`)
   - ✅ HTML 이스케이프 처리로 XSS 방지
   - ✅ 날짜 한국어 형식으로 표시

6. **답변 제안 기능 개선**
   - 게시글 정보를 API에서 안전하게 가져오기
   - 개별 게시글 조회 API 엔드포인트 추가
   - 파라미터 전달 간소화 (boardId, postId만 전달)

#### 🔄 다음에 할 일

1. **AI 답변 생성 기능**
   - OpenAI API 연동
   - 매뉴얼 기반 답변 생성
   - 키워드 매칭 및 컨텍스트 분석

2. **실제 답글 작성 기능**
   - Cafe24 API로 답글 POST
   - 답변 승인/거부 워크플로우
   - 답변 미리보기 및 수정 기능

3. **매뉴얼 시스템 완성**
   - 키워드 매뉴얼 저장/조회 로직
   - 사이즈표 이미지 업로드 및 OCR
   - GPT가 매뉴얼을 읽고 답변 생성

4. **웹훅 처리**
   - 새 게시글 알림
   - 실시간 답변 요청
   - 자동 답변 모드

#### 💡 배운 점 / 메모

- Cafe24 API는 `reply_count` 필드로 답변 여부 확인 가능
- `reply_count > 0`이면 답변 완료
- 게시글 작성일(`created_date`)은 ISO 8601 형식
- 오늘 날짜 비교 시 시간을 00:00:00으로 설정해야 정확함
- SQLite 컬럼명은 `key`, `value`로 간단하게 유지

#### 📊 현재 통계

- 총 게시글 확인: 103개 (board_no: 6, 제목 필터 미적용)
- 게시판 목록: 13개
- 활성 게시판: Q & A, Notice, 1:1 맞춤상담

---

**마지막 업데이트**: 2025-10-13
**개발자**: chosahoo
**프로젝트 상태**: 진행 중 ✨

---

## 🔄 다음에 대화 이어가는 방법

Cursor를 다시 시작했을 때:

```
저번 대화부터 시작하자

CHAT_HISTORY.md 파일을 먼저 읽어줘.
특히 "개발 일지" 섹션을 확인해서 
마지막으로 뭘 했는지 알려줘.
```

이렇게 말하면 AI가 프로젝트 상황을 파악하고 이어서 작업할 수 있습니다! 😊

