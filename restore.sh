#!/bin/bash

# Cafe24 CS Bot 복원 스크립트
# 사용법: ./restore.sh <커밋해시> 또는 ./restore.sh (최근 백업으로 복원)

echo "🔄 Cafe24 CS Bot 복원 시작..."

if [ -z "$1" ]; then
    echo "📋 최근 백업 목록:"
    git log --oneline -10
    echo ""
    echo "💡 사용법: ./restore.sh <커밋해시>"
    echo "💡 예시: ./restore.sh abc1234"
    exit 1
fi

COMMIT_HASH=$1

# 커밋 존재 확인
if ! git cat-file -e "$COMMIT_HASH^{commit}" 2>/dev/null; then
    echo "❌ 잘못된 커밋 해시입니다: $COMMIT_HASH"
    echo "📋 사용 가능한 커밋 목록:"
    git log --oneline -10
    exit 1
fi

# 현재 상태 확인
echo "🔍 현재 상태 확인 중..."
git status

# 복원 확인
echo "⚠️  현재 작업 내용이 모두 사라집니다!"
echo "📝 복원할 커밋: $COMMIT_HASH"
echo "📅 커밋 정보: $(git show --oneline -s $COMMIT_HASH)"

read -p "정말로 복원하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 복원이 취소되었습니다."
    exit 1
fi

# 복원 실행
echo "🔄 복원 중..."
git reset --hard "$COMMIT_HASH"

# 복원 완료
echo "✅ 복원 완료!"
echo "📝 복원된 커밋: $COMMIT_HASH"
echo "📅 복원 시간: $(date)"

# 현재 상태 확인
echo ""
echo "📋 현재 상태:"
git log --oneline -3
