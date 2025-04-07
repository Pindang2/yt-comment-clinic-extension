/*
필터 
크롬익스텐션 엔진 작동부
현재 페이지가 영상 페이지인지 확인. 아니면 bypass
현재 페이지가 영상 페이지고 필터 데이터베이스가 없으면 익스텐션 팝업을 띄우기
필터가 꺼져있으면 bypass
필터 데이터베이스가 있으면 필터 데이터베이스에 있는 필터 적용
*/

// 필터 상태
let filterEnabled = false;
// 기본 필터 목록 (pattern 타입)
let filters = [];
// 필터 상세 정보
let filterDetails = {};
// 필터 버전 정보
let filterVersions = {};
// 현재 필터 버전
let currentFilterVersion = '0.0.0';
// 필터 업데이트 확인 간격 (24시간, 밀리초)
const CHECK_UPDATE_INTERVAL = 24 * 60 * 60 * 1000;
// 마지막 업데이트 확인 시간
let lastUpdateCheck = 0;
// 선택된 필터 목록
let selectedFilters = [];
// 사용자 정의 필터 목록
let customFilters = [];
// 차단된 댓글 정보
let blockedComments = {
    count: 0,
    comments: []
};

// 초기화 함수
async function initialize() {
    try {
        // 저장된 설정 불러오기
        const { 
            filterEnabled: enabled = false, 
            filters: savedFilters = [], 
            filterDetails: savedFilterDetails = {},
            selectedFilters: savedSelectedFilters = [],
            customFilters: savedCustomFilters = [],
            filterVersions: savedFilterVersions = {},
            currentFilterVersion: savedCurrentFilterVersion = '0.0.0',
            lastUpdateCheck: savedLastUpdateCheck = 0,
            blockedComments: savedBlockedComments = { count: 0, comments: [] }
        } = await chrome.storage.local.get([
            'filterEnabled', 
            'filters', 
            'filterDetails', 
            'selectedFilters', 
            'customFilters',
            'filterVersions',
            'currentFilterVersion',
            'lastUpdateCheck',
            'blockedComments'
        ]);
        
        filterEnabled = enabled;
        filters = savedFilters;
        filterDetails = savedFilterDetails;
        selectedFilters = savedSelectedFilters;
        customFilters = savedCustomFilters;
        filterVersions = savedFilterVersions;
        currentFilterVersion = savedCurrentFilterVersion;
        lastUpdateCheck = savedLastUpdateCheck;
        blockedComments = savedBlockedComments;
        
        // 현재 페이지가 YouTube 영상 페이지인지 확인
        if (isYouTubeVideoPage()) {
            // 필터 데이터베이스가 없으면 알림
            if (filters.length === 0 && customFilters.length === 0) {
                console.log('필터 데이터베이스가 없습니다. 팝업을 통해 업데이트하세요.');
            }
            
            // 필터가 켜져있으면 필터링 시작
            if (filterEnabled) {
                startFiltering();
            }
        }

        // 필터 업데이트 확인
        const now = Date.now();
        if (now - lastUpdateCheck > CHECK_UPDATE_INTERVAL) {
            checkFilterUpdates();
        }
    } catch (err) {
        console.error('초기화 중 오류 발생:', err);
    }
}

// 필터 업데이트 확인 함수
async function checkFilterUpdates() {
    try {
        console.log('필터 업데이트 확인 중...');
        
        // 필터 목록 정보 가져오기
        const response = await fetch('https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/filterlist.json');
        if (!response.ok) {
            throw new Error('필터 목록을 불러오는데 실패했습니다.');
        }
        
        const filterList = await response.json();
        
        // 업데이트 필요한지 확인
        let needsUpdate = false;
        const updatedFilters = [];
        
        for (const filterName of selectedFilters) {
            if (filterList[filterName]) {
                const remoteVersion = filterList[filterName].version || '0.0.0';
                const localVersion = filterVersions[filterName] || '0.0.0';
                
                if (compareVersions(remoteVersion, localVersion) > 0) {
                    console.log(`필터 업데이트 필요: ${filterName} (로컬: ${localVersion}, 원격: ${remoteVersion})`);
                    needsUpdate = true;
                    updatedFilters.push(filterName);
                }
            }
        }
        
        // 업데이트가 필요한 경우
        if (needsUpdate) {
            await updateFilters(updatedFilters);
        }
        
        // 마지막 업데이트 확인 시간 저장
        lastUpdateCheck = Date.now();
        await chrome.storage.local.set({ lastUpdateCheck });
        
    } catch (err) {
        console.error('필터 업데이트 확인 중 오류 발생:', err);
    }
}

