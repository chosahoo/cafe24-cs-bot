#!/bin/bash
# 서버 자동 재시작 스크립트

cd /home/chosahoo/dev/cafe24-cs-bot

while true; do
    echo "서버 시작 중..."
    npm start
    
    if [ $? -ne 0 ]; then
        echo "서버 오류 발생. 5초 후 재시작..."
        sleep 5
    else
        echo "서버 정상 종료"
        break
    fi
done
