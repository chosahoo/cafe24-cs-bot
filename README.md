# 카페24 CS 자동답변 봇

AI를 활용한 카페24 고객 문의 자동 답변 시스템입니다.

## 주요 기능

### 🤖 자동 답변 시스템
- **자동 모드**: 고객 문의에 자동으로 답변 게시
- **반자동 모드**: 답변 제안 후 승인 시 게시
- **수동 모드**: 관리자가 직접 답변 작성

### 📚 매뉴얼 관리
- PDF, DOCX, TXT, HTML 파일 업로드 지원
- 텍스트 직접 입력 가능
- 매뉴얼 기반 AI 답변 생성

### 🔍 실시간 모니터링
- 새 게시글 자동 감지
- 웹훅을 통한 실시간 알림
- 답변 상태 추적

### 📊 통계 및 리포트
- 답변 현황 대시보드
- 자동/반자동 답변 통계
- 주간 활동 리포트

## 설치 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp env.example .env
```

`.env` 파일을 편집하여 다음 정보를 입력하세요:
```env
# 카페24 API 설정
CAFE24_API_URL=https://api.cafe24.com
CAFE24_CLIENT_ID=your_client_id
CAFE24_CLIENT_SECRET=your_client_secret
CAFE24_MALL_ID=your_mall_id

# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# 서버 설정
PORT=3000
NODE_ENV=development
BASE_URL=https://your-domain.com
```

### 3. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 카페24 앱스토어 등록

### 1. 앱 정보 설정
`app.json` 파일에서 앱 정보를 수정하세요:
- 앱 이름, 설명, 아이콘
- 가격 정책
- 개발자 정보
- 지원 연락처

### 2. 필요한 엔드포인트
- **설치**: `POST /api/install`
- **제거**: `DELETE /api/install`
- **웹훅**: `POST /api/webhook/cafe24`
- **메인 페이지**: `GET /`

### 3. 권한 설정
앱이 필요한 카페24 API 권한:
- `board_read`: 게시글 조회
- `board_write`: 게시글 작성
- `board_reply`: 답글 작성
- `customer_read`: 고객 정보 조회

## API 문서

### 카페24 연동 API

#### 게시판 목록 조회
```http
GET /api/cafe24/boards
```

#### 미답변 게시글 조회
```http
GET /api/cafe24/boards/{boardId}/unanswered
```

#### 자동 답변 처리
```http
POST /api/cafe24/boards/{boardId}/posts/{postId}/auto-reply
```

#### 반자동 답변 제안
```http
POST /api/cafe24/boards/{boardId}/posts/{postId}/suggest-reply
```

### 매뉴얼 관리 API

#### 매뉴얼 목록 조회
```http
GET /api/manual
```

#### 매뉴얼 업로드
```http
POST /api/manual/upload
Content-Type: multipart/form-data

title: "매뉴얼 제목"
manual: [파일]
```

#### 텍스트 매뉴얼 추가
```http
POST /api/manual/text
Content-Type: application/json

{
  "title": "매뉴얼 제목",
  "content": "매뉴얼 내용"
}
```

### 답변 관리 API

#### 답변 로그 조회
```http
GET /api/answers/logs?page=1&limit=20
```

#### 답변 승인
```http
POST /api/cafe24/answers/{logId}/approve
Content-Type: application/json

{
  "boardId": "게시판ID",
  "postId": "게시글ID",
  "customAnswer": "수정된 답변 (선택사항)"
}
```

#### 답변 거부
```http
POST /api/cafe24/answers/{logId}/reject
```

## 사용법

### 1. 매뉴얼 업로드
1. 웹 인터페이스에서 "매뉴얼 관리" 메뉴 선택
2. "매뉴얼 추가" 버튼 클릭
3. 파일 업로드 또는 텍스트 직접 입력
4. 제목과 내용 입력 후 저장

### 2. 답변 모드 설정
1. "설정" 메뉴에서 답변 모드 선택:
   - **자동**: 문의 시 즉시 답변 게시
   - **반자동**: 답변 제안 후 승인 시 게시
   - **수동**: 관리자가 직접 답변

### 3. 게시글 모니터링
1. "게시글 관리" 메뉴에서 미답변 게시글 확인
2. 각 게시글에 대해 다음 액션 선택:
   - **답변 제안**: AI가 답변 생성 후 승인 대기
   - **자동 답변**: AI가 답변 생성 후 즉시 게시

### 4. 답변 검토 및 승인
1. "답변 로그" 메뉴에서 대기 중인 답변 확인
2. 제안된 답변 검토
3. 필요시 답변 수정 후 승인 또는 거부

## 웹훅 설정

카페24에서 다음 이벤트에 대한 웹훅을 설정하세요:
- `board.post.created`: 새 게시글 생성
- `board.reply.created`: 새 답글 생성
- `customer.inquiry.created`: 새 문의 생성

웹훅 URL: `https://your-domain.com/api/webhook/cafe24`

## 알림 설정

### 이메일 알림
설정에서 이메일 알림을 활성화하고 SMTP 설정을 구성하세요.

### 슬랙 알림
슬랙 웹훅 URL을 설정하면 답변 제안 시 슬랙으로 알림을 받을 수 있습니다.

## 보안 고려사항

- API 키는 환경 변수로 관리
- Rate limiting 적용
- 입력 데이터 검증
- SQL 인젝션 방지
- XSS 보호

## 개발자 가이드

### 프로젝트 구조
```
cafe24-cs-bot/
├── config/          # 설정 파일
├── public/          # 정적 파일 (HTML, CSS, JS)
├── routes/          # API 라우트
├── services/        # 비즈니스 로직
├── app.json         # 앱스토어 등록 정보
├── package.json     # 프로젝트 의존성
└── server.js        # 메인 서버 파일
```

### 데이터베이스 스키마
- `settings`: 앱 설정
- `manuals`: 고객 대응 매뉴얼
- `answer_logs`: 답변 로그
- `monitored_posts`: 모니터링 중인 게시글
- `install_settings`: 앱 설치 정보

## 라이선스

MIT License

## 지원

- 이메일: support@your-domain.com
- 문서: https://your-domain.com/docs
- 이슈 트래킹: GitHub Issues

## 버전 히스토리

### v1.0.0 (2024-01-01)
- 초기 버전 릴리스
- 자동/반자동 답변 기능
- 매뉴얼 관리 기능
- 실시간 모니터링
- 카페24 앱스토어 등록 지원