// 필터 업데이트 함수
async function updateFilters(filtersToUpdate) {
    try {
        console.log(`${filtersToUpdate.length}개 필터 업데이트 중...`);
        
        const updatedFilterDetails = {...filterDetails};
        const updatedFilterVersions = {...filterVersions};
        let allFilters = [...filters];
        
        // 업데이트할 필터만 다운로드
        for (const filterName of filtersToUpdate) {
            try {
                const url = `https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/Filters/${filterName}.json`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`${filterName} 필터를 다운로드하는데 실패했습니다.`);
                }
                
                const filterData = await response.json();
                updatedFilterDetails[filterName] = filterData;
                
                // 버전 정보 업데이트
                if (filterData.version) {
                    updatedFilterVersions[filterName] = filterData.version;
                }
                
                // 필터 룰 추출 및 변환
                if (filterData.filters && Array.isArray(filterData.filters)) {
                    // 기존에 이 필터에서 추가된 룰 제거 (패턴 매칭으로 추측)
                    const filterPrefix = `${filterName}:`;
                    allFilters = allFilters.filter(f => !f.startsWith(filterPrefix));
                    
                    // 새 룰 추가
                    filterData.filters.forEach(filter => {
                        try {
                            switch (filter.type) {
                                case 'pattern':
                                    if (filter.template) {
                                        allFilters.push(`${filterName}:${filter.template}`);
                                    }
                                    break;
                                case 'accountpattern':
                                    if (filter.template) {
                                        allFilters.push(`${filterName}:accountpattern:${filter.template}`);
                                    }
                                    break;
                                case 'account':
                                    if (filter.template) {
                                        allFilters.push(`${filterName}:account:name:${filter.template}`);
                                    }
                                    break;
                                case 'string':
                                    if (filter.template) {
                                        allFilters.push(`${filterName}:string:${filter.template}`);
                                    }
                                    break;
                                case 'word':
                                    if (filter.template) {
                                        allFilters.push(`${filterName}:word:${filter.template}`);
                                    }
                                    break;
                            }
                        } catch (error) {
                            console.error('필터 변환 중 오류 발생:', error, filter);
                        }
                    });
                }
                
            } catch (error) {
                console.error(`${filterName} 필터 다운로드 중 오류:`, error);
            }
        }
        
        // 스토리지에 업데이트된 필터 저장
        await chrome.storage.local.set({
            filters: allFilters,
            filterDetails: updatedFilterDetails,
            filterVersions: updatedFilterVersions,
            lastUpdated: Date.now()
        });
        
        console.log('필터 업데이트 완료');
        
        // 현재 활성화된 필터 갱신
        filters = allFilters;
        filterDetails = updatedFilterDetails;
        filterVersions = updatedFilterVersions;
        
        // 활성화된 필터가 있으면 필터링 다시 적용
        if (filterEnabled && isYouTubeVideoPage()) {
            filterExistingComments();
        }
        
    } catch (err) {
        console.error('필터 업데이트 중 오류 발생:', err);
    }
}

// 버전 비교 함수 (v1 > v2이면 1, v1 < v2이면 -1, 같으면 0 반환)
function compareVersions(v1, v2) {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        
        if (v1Part > v2Part) return 1;
        if (v1Part < v2Part) return -1;
    }
    
    return 0;
}

// YouTube 영상 페이지인지 확인하는 함수
function isYouTubeVideoPage() {
    console.log('isYouTubeVideoPage 호출');
    const url = window.location.href;
    let isVideoPage = false;
    if (url.includes('youtube.com/watch')) isVideoPage = true;
    if (url.includes('youtube.com/shorts')) isVideoPage = true;
    console.log('isYouTubeVideoPage 결과:', isVideoPage);
    return isVideoPage;
}

// 필터링 시작 함수
function startFiltering() {
    // 댓글 버튼 감시 및 로드 감지
    observeCommentButton();
    
    // 이미 존재하는 댓글 필터링
    filterExistingComments();
    
    // 새로 로드되는 댓글 감시
    observeNewComments();
}

