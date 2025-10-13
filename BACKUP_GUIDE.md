# 🔄 Cafe24 CS Bot 백업 가이드

## 📋 백업 방법

### 1. 수동 백업 (Git 명령어)
```bash
# 현재 상태 확인
git status

# 모든 변경사항 추가
git add .

# 백업 커밋 생성
git commit -m "백업: 현재 상태 저장"

# 백업 히스토리 확인
git log --oneline -5
```

### 2. 자동 백업 (스크립트 사용)
```bash
# 백업 실행
./backup.sh "백업 메시지"

# 예시
./backup.sh "미답변 게시글 필터링 완료"
./backup.sh "매뉴얼 관리 기능 추가"
```

## 🔄 복원 방법

### 1. 최근 백업으로 복원
```bash
# 백업 목록 확인
git log --oneline -10

# 특정 커밋으로 복원
git reset --hard <커밋해시>

# 예시
git reset --hard abc1234
```

### 2. 스크립트로 복원
```bash
# 복원 실행
./restore.sh <커밋해시>

# 예시
./restore.sh abc1234
```

## 💡 백업 팁

### ✅ 백업하기 좋은 시점
- 주요 기능 완성 후
- 버그 수정 완료 후
- UI 변경 완료 후
- 설정 변경 후

### ⚠️ 주의사항
- 복원하면 현재 작업 내용이 모두 사라집니다
- 백업 메시지를 명확하게 작성하세요
- 정기적으로 백업하세요

## 🎯 빠른 백업 명령어

```bash
# 현재 상태 백업
git add . && git commit -m "백업: $(date)"

# 특정 메시지로 백업
git add . && git commit -m "백업: 미답변 게시글 필터링 완료"
```
