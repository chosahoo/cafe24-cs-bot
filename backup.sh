#!/bin/bash

# Cafe24 CS Bot 백업 스크립트
# 사용법: ./backup.sh "백업 메시지"

echo "🔄 Cafe24 CS Bot 백업 시작..."

# 현재 날짜와 시간
BACKUP_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_MESSAGE=${1:-"자동 백업 - $BACKUP_DATE"}

echo "📅 백업 시간: $BACKUP_DATE"
echo "💬 백업 메시지: $BACKUP_MESSAGE"

# Git 상태 확인
echo "🔍 Git 상태 확인 중..."
git status

# 변경사항이 있는지 확인
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ 변경사항이 없습니다. 백업할 내용이 없습니다."
    exit 0
fi

# 모든 변경사항 추가
echo "📁 변경사항 추가 중..."
git add .

# 커밋 생성
echo "💾 커밋 생성 중..."
git commit -m "$BACKUP_MESSAGE"

# 백업 완료 메시지
echo "✅ 백업 완료!"
echo "📝 커밋 해시: $(git rev-parse HEAD)"
echo "📅 백업 시간: $BACKUP_DATE"

# 백업 히스토리 보기
echo ""
echo "📋 최근 백업 히스토리:"
git log --oneline -5

echo ""
echo "🎯 백업이 성공적으로 완료되었습니다!"
echo "💡 복원하려면: git reset --hard <커밋해시>"