// 댓글 버튼 감시 함수
function observeCommentButton() {
    // 페이지의 상태 변화를 감지하는 MutationObserver 설정
    const pageObserver = new MutationObserver(() => {
        // 댓글 영역이 로드되었는지 확인
        const commentsSection = document.querySelector("#comments");
        if (commentsSection && !commentsSection.hasAttribute('observed-loading')) {
            // 이미 감시 중인지 표시
            commentsSection.setAttribute('observed-loading', 'true');
            
            // 댓글 로드 완료를 감지하는 MutationObserver 설정
            const commentsLoadObserver = new MutationObserver((mutations) => {
                // 댓글이 로드되었는지 확인
                const commentElements = document.querySelectorAll('ytd-comment-view-model');
                if (commentElements.length > 0) {
                    // 로드 완료 후 약간의 지연 시간을 두고 필터링
                    setTimeout(() => {
                        console.log('댓글 로드 완료, 필터링 시작...');
                        filterExistingComments();
                    }, 100);
                }
            });
            
            // 댓글 컨테이너 변화 감시
            commentsLoadObserver.observe(commentsSection, { childList: true, subtree: true });
        }
    });
    
    // 페이지 전체 변화 감시
    pageObserver.observe(document.body, { childList: true, subtree: true });
    
    // 댓글 버튼 클릭 이벤트 리스너 등록
    document.addEventListener('click', (event) => {
        // 댓글 버튼 또는 답글 버튼 클릭 감지
        if (event.target.closest('#comments-button') || 
            event.target.closest('#reply-button-end') || 
            event.target.closest('button[aria-label="답글"]')) {
            
            console.log('댓글/답글 버튼 클릭 감지');
            // 잠시 후 필터링 실행 (로드 시간 고려)
            setTimeout(() => {
                filterExistingComments();
            }, 1000); // 로드에 시간이 걸릴 수 있으므로 더 긴 지연 시간 설정
        }
    });
}

// 이미 존재하는 댓글 필터링
function filterExistingComments() {
    // 새로운 댓글 컨테이너 찾기
    const commentSection = document.querySelector("#contents");
    if (!commentSection) {
        // 댓글 섹션이 아직 로드되지 않았으면 잠시 후 다시 시도
        setTimeout(filterExistingComments, 1000);
        return;
    }
    
    // 모든 댓글 요소 가져오기 (새로운 선택자 사용)
    const commentElements = commentSection.querySelectorAll('ytd-comment-view-model');
    console.log(`필터링할 댓글 ${commentElements.length}개 발견`);
    
    // 각 댓글에 필터 적용
    commentElements.forEach(commentElement => {
        filterComment(commentElement);
    });
}

// 새로 로드되는 댓글 감시
function observeNewComments() {
    // 새로운 댓글 컨테이너 찾기
    const commentSection = document.querySelector("#contents");
    if (!commentSection) {
        // 댓글 섹션이 아직 로드되지 않았으면 잠시 후 다시 시도
        setTimeout(observeNewComments, 1000);
        return;
    }
    
    // MutationObserver 설정
    const observer = new MutationObserver(mutations => {
        let newCommentsFound = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 새로 추가된 노드에서 댓글 요소 찾기
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 새 댓글 요소인 경우
                        if (node.tagName === 'YTD-COMMENT-VIEW-MODEL') {
                            newCommentsFound = true;
                            // 바로 필터링하지 않고 표시만 함
                        } else {
                            // 추가된 노드 내부에 댓글 요소가 있는지 확인
                            const commentElements = node.querySelectorAll('ytd-comment-view-model');
                            if (commentElements.length > 0) {
                                newCommentsFound = true;
                            }
                        }
                    }
                });
            }
        });
        
        // 새 댓글이 발견되면 지연 후 필터링
        if (newCommentsFound) {
            setTimeout(() => {
                console.log('새 댓글 발견, 필터링 시작...');
                filterExistingComments();
            }, 100);
        }
    });
    
    // 옵저버 시작
    observer.observe(commentSection, { childList: true, subtree: true });
}

