const axios = require('axios');
const db = require('../config/database');

class Cafe24Service {
  constructor() {
    this.baseURL = process.env.CAFE24_API_URL;
    this.clientId = process.env.CAFE24_CLIENT_ID;
    this.clientSecret = process.env.CAFE24_CLIENT_SECRET;
    this.mallId = process.env.CAFE24_MALL_ID;
    this.accessToken = null;
  }

  // 액세스 토큰 발급
  async getAccessToken(authorizationCode, mallId) {
    try {
      const tokenUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
      
      console.log('토큰 발급 요청:', {
        url: tokenUrl,
        client_id: this.clientId,
        redirect_uri: process.env.REDIRECT_URI
      });

      const response = await axios.post(tokenUrl, {
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: process.env.REDIRECT_URI
      }, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('토큰 발급 성공:', response.data);

      this.accessToken = response.data.access_token;
      this.mallId = mallId;
      
      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at: response.data.expires_at,
        mall_id: mallId
      };
    } catch (error) {
      console.error('액세스 토큰 발급 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 데이터베이스에서 액세스 토큰 로드 (자동 갱신 포함)
  async loadAccessToken(mallId = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const targetMallId = mallId || this.mallId || process.env.CAFE24_MALL_ID;
        
        db.get(
          'SELECT * FROM install_settings WHERE mall_id = ? ORDER BY installed_at DESC LIMIT 1',
          [targetMallId],
          async (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (row) {
              // 토큰 만료 확인 및 자동 갱신
              const now = new Date();
              const expiresAt = new Date(row.expires_at);
              
              if (expiresAt <= now && row.refresh_token) {
                console.log('토큰 만료됨, 자동 갱신 시도...');
                try {
                  const newTokenData = await this.refreshAccessToken(row.refresh_token, targetMallId);
                  this.accessToken = newTokenData.access_token;
                  this.mallId = targetMallId;
                  console.log('토큰 자동 갱신 완료:', targetMallId);
                  resolve(newTokenData);
                } catch (refreshError) {
                  console.error('토큰 갱신 실패:', refreshError);
                  reject(refreshError);
                }
              } else {
                this.accessToken = row.access_token;
                this.mallId = row.mall_id;
                console.log('액세스 토큰 로드 완료:', targetMallId);
                resolve(row);
              }
            } else {
              reject(new Error('저장된 액세스 토큰이 없습니다.'));
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  // 액세스 토큰 갱신
  async refreshAccessToken(refreshToken, mallId) {
    try {
      const tokenUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
      
      console.log('토큰 갱신 요청:', tokenUrl);

      const response = await axios.post(tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('토큰 갱신 성공');

      const newTokenData = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken, // 새 refresh_token이 없으면 기존 것 사용
        expires_at: response.data.expires_at,
        mall_id: mallId
      };

      // 새 토큰을 데이터베이스에 저장
      await this.saveAccessToken(mallId, newTokenData);

      return newTokenData;
    } catch (error) {
      console.error('토큰 갱신 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 액세스 토큰 저장
  async saveAccessToken(mallId, tokenData) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE install_settings 
         SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
         WHERE mall_id = ?`,
        [tokenData.access_token, tokenData.refresh_token, tokenData.expires_at, mallId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // API 요청 헤더 생성
  async getHeaders() {
    // 토큰이 없으면 데이터베이스에서 로드 시도
    if (!this.accessToken) {
      try {
        await this.loadAccessToken();
      } catch (error) {
        throw new Error('액세스 토큰이 없습니다. 먼저 인증을 완료해주세요.');
      }
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Client-Id': this.clientId
    };
  }

  // 게시판 목록 조회
  async getBoardList() {
    try {
      const headers = await this.getHeaders();
      const apiUrl = `https://${this.mallId}.cafe24api.com/api/v2/admin/boards`;
      
      console.log('게시판 목록 조회 요청:', apiUrl);
      
      const response = await axios.get(apiUrl, { headers });
      return response.data;
    } catch (error) {
      console.error('게시판 목록 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 개별 게시글 조회
  async getPost(boardId, postId) {
    try {
      const headers = await this.getHeaders();
      const apiUrl = `https://${this.mallId}.cafe24api.com/api/v2/admin/boards/${boardId}/articles/${postId}`;
      
      console.log('게시글 조회 요청:', apiUrl);
      
      const response = await axios.get(apiUrl, { headers });
      
      const article = response.data.article;
      return {
        id: article.article_no,
        board_id: boardId,
        title: article.title,
        content: article.content,
        author: article.writer,
        created_at: article.created_date,
        reply_count: article.reply_count || 0
      };
    } catch (error) {
      console.error('게시글 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 특정 게시판의 게시글 목록 조회
  async getPosts(boardId, page = 1, limit = 20) {
    try {
      console.log(`게시글 목록 조회: boardId=${boardId}, page=${page}, limit=${limit}`);
      const response = await axios.get(
        `https://${this.mallId}.cafe24api.com/api/v2/admin/boards/${boardId}/articles`,
        {
          headers: await this.getHeaders(),
          params: { 
            limit: limit,
            offset: (page - 1) * limit
          }
        }
      );
      console.log('게시글 API 응답:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('게시글 목록 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 특정 게시글 상세 조회
  async getPost(boardId, postId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/admin/boards/${boardId}/posts/${postId}.json`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('게시글 상세 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 게시글에 답글 작성
  async createReply(boardId, postId, content) {
    try {
      const response = await axios.post(
        `${this.baseURL}/admin/boards/${boardId}/posts/${postId}/replies.json`,
        {
          content: content,
          is_admin: true
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('답글 작성 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 답변이 없는 게시글 조회
  async getUnansweredPosts(boardId, titleFilter = null, answerTitleFilter = null) {
    try {
      const response = await this.getPosts(boardId, 1, 100);
      console.log('미답변 게시글 필터링 전:', response.articles?.length);
      console.log('제목 필터:', titleFilter);
      console.log('답변 제목 필터:', answerTitleFilter);
      
      // Cafe24 API 응답 구조에 맞게 수정
      const articles = response.articles || [];
      console.log('전체 게시글 수:', articles.length);
      
      let filteredArticles = articles;
      
      // 0. 공지글 제외 (notice가 "T"인 글 제외)
      filteredArticles = filteredArticles.filter(article => 
        !article.notice || article.notice !== 'T'
      );
      console.log('공지글 제외 후:', filteredArticles.length);
      
      // 1. 먼저 답변 제목 필터 적용 (답변 글 제외)
      if (answerTitleFilter) {
        filteredArticles = filteredArticles.filter(article => 
          !article.title || !article.title.startsWith(answerTitleFilter)
        );
        console.log(`답변 제목 필터 "${answerTitleFilter}" 적용 후:`, filteredArticles.length);
      }
      
      // 2. 제목 필터 적용 (고객 문의만) - 이 필터가 가장 중요함
      if (titleFilter) {
        filteredArticles = filteredArticles.filter(article => 
          article.title && article.title.startsWith(titleFilter)
        );
        console.log(`제목 필터 "${titleFilter}" 적용 후:`, filteredArticles.length);
      } else {
        console.log('제목 필터가 설정되지 않았습니다. 모든 게시글이 표시됩니다.');
      }
      
      // 3. 답변 여부 필터링 (미답변만) - parent_article_no가 null이고 reply_depth가 0인 것만
      filteredArticles = filteredArticles.filter(article => {
        const isOriginalPost = !article.parent_article_no && (!article.reply_depth || article.reply_depth === 0 || article.reply_depth === '0');
        console.log(`게시글 ${article.article_no}: parent_article_no=${article.parent_article_no}, reply_depth=${article.reply_depth}, 원본글=${isOriginalPost}`);
        return isOriginalPost;
      });
      console.log('원본 게시글 필터링 후:', filteredArticles.length);
      
      // 4. 답변 완료된 게시글 제외 (reply_status가 "C"가 아닌 것만)
      filteredArticles = filteredArticles.filter(article => {
        const isNotCompleted = !article.reply_status || article.reply_status !== 'C';
        console.log(`게시글 ${article.article_no}: reply_status=${article.reply_status}, 미완료=${isNotCompleted}`);
        return isNotCompleted;
      });
      console.log('답변 완료 제외 후:', filteredArticles.length);
      
      const unansweredPosts = filteredArticles.map(article => ({
        id: article.article_no,
        board_id: boardId,
        title: article.title,
        content: article.content,
        author: article.writer,
        created_at: article.created_date,
        reply_count: article.reply_count || 0
      }));
      
      console.log('최종 미답변 게시글 수:', unansweredPosts.length);
      return unansweredPosts;
    } catch (error) {
      console.error('미답변 게시글 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 게시판 통계 조회
  async getBoardStats(boardId, titleFilter = null, answerTitleFilter = null) {
    try {
      const response = await this.getPosts(boardId, 1, 100);
      const articles = response.articles || [];
      
      // 제목 필터 적용
      let filteredArticles = articles;
      if (titleFilter) {
        filteredArticles = articles.filter(article => 
          article.title && article.title.startsWith(titleFilter)
        );
      }
      
      // 답변 제목 필터 적용 (답변으로 시작하는 글 제외)
      if (answerTitleFilter) {
        filteredArticles = filteredArticles.filter(article => 
          !article.title || !article.title.startsWith(answerTitleFilter)
        );
      }
      
      // 오늘 날짜 구하기 (한국 시간 기준)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 이번주 시작일 구하기 (월요일)
      const weekStart = new Date(today);
      const dayOfWeek = today.getDay(); // 0(일) ~ 6(토)
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 월요일로 이동
      weekStart.setDate(today.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      // 통계 계산
      const stats = {
        today_answered: 0,
        today_unanswered: 0,
        week_answered: 0,
        week_unanswered: 0
      };
      
      filteredArticles.forEach(article => {
        const articleDate = new Date(article.created_date);
        const isToday = articleDate >= today;
        const isThisWeek = articleDate >= weekStart;
        const isAnswered = article.reply_count && article.reply_count > 0;
        
        // 오늘 통계
        if (isToday) {
          if (isAnswered) {
            stats.today_answered++;
          } else {
            stats.today_unanswered++;
          }
        }
        
        // 이번주 통계
        if (isThisWeek) {
          if (isAnswered) {
            stats.week_answered++;
          } else {
            stats.week_unanswered++;
          }
        }
      });
      
      console.log('게시판 통계:', stats);
      return stats;
    } catch (error) {
      console.error('게시판 통계 조회 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 게시글 모니터링 (새로운 게시글 감지)
  async monitorNewPosts(boardId) {
    try {
      const posts = await this.getPosts(boardId, 1, 10);
      const newPosts = [];

      for (const post of posts.posts) {
        // 이미 모니터링 중인 게시글인지 확인
        const existing = await this.getMonitoredPost(post.id);
        if (!existing) {
          // 새 게시글로 등록
          await this.addMonitoredPost(post);
          newPosts.push(post);
        }
      }

      return newPosts;
    } catch (error) {
      console.error('게시글 모니터링 오류:', error.response?.data || error.message);
      throw error;
    }
  }

  // 모니터링 중인 게시글 조회
  getMonitoredPost(postId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM monitored_posts WHERE post_id = ?',
        [postId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // 모니터링 게시글 추가
  addMonitoredPost(post) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO monitored_posts (post_id, title, content, status) VALUES (?, ?, ?, ?)',
        [post.id, post.title, post.content, 'new'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // 모니터링 게시글 상태 업데이트
  updateMonitoredPostStatus(postId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE monitored_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
        [status, postId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new Cafe24Service();
