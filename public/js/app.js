// 전역 변수
let currentLogId = null;
let currentBoardId = null;
let currentPostId = null;
let boards = [];

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadDashboard();
    loadSettings();
    setupEventListeners();
    loadKeywordManuals(); // 키워드 매뉴얼 로드
});

// 앱 초기화
function initializeApp() {
    // 재연동 후 복귀 처리
    const returnToSection = localStorage.getItem('returnToSection');
    if (returnToSection) {
        localStorage.removeItem('returnToSection');
        setTimeout(() => {
            showSection(returnToSection);
            showAlert('Cafe24 재연동이 완료되었습니다!', 'success');
        }, 1000);
    }
    
    // 사이드바 네비게이션 활성화
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionName = this.getAttribute('data-section');
            
            // 모든 네비게이션 버튼 비활성화
            navLinks.forEach(l => l.classList.remove('active'));
            // 현재 버튼 활성화
            this.classList.add('active');
            
            // 해당 섹션 표시
            showSection(sectionName);
        });
    });

    // AI 온도 슬라이더 이벤트
    const temperatureSlider = document.getElementById('ai-temperature');
    if (temperatureSlider) {
        temperatureSlider.addEventListener('input', function() {
            document.getElementById('temperature-value').textContent = this.value;
        });
    }
    
    // 매뉴얼 추가 버튼 이벤트 리스너
    const addManualBtn = document.getElementById('add-manual-btn');
    if (addManualBtn) {
        addManualBtn.addEventListener('click', function() {
            openModal('manualModal');
        });
    }
    
    // 탭 전환 이벤트 리스너
    const csManualTab = document.getElementById('cs-manual-tab');
    if (csManualTab) {
        csManualTab.addEventListener('click', function() {
            switchTab('cs-manual');
        });
    }
    
    const sizechartTab = document.getElementById('sizechart-tab');
    if (sizechartTab) {
        sizechartTab.addEventListener('click', function() {
            switchTab('sizechart');
        });
    }
    
    // 폼 제출 이벤트 리스너 (제거 - onclick으로 대체)
    // const csManualForm = document.getElementById('cs-manual-form');
    // if (csManualForm) {
    //     csManualForm.addEventListener('submit', function(e) {
    //         e.preventDefault();
    //         uploadCSManual();
    //     });
    // }
    
    // const sizechartForm = document.getElementById('sizechart-form');
    // if (sizechartForm) {
    //     sizechartForm.addEventListener('submit', function(e) {
    //         e.preventDefault();
    //         uploadSizechart();
    //     });
    // }
}

// 섹션 표시
function showSection(sectionName) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
        
        // 네비게이션 활성화
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // 섹션별 데이터 로드
        switch(sectionName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'posts':
                loadPosts();
                break;
            case 'manuals':
                loadManuals();
                break;
            case 'answers':
                loadAnswers();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    }
}