// 댓글 필터링 함수
function filterComment(commentElement) {
    if (!filterEnabled) return;
    
    try {
        // 새 구조에서 댓글 텍스트 가져오기
        const commentTextElement = commentElement.querySelector('#content-text');
        if (!commentTextElement) return;
        
        const commentText = commentTextElement.textContent.trim();
        
        // 새 구조에서 작성자 이름 가져오기
        const authorElement = commentElement.querySelector('#author-text');
        const authorName = authorElement ? authorElement.textContent.trim() : '';
        
        // 계정 ID 가져오기 (href에서 추출)
        const authorLinkElement = commentElement.querySelector('#author-text');
        const authorUrl = authorLinkElement ? authorLinkElement.href : '';
        const accountId = authorUrl ? extractAccountId(authorUrl) : '';
        
        // 필터 적용
        const filterResult = shouldFilterComment(commentText, authorName, accountId);
        
        if (filterResult.shouldFilter) {
            // 연결된 답글 찾기 및 제거
            removeReplies(commentElement);
            
            // 댓글 숨기기 (완전히 제거)
            commentElement.remove();
            console.log('댓글 제거 완료');
            
            // 차단된 댓글 정보 저장
            saveBlockedComment(commentText, commentElement, filterResult.reason);
        } else console.log('댓글 필터 안됨: ' + commentText + ' ' + authorName + ' ' + accountId);
    } catch (err) {
        console.error('댓글 필터링 중 오류 발생:', err);
    }
}

// 연결된 답글 제거 함수
function removeReplies(commentElement) {
    try {
        // 1. 같은 부모 내에서 다음 형제 요소에 replies가 있는 경우
        let nextElement = commentElement.nextElementSibling;
        if (nextElement && nextElement.querySelector('#replies')) {
            console.log('댓글에 연결된 답글 제거: 다음 형제');
            nextElement.remove();
            return;
        }
        
        // 2. 댓글 내부에 replies가 있는 경우
        const repliesElement = commentElement.querySelector('#replies');
        if (repliesElement) {
            console.log('댓글에 연결된 답글 제거: 내부');
            repliesElement.remove();
            return;
        }
        
        // 3. 댓글 ID를 기반으로 관련 replies 찾기
        const commentId = getCommentId(commentElement);
        if (commentId) {
            // 해당 댓글 ID를 부모로 갖는 replies 요소 찾기
            const relatedReplies = document.querySelector(`[data-parent-comment-id="${commentId}"]`);
            if (relatedReplies) {
                console.log('댓글에 연결된 답글 제거: ID 관련');
                relatedReplies.remove();
            }
        }
    } catch (err) {
        console.error('답글 제거 중 오류 발생:', err);
    }
}

// 댓글 ID 가져오기 함수
function getCommentId(commentElement) {
    try {
        // 댓글 시간 요소에서 ID 추출 시도
        const timeElement = commentElement.querySelector('#published-time-text a');
        if (timeElement && timeElement.href) {
            const url = new URL(timeElement.href);
            // URL에서 댓글 ID 추출 (lc 파라미터)
            const commentId = url.searchParams.get('lc');
            return commentId;
        }
        
        // 다른 속성에서 ID 추출 시도
        for (const attr of ['data-comment-id', 'id', 'comment-id']) {
            const id = commentElement.getAttribute(attr);
            if (id) return id;
        }
        
        return null;
    } catch (err) {
        console.error('댓글 ID 추출 중 오류 발생:', err);
        return null;
    }
}

// YouTube URL에서 계정 ID 추출
function extractAccountId(url) {
    try {
        if (!url) return '';
        
        // 유튜브 채널 URL 형식: 
        // https://www.youtube.com/channel/CHANNEL_ID
        // 또는
        // https://www.youtube.com/@USERNAME
        
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        
        if (pathParts.includes('channel')) {
            const index = pathParts.indexOf('channel');
            if (index >= 0 && index < pathParts.length - 1) {
                return pathParts[index + 1];
            }
        } else if (pathParts[1] && pathParts[1].startsWith('@')) {
            return pathParts[1];
        }
        
        return '';
    } catch (err) {
        console.error('계정 ID 추출 중 오류 발생:', err);
        return '';
    }
}

