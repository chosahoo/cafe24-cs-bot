const express = require('express');
const router = express.Router();
const cafe24Service = require('../services/cafe24Service');
const aiService = require('../services/aiService');

// 카페24 웹훅 처리
router.post('/cafe24', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('웹훅 수신:', event, data);
    
    switch (event) {
      case 'board.post.created':
        await handleNewPost(data);
        break;
      case 'board.reply.created':
        await handleNewReply(data);
        break;
      case 'customer.inquiry.created':
        await handleNewInquiry(data);
        break;
      default:
        console.log('처리되지 않은 웹훅 이벤트:', event);
    }
    
    res.json({ success: true, message: '웹훅 처리 완료' });
  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '웹훅 처리 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 새 게시글 처리
async function handleNewPost(postData) {
  try {
    const { board_id, post_id, title, content, customer_id } = postData;
    
    // 이미 처리된 게시글인지 확인
    const existing = await cafe24Service.getMonitoredPost(post_id);
    if (existing) {
      console.log('이미 처리된 게시글:', post_id);
      return;
    }
    
    // 모니터링 목록에 추가
    await cafe24Service.addMonitoredPost({
      id: post_id,
      title: title,
      content: content
    });
    
    // 자동 답변 설정 확인
    const autoReplyEnabled = await getSetting('auto_reply_enabled');
    const answerMode = await getSetting('answer_mode');
    
    if (autoReplyEnabled === 'true' && answerMode === 'auto') {
      // 자동 답변 처리
      await processAutoReply(board_id, post_id, title, content);
    } else if (answerMode === 'semi-auto') {
      // 반자동 답변 제안 생성
      await processSemiAutoReply(board_id, post_id, title, content);
    }
    
    console.log('새 게시글 처리 완료:', post_id);
  } catch (error) {
    console.error('새 게시글 처리 오류:', error);
  }
}

// 새 답글 처리
async function handleNewReply(replyData) {
  try {
    const { board_id, post_id, reply_content, is_admin } = replyData;
    
    if (is_admin) {
      // 관리자 답글이므로 모니터링 상태 업데이트
      await cafe24Service.updateMonitoredPostStatus(post_id, 'answered');
      console.log('관리자 답글 감지, 모니터링 상태 업데이트:', post_id);
    }
  } catch (error) {
    console.error('새 답글 처리 오류:', error);
  }
}

// 새 문의 처리
async function handleNewInquiry(inquiryData) {
  try {
    const { inquiry_id, subject, content, customer_id } = inquiryData;
    
    console.log('새 문의 감지:', inquiry_id);
    // 문의 처리 로직 구현 (필요시)
  } catch (error) {
    console.error('새 문의 처리 오류:', error);
  }
}

// 자동 답변 처리
async function processAutoReply(boardId, postId, title, content) {
  try {
    const question = `${title}\n\n${content}`;
    const suggestedAnswer = await aiService.generateAnswer(question);
    
    // 답변 로그 저장
    const logId = await aiService.saveAnswerLog(
      postId, 
      question, 
      suggestedAnswer, 
      'auto',
      'pending'
    );

    // 자동 답변 게시
    const replyResult = await cafe24Service.createReply(boardId, postId, suggestedAnswer);
    
    // 로그 업데이트
    await aiService.updateAnswerLog(logId, suggestedAnswer, 'posted');
    
    // 모니터링 상태 업데이트
    await cafe24Service.updateMonitoredPostStatus(postId, 'answered');

    console.log('자동 답변 완료:', postId, logId);
  } catch (error) {
    console.error('자동 답변 처리 오류:', error);
    
    // 오류 발생 시 모니터링 상태를 오류로 변경
    await cafe24Service.updateMonitoredPostStatus(postId, 'error');
  }
}

// 반자동 답변 처리
async function processSemiAutoReply(boardId, postId, title, content) {
  try {
    const question = `${title}\n\n${content}`;
    const suggestedAnswer = await aiService.generateAnswer(question);
    
    // 답변 로그 저장 (승인 대기 상태)
    const logId = await aiService.saveAnswerLog(
      postId, 
      question, 
      suggestedAnswer, 
      'semi-auto',
      'pending'
    );

    // 알림 전송 (이메일, 슬랙 등)
    await sendNotification({
      type: 'suggested_answer',
      postId: postId,
      title: title,
      suggestedAnswer: suggestedAnswer,
      logId: logId
    });

    console.log('반자동 답변 제안 생성 완료:', postId, logId);
  } catch (error) {
    console.error('반자동 답변 처리 오류:', error);
  }
}

// 알림 전송
async function sendNotification(notificationData) {
  try {
    const notificationEnabled = await getSetting('notification_enabled');
    if (notificationEnabled !== 'true') {
      return;
    }

    // 이메일 알림
    const emailNotification = await getSetting('email_notification');
    if (emailNotification === 'true') {
      await sendEmailNotification(notificationData);
    }

    // 슬랙 알림
    const slackWebhook = await getSetting('slack_webhook_url');
    if (slackWebhook) {
      await sendSlackNotification(notificationData, slackWebhook);
    }

    console.log('알림 전송 완료:', notificationData.type);
  } catch (error) {
    console.error('알림 전송 오류:', error);
  }
}

// 이메일 알림 전송
async function sendEmailNotification(data) {
  // 이메일 전송 로직 구현
  console.log('이메일 알림 전송:', data);
}

// 슬랙 알림 전송
async function sendSlackNotification(data, webhookUrl) {
  try {
    const axios = require('axios');
    
    const message = {
      text: `새로운 답변 제안이 생성되었습니다`,
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: '게시글 ID',
              value: data.postId,
              short: true
            },
            {
              title: '제목',
              value: data.title,
              short: false
            },
            {
              title: '제안된 답변',
              value: data.suggestedAnswer.substring(0, 500) + '...',
              short: false
            }
          ],
          actions: [
            {
              type: 'button',
              text: '답변 승인',
              url: `${process.env.BASE_URL}/answers/${data.logId}/approve`,
              style: 'primary'
            },
            {
              type: 'button',
              text: '답변 거부',
              url: `${process.env.BASE_URL}/answers/${data.logId}/reject`,
              style: 'danger'
            }
          ]
        }
      ]
    };

    await axios.post(webhookUrl, message);
    console.log('슬랙 알림 전송 완료');
  } catch (error) {
    console.error('슬랙 알림 전송 오류:', error);
  }
}

// 설정 조회 헬퍼 함수
function getSetting(key) {
  return new Promise((resolve, reject) => {
    const db = require('../config/database');
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
}

// 웹훅 검증
router.post('/cafe24/verify', (req, res) => {
  const { challenge } = req.body;
  
  if (challenge) {
    res.json({ challenge: challenge });
  } else {
    res.status(400).json({ error: 'Challenge parameter required' });
  }
});

module.exports = router;
