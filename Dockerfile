# Node.js 18 Alpine 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 애플리케이션 파일 복사
COPY . .

# 데이터 디렉토리 생성
RUN mkdir -p data uploads

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 파일 소유권 변경
RUN chown -R nodejs:nodejs /app
USER nodejs

# 애플리케이션 실행
CMD ["npm", "start"]