// 댓글이 필터에 걸리는지 확인하는 함수
function shouldFilterComment(commentText, authorName, accountId) {
    // 결과 객체
    const result = {
        shouldFilter: false,
        reason: ''
    };
    
    // 1. 기본 패턴 필터 (정규식) 확인
    for (const filterStr of filters) {
        try {
            // 필터 형식 확인 (타입:값 형식이면 다른 타입의 필터)
            if (filterStr.includes(':')) {
                const [type, ...rest] = filterStr.split(':');
                const value = rest.join(':'); // 값에 콜론이 있을 수 있으므로 나머지 부분을 다시 합침

                switch (type) {
                    case 'accountpattern':
                        // 계정 패턴 확인
                        if (authorName) {
                            const regex = new RegExp(value, 'i');
                            if (regex.test(authorName)) {
                                result.shouldFilter = true;
                                result.reason = '계정 패턴 필터 매치';
                                return result;
                            }
                        }
                        break;
                        
                    case 'account':
                        // 계정 ID 또는 이름 확인
                        if (rest[0] === 'id' && accountId === rest[1]) {
                            result.shouldFilter = true;
                            result.reason = '계정 ID 필터 매치';
                            return result;
                        } else if (rest[0] === 'name' && authorName && authorName.includes(rest[1])) {
                            result.shouldFilter = true;
                            result.reason = '계정 이름 필터 매치';
                            return result;
                        }
                        break;
                        
                    case 'string':
                        // 문자열 정확히 일치 확인
                        if (commentText === value) {
                            result.shouldFilter = true;
                            result.reason = '문자열 필터 매치';
                            return result;
                        }
                        break;
                        
                    case 'word':
                        // 단어 포함 확인
                        const wordRegex = new RegExp(`\\b${escapeRegExp(value)}\\b`, 'i');
                        if (wordRegex.test(commentText)) {
                            result.shouldFilter = true;
                            result.reason = '단어 필터 매치';
                            return result;
                        }
                        break;
                }
            } else {
                // 일반 정규식 패턴
                const regex = new RegExp(filterStr, 'i');
                if (regex.test(commentText)) {
                    result.shouldFilter = true;
                    result.reason = '패턴 필터 매치';
                    return result;
                }
            }
        } catch (e) {
            console.error('잘못된 필터:', filterStr, e);
        }
    }
    
    // 2. 상세 필터 확인 (filterDetails에서)
    for (const filterName in filterDetails) {
        const filterData = filterDetails[filterName];
        
        if (filterData.filters && Array.isArray(filterData.filters)) {
            for (const filter of filterData.filters) {
                try {
                    switch (filter.type) {
                        case 'accountpattern':
                            // 계정 패턴 확인
                            if (filter.template && authorName) {
                                const regex = new RegExp(filter.template, 'i');
                                if (regex.test(authorName)) {
                                    result.shouldFilter = true;
                                    result.reason = `계정 패턴 필터 매치: ${filterName}`;
                                    return result;
                                }
                            }
                            break;
                            
                        case 'account':
                            // 특정 계정 ID 확인
                            if (filter.id && accountId && filter.id === accountId) {
                                result.shouldFilter = true;
                                result.reason = `계정 필터 매치: ${filterName}`;
                                return result;
                            } else if (filter.name && authorName && authorName.includes(filter.name)) {
                                result.shouldFilter = true;
                                result.reason = `계정 이름 필터 매치: ${filterName}`;
                                return result;
                            }
                            break;
                            
                        case 'pattern':
                            // 패턴 매치 확인
                            if (filter.pattern) {
                                const regex = new RegExp(filter.pattern, 'i');
                                if (regex.test(commentText)) {
                                    result.shouldFilter = true;
                                    result.reason = `패턴 필터 매치: ${filterName}`;
                                    return result;
                                }
                            }
                            break;
                            
                        case 'string':
                            // 문자열 정확히 일치 확인
                            if (filter.string && commentText === filter.string) {
                                result.shouldFilter = true;
                                result.reason = `문자열 필터 매치: ${filterName}`;
                                return result;
                            }
                            break;
                            
                        case 'word':
                            // 단어 포함 확인
                            if (filter.word) {
                                const wordRegex = new RegExp(`\\b${escapeRegExp(filter.word)}\\b`, 'i');
                                if (wordRegex.test(commentText)) {
                                    result.shouldFilter = true;
                                    result.reason = `단어 필터 매치: ${filterName}`;
                                    return result;
                                }
                            }
                            break;
                    }
                } catch (e) {
                    console.error('필터 확인 중 오류 발생:', filter, e);
                }
            }
        }
    }
    
    // 3. 사용자 정의 필터 확인
    for (const filter of customFilters) {
        try {
            // 정규 표현식인지 확인
            if (filter.startsWith('/') && filter.endsWith('/')) {
                const regex = new RegExp(filter.slice(1, -1), 'i');
                if (regex.test(commentText)) {
                    result.shouldFilter = true;
                    result.reason = '사용자 정의 필터(정규식) 매치';
                    return result;
                }
            } else {
                // 일반 문자열 포함 확인
                if (commentText.includes(filter)) {
                    result.shouldFilter = true;
                    result.reason = '사용자 정의 필터(문자열) 매치';
                    return result;
                }
            }
        } catch (e) {
            console.error('사용자 필터 확인 중 오류 발생:', filter, e);
        }
    }
    
    return result;
}