// 대시보드 로드
async function loadDashboard() {
    try {
        // 설정에서 CS 게시판 ID와 제목 필터 가져오기
        const settingsResponse = await fetch('/api/settings');
        const settingsResult = await settingsResponse.json();
        
        if (!settingsResult.success || !settingsResult.data.cs_board_id) {
            console.log('CS 게시판이 설정되지 않음');
            return;
        }
        
        const boardId = settingsResult.data.cs_board_id;
        
        // 대시보드 통계 API 호출
        const statsResponse = await fetch(`/api/cafe24/boards/${boardId}/stats`);
        
        // 401 오류 (토큰 만료) 감지 시 자동 재연동
        if (statsResponse.status === 401) {
            showAlert('Cafe24 인증이 만료되었습니다. 자동으로 재연동합니다...', 'warning');
            setTimeout(() => {
                reconnectCafe24();
            }, 2000);
            return;
        }
        
        const statsResult = await statsResponse.json();
        
        if (statsResult.success) {
            const stats = statsResult.data;
            document.getElementById('today-answered-count').textContent = stats.today_answered || 0;
            document.getElementById('today-unanswered-count').textContent = stats.today_unanswered || 0;
            document.getElementById('week-answered-count').textContent = stats.week_answered || 0;
            document.getElementById('week-unanswered-count').textContent = stats.week_unanswered || 0;
            
            loadRecentActivity();
        }
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// 최근 활동 로드
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/answers/logs?limit=5');
        const result = await response.json();
        
        if (result.success) {
            const container = document.getElementById('recent-activity');
            if (container) {
                container.innerHTML = result.data.map(log => `
                    <div class="activity-item">
                        <div class="activity-content">
                            <strong>${escapeHtml(log.question)}</strong>
                            <div class="activity-meta">
                                <span class="badge ${getStatusBadgeClass(log.status)}">${getStatusText(log.status)}</span>
                                <span class="text-muted">${new Date(log.created_at).toLocaleString('ko-KR')}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('최근 활동 로드 오류:', error);
    }
}

// 게시글 로드
async function loadPosts() {
    try {
        console.log('[DEBUG] 게시글 로드 시작');
        
        // 게시판 목록 로드
        console.log('[DEBUG] 게시판 목록 요청 중...');
        const boardsResponse = await fetch('/api/cafe24/boards');
        console.log('[DEBUG] 게시판 응답 상태:', boardsResponse.status);
        
        // 401 오류 (토큰 만료) 감지 시 자동 재연동
        if (boardsResponse.status === 401) {
            showAlert('Cafe24 인증이 만료되었습니다. 자동으로 재연동합니다...', 'warning');
            setTimeout(() => {
                reconnectCafe24();
            }, 2000);
            return;
        }
        
        const boardsResult = await boardsResponse.json();
        console.log('[DEBUG] 게시판 목록 결과:', boardsResult);
        
        if (boardsResult.success) {
            boards = boardsResult.data;
            const boardSelect = document.getElementById('board-select');
            boardSelect.innerHTML = '<option value="">게시판을 선택하세요</option>';
            
            boards.forEach(board => {
                const option = document.createElement('option');
                option.value = board.id;
                option.textContent = board.name;
                boardSelect.appendChild(option);
            });
            
            // 설정에서 저장된 CS 게시판 ID 가져오기
            const settingsResponse = await fetch('/api/settings');
            const settingsResult = await settingsResponse.json();
            
            if (settingsResult.success && settingsResult.data.cs_board_id) {
                const savedBoardId = settingsResult.data.cs_board_id;
                boardSelect.value = savedBoardId;
                console.log('[DEBUG] 저장된 게시판 ID로 설정:', savedBoardId);
                loadUnansweredPosts(savedBoardId);
            }
            
            // 게시판 선택 이벤트
            boardSelect.addEventListener('change', async function() {
                if (this.value) {
                    // 선택한 게시판을 설정에 자동 저장
                    try {
                        await fetch('/api/settings/batch', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                cs_board_id: this.value
                            })
                        });
                        console.log('[DEBUG] CS 게시판 자동 저장:', this.value);
                    } catch (error) {
                        console.error('게시판 설정 저장 오류:', error);
                    }
                    
                    loadUnansweredPosts(this.value);
                }
            });
        }
    } catch (error) {
        console.error('게시글 로드 오류:', error);
        showAlert('게시글 로드에 실패했습니다: ' + error.message, 'danger');
    }
}

// 미답변 게시글 로드
async function loadUnansweredPosts(boardId) {
    try {
        const response = await fetch(`/api/cafe24/boards/${boardId}/unanswered`);
        
        // 401 오류 (토큰 만료) 감지 시 자동 재연동
        if (response.status === 401) {
            showAlert('Cafe24 인증이 만료되었습니다. 자동으로 재연동합니다...', 'warning');
            setTimeout(() => {
                reconnectCafe24();
            }, 2000);
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            const postsList = document.getElementById('posts-list');
            const posts = result.data;
            
            console.log('[DEBUG] 미답변 게시글 수:', posts.length);
            
            if (posts.length === 0) {
                postsList.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-check-circle" style="font-size: 3rem; opacity: 0.3;"></i>
                        <p class="mt-3">미답변 게시글이 없습니다.</p>
                    </div>
                `;
            } else {
                postsList.innerHTML = posts.map(post => {
                    const isAnswered = post.reply_count > 0;
                    console.log(`[DEBUG] 게시글 ${post.id}: reply_count=${post.reply_count}, isAnswered=${isAnswered}`);
                    
                    return `
                        <div class="post-card">
                            <div class="post-title">${escapeHtml(post.title)}</div>
                            <div class="post-content">${stripHtml(post.content)}</div>
                            <div class="post-meta">
                                <span>작성자: ${escapeHtml(post.author)}</span>
                                <span>작성일: ${new Date(post.created_at).toLocaleString('ko-KR')}</span>
                            </div>
                            <div class="post-actions">
                                ${isAnswered ? 
                                    '<span class="badge bg-success">답변 완료</span>' :
                                    `<button class="btn btn-primary btn-sm" onclick="suggestReply('${boardId}', '${post.id}')">
                                        <i class="bi bi-lightbulb"></i>
                                        <span>답변 제안</span>
                                    </button>
                                    <button class="btn btn-success btn-sm" onclick="autoReply('${boardId}', '${post.id}')">
                                        <i class="bi bi-robot"></i>
                                        <span>자동 답변</span>
                                    </button>`
                                }
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else {
            showAlert('미답변 게시글 로드에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('게시글 로드 오류:', error);
        showAlert('게시글 로드를 실패했습니다: ' + error.message, 'danger');
    }
}

// HTML 태그 제거 함수
function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// 매뉴얼 로드
async function loadManuals() {
    try {
        const response = await fetch('/api/manual');
        const result = await response.json();
        
        if (result.success) {
            displayManuals(result.data);
        } else {
            showAlert('매뉴얼 목록을 불러오는데 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('매뉴얼 목록 로드 오류:', error);
        showAlert('매뉴얼 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 매뉴얼 목록 표시
function displayManuals(manuals) {
    const container = document.getElementById('manuals-list');
    
    if (manuals.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-book" style="font-size: 3rem; opacity: 0.3;"></i>
                <p class="mt-3">등록된 매뉴얼이 없습니다.</p>
                <p>위의 "매뉴얼 추가" 버튼을 클릭하여 첫 번째 매뉴얼을 추가해보세요!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = manuals.map(manual => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center gap-2 mb-2">
                            <h6 class="card-title mb-0">${escapeHtml(manual.title)}</h6>
                            <span class="badge ${manual.type === 'keyword' ? 'bg-primary' : manual.type === 'sizechart' ? 'bg-success' : 'bg-secondary'}">
                                ${manual.type === 'keyword' ? 'CS 메뉴얼' : manual.type === 'sizechart' ? '사이즈표' : '파일'}
                            </span>
                        </div>
                        <p class="card-text text-muted small mb-2">
                            생성일: ${new Date(manual.created_at).toLocaleString('ko-KR')}
                        </p>
                        <div class="manual-preview">
                            ${getManualPreview(manual)}
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="editManual(${manual.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteManual(${manual.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 매뉴얼 미리보기
function getManualPreview(manual) {
    if (manual.type === 'keyword') {
        const content = manual.content ? manual.content.substring(0, 200) : '파일 업로드됨';
        return `<div class="text-muted small">${escapeHtml(content)}${manual.content && manual.content.length > 200 ? '...' : ''}</div>`;
    } else if (manual.type === 'sizechart') {
        return `<div class="text-muted small">사이즈표 이미지 + 데이터</div>`;
    } else {
        return `<div class="text-muted small">파일: ${escapeHtml(manual.title)}</div>`;
    }
}

// 답변 로그 로드
async function loadAnswers() {
    try {
        const response = await fetch('/api/answers/logs');
        const result = await response.json();
        
        if (result.success) {
            const container = document.getElementById('answers-list');
            if (container) {
                container.innerHTML = result.data.map(log => `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <h6 class="card-title">${escapeHtml(log.question)}</h6>
                                    <p class="card-text">${escapeHtml(log.answer)}</p>
                                    <div class="d-flex gap-2">
                                        <span class="badge ${getStatusBadgeClass(log.status)}">${getStatusText(log.status)}</span>
                                        <span class="badge bg-secondary">${getModeText(log.mode)}</span>
                                    </div>
                                </div>
                                <small class="text-muted">${new Date(log.created_at).toLocaleString('ko-KR')}</small>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('답변 로그 로드 오류:', error);
    }
}

// 설정 로드
async function loadSettings() {
    try {
        // 게시판 목록 로드 (설정 페이지용)
        const boardsResponse = await fetch('/api/cafe24/boards');
        const boardsResult = await boardsResponse.json();
        if (boardsResult.success) {
            const csBoardSelect = document.getElementById('cs-board-select');
            if (csBoardSelect) {
                csBoardSelect.innerHTML = '<option value="">게시판 선택</option>';
                boardsResult.data.forEach(board => {
                    const option = document.createElement('option');
                    option.value = board.id;
                    option.textContent = board.name;
                    csBoardSelect.appendChild(option);
                });
            }
        }
        
        const response = await fetch('/api/settings');
        const result = await response.json();
        
        if (result.success) {
            const settings = result.data;
            
            // CS 게시판 설정
            if (settings.cs_board_id) {
                const csBoardSelect = document.getElementById('cs-board-select');
                if (csBoardSelect) {
                    csBoardSelect.value = settings.cs_board_id;
                }
            }
            
            // CS 제목 필터 설정
            if (settings.cs_title_filter) {
                const csTitleFilter = document.getElementById('cs-title-filter');
                if (csTitleFilter) {
                    csTitleFilter.value = settings.cs_title_filter;
                }
            }
            
            // 답변 제목 필터 설정
            if (settings.cs_answer_title) {
                const csAnswerTitle = document.getElementById('cs-answer-title');
                if (csAnswerTitle) {
                    csAnswerTitle.value = settings.cs_answer_title;
                }
            }
            
            // 답변 모드 설정
            if (settings.answer_mode) {
                const answerMode = document.getElementById('answer-mode');
                if (answerMode) {
                    answerMode.value = settings.answer_mode;
                }
            }
        }
    } catch (error) {
        console.error('설정 로드 오류:', error);
        showAlert('설정 로드를 실패했습니다.', 'danger');
    }
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 답변 제안
async function suggestReply(boardId, postId) {
    try {
        showLoading(true);
        
        // 게시글 상세 정보 가져오기
        const postResponse = await fetch(`/api/cafe24/boards/${boardId}/posts/${postId}`);
        const postResult = await postResponse.json();
        
        if (!postResult.success) {
            showAlert('게시글 정보를 가져올 수 없습니다.', 'danger');
            return;
        }
        
        const post = postResult.data;
        
        // 답변 생성
        const response = await fetch('/api/answers/suggest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                boardId: boardId,
                postId: postId,
                question: post.title + '\n\n' + post.content
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentLogId = result.data.id;
            currentBoardId = boardId;
            currentPostId = postId;
            
            // 모달에 내용 표시
            document.getElementById('original-question').textContent = post.title + '\n\n' + post.content;
            document.getElementById('suggested-answer').value = result.data.answer;
            
            openModal('answerModal');
        } else {
            showAlert('답변 생성에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('답변 제안 오류:', error);
        showAlert('답변 제안 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 자동 답변
async function autoReply(boardId, postId) {
    if (!confirm('자동으로 답변을 게시하시겠습니까?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/answers/auto', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                boardId: boardId,
                postId: postId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('답변이 자동으로 게시되었습니다.', 'success');
            loadUnansweredPosts(boardId); // 목록 새로고침
        } else {
            showAlert('자동 답변에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('자동 답변 오류:', error);
        showAlert('자동 답변 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 답변 승인
async function approveAnswer() {
    if (!currentLogId || !currentBoardId || !currentPostId) {
        showAlert('답변 정보가 올바르지 않습니다.', 'danger');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/answers/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                logId: currentLogId,
                boardId: currentBoardId,
                postId: currentPostId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('답변이 게시되었습니다.', 'success');
            closeModal('answerModal');
            loadUnansweredPosts(currentBoardId); // 목록 새로고침
        } else {
            showAlert('답변 게시에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('답변 승인 오류:', error);
        showAlert('답변 승인 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 답변 거부
async function rejectAnswer() {
    if (!currentLogId) {
        showAlert('답변 정보가 올바르지 않습니다.', 'danger');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/answers/reject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                logId: currentLogId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('답변이 거부되었습니다.', 'info');
            closeModal('answerModal');
        } else {
            showAlert('답변 거부에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('답변 거부 오류:', error);
        showAlert('답변 거부 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 답변 품질 검증
async function validateAnswer() {
    const question = document.getElementById('original-question').textContent;
    const answer = document.getElementById('suggested-answer').value;
    
    if (!answer.trim()) {
        showAlert('답변 내용을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/answers/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                answer: answer
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const validation = result.data;
            let message = `품질 점수: ${validation.score}/100\n\n`;
            
            if (validation.feedback) {
                message += `피드백:\n${validation.feedback}`;
            }
            
            showAlert(message, validation.score >= 70 ? 'success' : 'warning');
        } else {
            showAlert('답변 검증에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('답변 검증 오류:', error);
        showAlert('답변 검증 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 설정 저장
async function saveSettings() {
    try {
        const settings = {
            cs_board_id: document.getElementById('cs-board-select').value,
            cs_title_filter: document.getElementById('cs-title-filter').value,
            cs_answer_title: document.getElementById('cs-answer-title').value,
            answer_mode: document.getElementById('answer-mode').value
        };
        
        const response = await fetch('/api/settings/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('설정이 저장되었습니다.', 'success');
        } else {
            showAlert('설정 저장에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('설정 저장 오류:', error);
        showAlert('설정 저장 중 오류가 발생했습니다.', 'danger');
    }
}

// 새 게시글 확인
async function checkNewPosts() {
    try {
        showLoading(true);
        
        const response = await fetch('/api/cafe24/check-new-posts');
        const result = await response.json();
        
        if (result.success) {
            const newPosts = result.data;
            if (newPosts.length > 0) {
                showAlert(`새로운 미답변 게시글이 ${newPosts.length}개 있습니다.`, 'info');
                loadUnansweredPosts(currentBoardId);
            } else {
                showAlert('새로운 미답변 게시글이 없습니다.', 'info');
            }
        }
    } catch (error) {
        console.error('새 게시글 확인 오류:', error);
        showAlert('새 게시글 확인 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 대기 답변 처리
async function processPendingAnswers() {
    try {
        const response = await fetch('/api/answers/logs?status=pending');
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            showAlert(`대기 중인 답변이 ${result.data.length}개 있습니다.`, 'info');
        }
    } catch (error) {
        console.error('대기 답변 처리 오류:', error);
    }
}

// Cafe24 재연동
function reconnectCafe24() {
    if (confirm('Cafe24와 다시 연동하시겠습니까?\n\n개발자센터에서 "테스트 실행" 버튼을 먼저 눌렀는지 확인해주세요!')) {
        // 현재 페이지 정보 저장
        const currentSection = document.querySelector('.nav-link.active')?.getAttribute('data-section') || 'dashboard';
        localStorage.setItem('returnToSection', currentSection);
        
        window.location.href = '/cafe24/install?mall_id=luiv';
    }
}

// 매뉴얼 관련 함수들
async function viewManual(manualId) {
    try {
        const response = await fetch(`/api/manual/${manualId}`);
        const result = await response.json();
        
        if (result.success) {
            const manual = result.data;
            alert(`제목: ${manual.title}\n\n내용:\n${manual.content}`);
        }
    } catch (error) {
        console.error('매뉴얼 조회 오류:', error);
    }
}

async function editManual(manualId) {
    // 간단한 편집을 위해 프롬프트 사용
    const response = await fetch(`/api/manual/${manualId}`);
    const result = await response.json();
    
    if (result.success) {
        const manual = result.data;
        const newTitle = prompt('제목을 수정하세요:', manual.title);
        const newContent = prompt('내용을 수정하세요:', manual.content);
        
        if (newTitle && newContent) {
            try {
                const updateResponse = await fetch(`/api/manual/${manualId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: newTitle,
                        content: newContent
                    })
                });
                
                const updateResult = await updateResponse.json();
                
                if (updateResult.success) {
                    showAlert('매뉴얼이 수정되었습니다.', 'success');
                    loadManuals();
                } else {
                    showAlert('매뉴얼 수정에 실패했습니다.', 'danger');
                }
            } catch (error) {
                console.error('매뉴얼 수정 오류:', error);
                showAlert('매뉴얼 수정 중 오류가 발생했습니다.', 'danger');
            }
        }
    }
}

async function deleteManual(manualId) {
    if (!confirm('정말로 이 매뉴얼을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/manual/${manualId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('매뉴얼이 삭제되었습니다.', 'success');
            loadManuals();
        } else {
            showAlert('매뉴얼 삭제에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('매뉴얼 삭제 오류:', error);
        showAlert('매뉴얼 삭제 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 매뉴얼 폼 제출
    const fileManualForm = document.getElementById('file-manual-form');
    if (fileManualForm) {
        fileManualForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('title', document.getElementById('file-title').value);
            formData.append('manual', document.getElementById('manual-file').files[0]);
            
            try {
                showLoading(true);
                
                const response = await fetch('/api/manual/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert('매뉴얼이 성공적으로 업로드되었습니다.', 'success');
                    document.getElementById('file-manual-form').reset();
                    document.getElementById('manualModal').classList.remove('show');
                    loadManuals();
                } else {
                    showAlert('매뉴얼 업로드에 실패했습니다.', 'danger');
                }
            } catch (error) {
                console.error('매뉴얼 업로드 오류:', error);
                showAlert('매뉴얼 업로드 중 오류가 발생했습니다.', 'danger');
            } finally {
                showLoading(false);
            }
        });
    }
    
    // 키워드 매뉴얼 폼 제출
    const keywordForm = document.getElementById('keyword-manual-form');
    if (keywordForm) {
        keywordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const response = await fetch('/api/manual/text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: document.getElementById('keyword-title').value,
                        content: document.getElementById('keyword-content').value,
                        type: 'keyword'
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert('키워드 매뉴얼이 성공적으로 추가되었습니다.', 'success');
                    document.getElementById('keyword-manual-form').reset();
                    closeModal('manualModal');
                    loadManuals();
                    loadKeywordManuals(); // 키워드 매뉴얼 다시 로드
                } else {
                    showAlert('키워드 매뉴얼 추가에 실패했습니다.', 'danger');
                }
            } catch (error) {
                console.error('키워드 매뉴얼 추가 오류:', error);
                showAlert('키워드 매뉴얼 추가 중 오류가 발생했습니다.', 'danger');
            } finally {
                showLoading(false);
            }
        });
    }
    
    // 사이즈표 폼 제출
    const sizechartForm = document.getElementById('sizechart-form');
    if (sizechartForm) {
        sizechartForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('title', document.getElementById('sizechart-title').value);
            formData.append('manual', document.getElementById('sizechart-image').files[0]);
            formData.append('size_data', document.getElementById('sizechart-data').value);
            formData.append('type', 'sizechart');
            
            try {
                showLoading(true);
                
                const response = await fetch('/api/manual/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert('사이즈표가 성공적으로 업로드되었습니다.', 'success');
                    document.getElementById('sizechart-form').reset();
                    closeModal('manualModal');
                    loadManuals();
                    loadKeywordManuals(); // 사이즈 데이터 다시 로드
                } else {
                    showAlert('사이즈표 업로드에 실패했습니다.', 'danger');
                }
            } catch (error) {
                console.error('사이즈표 업로드 오류:', error);
                showAlert('사이즈표 업로드 중 오류가 발생했습니다.', 'danger');
            } finally {
                showLoading(false);
            }
        });
    }
}

// 유틸리티 함수들
function showLoading(show) {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => {
        if (show) {
            el.classList.add('show');
        } else {
            el.classList.remove('show');
        }
    });
}

function showAlert(message, type = 'info') {
    // 기존 알림 제거
    const existingAlert = document.querySelector('.alert-dismissible');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // 새 알림 생성
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'posted': return 'bg-success';
        case 'pending': return 'bg-warning';
        case 'rejected': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'posted': return '게시됨';
        case 'pending': return '대기중';
        case 'rejected': return '거부됨';
        default: return '알 수 없음';
    }
}

function getModeText(mode) {
    switch(mode) {
        case 'auto': return '자동';
        case 'semi-auto': return '반자동';
        case 'manual': return '수동';
        default: return '알 수 없음';
    }
}

// 키워드 기반 답변 시스템
let keywordManuals = {};
let sizeChartData = {};

// 키워드 매뉴얼 파싱 함수
function parseKeywordManual(content) {
    const lines = content.split('\n');
    const keywords = {};
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes(':')) {
            const [keyword, ...answerParts] = trimmedLine.split(':');
            const answer = answerParts.join(':').trim();
            if (keyword && answer) {
                keywords[keyword.trim()] = answer;
            }
        }
    });
    
    return keywords;
}

// 사이즈 데이터 파싱 함수
function parseSizeData(content) {
    const lines = content.split('\n');
    const sizeData = {};
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes('→')) {
            const [condition, size] = trimmedLine.split('→');
            if (condition && size) {
                sizeData[condition.trim()] = size.trim();
            }
        }
    });
    
    return sizeData;
}

// 키워드 기반 답변 생성
async function generateKeywordBasedAnswer(question) {
    try {
        // 1. 키워드 매뉴얼에서 가장 적합한 답변 찾기
        const bestKeyword = findBestKeywordMatch(question, keywordManuals);
        
        if (bestKeyword) {
            let answer = keywordManuals[bestKeyword];
            
            // 2. 사이즈 관련 질문인지 확인하고 사이즈 추천 추가
            const sizeRecommendation = await recommendSizeFromQuestion(question);
            if (sizeRecommendation) {
                answer = answer.replace('[사이즈]', sizeRecommendation);
            }
            
            return answer;
        }
        
        return null;
    } catch (error) {
        console.error('키워드 기반 답변 생성 오류:', error);
        return null;
    }
}

// 매뉴얼 기반 AI 답변 생성
async function generateAIAnswerWithManual(question, manualTemplate, sizeRecommendation = null) {
    try {
        // GPT에게 매뉴얼을 참고하여 자연스럽게 답변 생성하도록 요청
        const response = await fetch('/api/ai/generate-with-manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                manualTemplate: manualTemplate,
                sizeRecommendation: sizeRecommendation
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            return result.data.answer;
        } else {
            console.error('AI 답변 생성 실패:', result.error);
            return null;
        }
    } catch (error) {
        console.error('AI 답변 생성 오류:', error);
        return null;
    }
}

// 가장 적합한 키워드 찾기
function findBestKeywordMatch(question, keywords) {
    const questionLower = question.toLowerCase();
    
    for (const keyword in keywords) {
        const keywordWords = keyword.toLowerCase().split(/\s+/);
        let matchCount = 0;
        
        keywordWords.forEach(word => {
            if (word.length > 2 && questionLower.includes(word)) {
                matchCount++;
            }
        });
        
        if (matchCount >= Math.ceil(keywordWords.length / 2)) {
            return keyword;
        }
    }
    
    return null;
}

// 질문에서 사이즈 추천
async function recommendSizeFromQuestion(question) {
    // 사이즈 관련 키워드 추출
    const heightMatch = question.match(/(\d+)\s*cm|키\s*(\d+)|신장\s*(\d+)/i);
    const weightMatch = question.match(/(\d+)\s*kg|몸무게\s*(\d+)|체중\s*(\d+)/i);
    
    if (heightMatch || weightMatch) {
        const height = heightMatch ? parseInt(heightMatch[1] || heightMatch[2] || heightMatch[3]) : null;
        const weight = weightMatch ? parseInt(weightMatch[1] || weightMatch[2] || weightMatch[3]) : null;
        
        // 사이즈 데이터에서 추천
        return findRecommendedSize(height, weight);
    }
    
    return null;
}

// 사이즈 데이터에서 추천 사이즈 찾기
function findRecommendedSize(height, weight) {
    for (const condition in sizeChartData) {
        const conditionLower = condition.toLowerCase();
        
        if (height && conditionLower.includes(height.toString())) {
            return sizeChartData[condition];
        }
        
        if (weight && conditionLower.includes(weight.toString())) {
            return sizeChartData[condition];
        }
        
        // 범위 매칭 (예: "160-165cm")
        if (height) {
            const rangeMatch = conditionLower.match(/(\d+)-(\d+)\s*cm/);
            if (rangeMatch) {
                const minHeight = parseInt(rangeMatch[1]);
                const maxHeight = parseInt(rangeMatch[2]);
                if (height >= minHeight && height <= maxHeight) {
                    return sizeChartData[condition];
                }
            }
        }
    }
    
    return null;
}

// 모달 열기/닫기 함수
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// 매뉴얼 로드 시 키워드 파싱
async function loadKeywordManuals() {
    try {
        const response = await fetch('/api/manual');
        const result = await response.json();
        
        // API 응답이 {success: true, data: [...]} 형식인지 확인
        const manuals = result.success ? result.data : result;
        
        keywordManuals = {};
        sizeChartData = {};
        
        if (Array.isArray(manuals)) {
            manuals.forEach(manual => {
                if (manual.type === 'keyword') {
                    const keywords = parseKeywordManual(manual.content);
                    Object.assign(keywordManuals, keywords);
                } else if (manual.type === 'sizechart') {
                    if (manual.size_data) {
                        const sizeData = parseSizeData(manual.size_data);
                        Object.assign(sizeChartData, sizeData);
                    }
                }
            });
        }
        
        console.log('키워드 매뉴얼 로드됨:', keywordManuals);
        console.log('사이즈 데이터 로드됨:', sizeChartData);
        
    } catch (error) {
        console.error('매뉴얼 로드 오류:', error);
    }
}

// CS 메뉴얼 업로드
async function uploadCSManual() {
    console.log('[DEBUG] uploadCSManual 함수 호출됨');
    
    const title = document.getElementById('cs-manual-title').value.trim();
    const file = document.getElementById('cs-manual-file').files[0];
    
    console.log('[DEBUG] 제목:', title);
    console.log('[DEBUG] 파일:', file);
    
    if (!title || !file) {
        showAlert('제목과 파일을 모두 입력해주세요.', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('type', 'keyword');
        formData.append('manual', file);
        
        const response = await fetch('/api/manual/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('CS 메뉴얼이 업로드되었습니다.', 'success');
            document.getElementById('cs-manual-form').reset();
            loadManuals(); // 매뉴얼 목록 새로고침
            loadKeywordManuals(); // 키워드 매뉴얼 다시 로드
            closeModal('manualModal'); // 성공 후에만 모달 닫기
        } else {
            showAlert('CS 메뉴얼 업로드에 실패했습니다: ' + (result.message || '알 수 없는 오류'), 'danger');
        }
    } catch (error) {
        console.error('CS 메뉴얼 업로드 오류:', error);
        showAlert('CS 메뉴얼 업로드 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 사이즈표 업로드
async function uploadSizechart() {
    const title = document.getElementById('sizechart-title').value.trim();
    const image = document.getElementById('sizechart-image').files[0];
    const data = document.getElementById('sizechart-data').value.trim();
    
    if (!title || !image) {
        showAlert('제목과 이미지를 모두 입력해주세요.', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('type', 'sizechart');
        formData.append('manual', image);
        if (data) {
            formData.append('size_data', data);
        }
        
        const response = await fetch('/api/manual/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('사이즈표가 업로드되었습니다.', 'success');
            document.getElementById('sizechart-form').reset();
            loadManuals(); // 매뉴얼 목록 새로고침
            loadKeywordManuals(); // 키워드 매뉴얼 다시 로드
            closeModal('manualModal'); // 성공 후에만 모달 닫기
        } else {
            showAlert('사이즈표 업로드에 실패했습니다: ' + (result.message || '알 수 없는 오류'), 'danger');
        }
    } catch (error) {
        console.error('사이즈표 업로드 오류:', error);
        showAlert('사이즈표 업로드 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 매뉴얼 수정
async function editManual(manualId) {
    // TODO: 수정 기능 구현
    showAlert('수정 기능은 곧 추가될 예정입니다.', 'info');
}

// 매뉴얼 삭제
async function deleteManual(manualId) {
    if (!confirm('정말로 이 매뉴얼을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/manual/${manualId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('매뉴얼이 삭제되었습니다.', 'success');
            loadManuals(); // 매뉴얼 목록 새로고침
            loadKeywordManuals(); // 키워드 매뉴얼 다시 로드
        } else {
            showAlert('매뉴얼 삭제에 실패했습니다.', 'danger');
        }
    } catch (error) {
        console.error('매뉴얼 삭제 오류:', error);
        showAlert('매뉴얼 삭제 중 오류가 발생했습니다.', 'danger');
    } finally {
        showLoading(false);
    }
}

// 탭 전환
function switchTab(tabName) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('#manualModal .btn').forEach(btn => {
        btn.classList.remove('active', 'btn-primary', 'btn-success');
        btn.classList.add('btn-secondary');
    });
    
    // 모든 탭 패널 숨기기
    document.querySelectorAll('.tab-content').forEach(pane => {
        pane.classList.add('hidden');
    });
    
    // 선택된 탭 활성화
    if (tabName === 'cs-manual') {
        document.getElementById('cs-manual-tab').classList.remove('btn-secondary');
        document.getElementById('cs-manual-tab').classList.add('btn-primary', 'active');
        document.getElementById('cs-manual-pane').classList.remove('hidden');
    } else if (tabName === 'sizechart') {
        document.getElementById('sizechart-tab').classList.remove('btn-secondary');
        document.getElementById('sizechart-tab').classList.add('btn-success', 'active');
        document.getElementById('sizechart-pane').classList.remove('hidden');
    }
}

// 모달 외부 클릭 시 닫기 (수정됨)
document.addEventListener('click', function(e) {
    // 모달 배경(backdrop)을 클릭했을 때만 닫기
    if (e.target.classList.contains('modal') && e.target === e.currentTarget) {
        e.target.classList.remove('show');
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
});