// 정규식 특수문자 이스케이프 함수
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 차단된 댓글 정보 저장
function saveBlockedComment(commentText, commentElement, reason) {
    try {
        // 작성자 이름 가져오기
        const authorElement = commentElement.querySelector('#author-text');
        const author = authorElement ? authorElement.textContent.trim() : '알 수 없는 사용자';
        
        // 댓글 정보 저장
        const comment = {
            text: commentText,
            author: author,
            reason: reason || '알 수 없는 이유',
            timestamp: new Date().toISOString(),
            pageUrl: window.location.href
        };
        
        // 최대 저장 개수 제한
        if (blockedComments.comments.length >= 100) {
            blockedComments.comments.shift(); // 가장 오래된 항목 제거
        }
        
        blockedComments.comments.push(comment);
        blockedComments.count++;
        
        // 스토리지에 저장
        chrome.storage.local.set({ blockedComments });
    } catch (err) {
        console.error('차단된 댓글 저장 중 오류 발생:', err);
    }
}

// 메시지 리스너 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'toggleFilter':
            // 필터 상태 변경
            filterEnabled = message.enabled;
            if (filterEnabled && isYouTubeVideoPage()) {
                startFiltering();
            }
            sendResponse({ success: true });
            break;
            
        case 'updateFilters':
            // 필터 업데이트
            if (message.filters) {
                filters = message.filters;
            }
            if (message.filterDetails) {
                filterDetails = message.filterDetails;
            }
            if (message.selectedFilters) {
                selectedFilters = message.selectedFilters;
            }
            if (message.customFilters) {
                customFilters = message.customFilters;
            }
            if (message.filterVersions) {
                filterVersions = message.filterVersions;
            }
            if (filterEnabled && isYouTubeVideoPage()) {
                filterExistingComments();
            }
            sendResponse({ success: true });
            break;
            
        case 'getBlockedComments':
            // 차단된 댓글 정보 전송
            sendResponse({ blockedComments });
            break;

        case 'checkUpdates':
            // 필터 업데이트 확인 요청
            checkFilterUpdates()
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true; // 비동기 응답을 위해 true 반환
            
        case 'getFilterInfo':
            // 필터 정보 전송
            sendResponse({
                filterEnabled,
                filters,
                filterDetails,
                selectedFilters,
                customFilters,
                filterVersions,
                lastUpdateCheck
            });
            break;
    }
    
    return true; // 비동기 응답 지원
});

// 페이지 이동 감지
let currentUrl = window.location.href;
setInterval(() => {
    if (currentUrl !== window.location.href) {
        currentUrl = window.location.href;
        
        // 현재 페이지의 차단된 댓글 정보만 초기화
        const currentPageComments = blockedComments.comments.filter(comment => 
            comment.pageUrl === currentUrl
        );
        
        // 현재 페이지의 댓글만 제거
        blockedComments.comments = blockedComments.comments.filter(comment => 
            comment.pageUrl !== currentUrl
        );
        blockedComments.count = blockedComments.comments.length;
        
        // 스토리지 업데이트
        chrome.storage.local.set({ blockedComments });
        
        // 현재 페이지가 YouTube 영상 페이지이고 필터가 켜져있으면 필터링 시작
        if (isYouTubeVideoPage() && filterEnabled) {
            // 댓글 로드를 기다림
            setTimeout(startFiltering, 2000);
        }
    }
}, 1000);

// 초기화 실행
initialize();



