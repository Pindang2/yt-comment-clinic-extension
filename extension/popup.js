/** 
팝업 페이지 로드 시 실행되는 코드
필터가 없으면 팝업 내에서 welcome 페이지로 이동
필터가 있으면 현재 필터 enabled 상태 확인
필터가 켜져있으면 스위치를 ON으로 변경
필터가 꺼져있으면 스위치를 OFF으로 변경
필터가 켜져있고 현재 페이지가 영상 페이지면 차단된 댓글 수와 목록 보여줌
**/

// 팝업이 로드될 때 실행되는 코드
document.addEventListener('DOMContentLoaded', async () => {
    // 필터 스위치 요소
    const filterSwitch = document.getElementById('filterSwitch');
    // 필터 업데이트 버튼
    const updateFilterBtn = document.getElementById('updateFilterBtn');
    // 필터 관리 버튼
    const manageFilterBtn = document.getElementById('manageFilterBtn');
    // 단어 입력창
    const wordInput = document.getElementById('wordInput');
    // 단어 추가 버튼
    const addWordBtn = document.getElementById('addWordBtn');
    // 단어 관리 버튼
    const manageWordsBtn = document.getElementById('manageWordsBtn');
    // 제보 버튼
    const reportBtn = document.getElementById('reportBtn');
    // 차단된 댓글 수 표시
    const blockedCount = document.getElementById('blockedCount');
    // 목록 토글 버튼
    const toggleListBtn = document.getElementById('toggleListBtn');
    // 차단된 댓글 목록
    const blockedList = document.getElementById('blockedList');
    // 다크모드 토글 버튼
    const themeToggle = document.getElementById('themeToggle');

    // 필터 데이터
    let filters = [];
    let filterDetails = {};
    let selectedFilters = [];
    let customFilters = [];

    // 초기 상태 설정
    await initializePopup();

    // 다크모드 상태 불러오기
    const { darkMode = false } = await chrome.storage.local.get(['darkMode']);
    if (darkMode) {
        document.body.setAttribute('data-theme', 'dark');
    }

    // 다크모드 토글 이벤트 리스너
    themeToggle.addEventListener('click', async () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        await chrome.storage.local.set({ darkMode: !isDark });
    });

    // 필터 스위치 이벤트 리스너
    filterSwitch.addEventListener('change', async () => {
        await chrome.storage.local.set({ filterEnabled: filterSwitch.checked });
        // 현재 탭에 필터 상태 변경 알림
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'toggleFilter', 
                    enabled: filterSwitch.checked 
                });
            }
        } catch (error) {
            console.log('탭과 통신 중 오류가 발생했습니다:', error);
            // 오류가 발생해도 스토리지에는 설정이 저장되므로 다음 페이지 로드 시 적용됩니다
        }
    });

    // 필터 업데이트 버튼 이벤트 리스너
    updateFilterBtn.addEventListener('click', async () => {
        try {
            if (confirm("필터를 다시 다운로드 하시겠습니까?")) {
                // 환영 페이지로 이동하여 필터 선택 페이지 표시
                window.location.href = 'welcome.html';
            }
        } catch (err) {
            alert('페이지 이동 중 오류가 발생했습니다: ' + err.message);
        }
    });

    // 필터 관리 버튼 이벤트 리스너
    manageFilterBtn.addEventListener('click', () => {
        // 필터 선택 상태 표시
        showFilterManagement();
    });

    // 필터 관리 모달 표시
    function showFilterManagement() {
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // 모달 내용
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        // 헤더
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h3');
        title.textContent = '필터 관리';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // 필터 목록 섹션
        const filterListDiv = document.createElement('div');
        filterListDiv.className = 'modal-filter-list';
        
        const filterListHeader = document.createElement('div');
        filterListHeader.className = 'filter-list-header';
        
        const filterListTitle = document.createElement('h4');
        filterListTitle.textContent = '활성화된 필터';
        
        const addFilterBtn = document.createElement('button');
        addFilterBtn.className = 'add-filter-btn';
        addFilterBtn.textContent = '추가';
        addFilterBtn.addEventListener('click', () => {
            showAddFilterModal();
        });
        
        filterListHeader.appendChild(filterListTitle);
        filterListHeader.appendChild(addFilterBtn);
        filterListDiv.appendChild(filterListHeader);
        
        // 선택된 필터 없음 메시지
        if (window.selectedFilters.length === 0) {
            const noFilters = document.createElement('p');
            noFilters.className = 'no-filters';
            noFilters.textContent = '선택된 필터가 없습니다. 필터 업데이트 버튼을 클릭하여 필터를 선택하세요.';
            filterListDiv.appendChild(noFilters);
        } else {
            // 각 필터 정보 표시
            window.selectedFilters.forEach(filterName => {
                const filterInfo = window.filterDetails[filterName];
                if (!filterInfo) return;
                
                const filterItem = document.createElement('div');
                filterItem.className = 'filter-item';
                
                const filterNameDiv = document.createElement('div');
                filterNameDiv.className = 'filter-name';
                filterNameDiv.textContent = filterName;
                
                if (filterInfo.beta) {
                    const betaTag = document.createElement('span');
                    betaTag.className = 'beta-tag';
                    betaTag.textContent = 'BETA';
                    filterNameDiv.appendChild(betaTag);
                }
                
                const filterDescDiv = document.createElement('div');
                filterDescDiv.className = 'filter-description';
                filterDescDiv.textContent = filterInfo.description || '';
                
                const filterVersion = document.createElement('div');
                filterVersion.className = 'filter-version';
                filterVersion.textContent = `버전: ${filterInfo.version || '알 수 없음'}`;
                
                const filterActions = document.createElement('div');
                filterActions.className = 'filter-actions';
                
                const updateBtn = document.createElement('button');
                updateBtn.className = 'update-btn';
                updateBtn.textContent = '업데이트';
                updateBtn.addEventListener('click', () => {
                    updateFilter(filterName);
                });
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '삭제';
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`${filterName} 필터를 삭제하시겠습니까?`)) {
                        removeFilter(filterName);
                        filterItem.remove();
                    }
                });
                
                filterActions.appendChild(updateBtn);
                filterActions.appendChild(deleteBtn);
                
                filterItem.appendChild(filterNameDiv);
                filterItem.appendChild(filterDescDiv);
                filterItem.appendChild(filterVersion);
                filterItem.appendChild(filterActions);
                
                filterListDiv.appendChild(filterItem);
            });
        }
        
        // 모달에 내용 추가
        modalContent.appendChild(header);
        modalContent.appendChild(filterListDiv);
        
        // 커스텀 필터 관리 섹션 추가
        const customFilterSection = document.createElement('div');
        customFilterSection.className = 'modal-custom-filter-section';
        
        const customFilterTitle = document.createElement('h4');
        customFilterTitle.textContent = '사용자 정의 필터';
        customFilterSection.appendChild(customFilterTitle);
        
        // 사용자 정의 필터 목록
        if (window.customFilters.length === 0) {
            const noCustom = document.createElement('p');
            noCustom.className = 'no-filters';
            noCustom.textContent = '추가된 사용자 정의 필터가 없습니다.';
            customFilterSection.appendChild(noCustom);
        } else {
            // 사용자 정의 필터 표시
            const customFilterList = document.createElement('ul');
            customFilterList.className = 'custom-filter-list';
            
            window.customFilters.forEach((filter, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'custom-filter-item';
                
                const filterText = document.createElement('span');
                filterText.textContent = filter;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '삭제';
                deleteBtn.addEventListener('click', async () => {
                    await removeCustomFilter(index);
                    listItem.remove();
                    if (customFilterList.children.length === 0) {
                        const noCustom = document.createElement('p');
                        noCustom.className = 'no-filters';
                        noCustom.textContent = '추가된 사용자 정의 필터가 없습니다.';
                        customFilterSection.appendChild(noCustom);
                    }
                });
                
                listItem.appendChild(filterText);
                listItem.appendChild(deleteBtn);
                
                customFilterList.appendChild(listItem);
            });
            
            customFilterSection.appendChild(customFilterList);
        }
        
        modalContent.appendChild(customFilterSection);
        
        // 닫기 버튼
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-button';
        closeButton.textContent = '닫기';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.appendChild(closeButton);
        
        // 모달에 내용 추가 및 body에 모달 추가
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 모달 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            
            .modal-content {
                background-color: var(--bg-color);
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                padding: 20px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 10px;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--text-color);
            }
            
            .filter-list-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .add-filter-btn {
                padding: 5px 10px;
                background-color: var(--button-bg);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .filter-item {
                padding: 10px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                margin-bottom: 10px;
                background-color: var(--blocked-item-bg);
            }
            
            .filter-name {
                font-weight: bold;
                margin-bottom: 5px;
                display: flex;
                align-items: center;
            }
            
            .beta-tag {
                background-color: #ff5722;
                color: white;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 8px;
            }
            
            .filter-description {
                font-size: 12px;
                color: var(--stats-text);
                margin-bottom: 5px;
            }
            
            .filter-version {
                font-size: 11px;
                color: var(--stats-text);
                margin-bottom: 5px;
            }
            
            .filter-actions {
                display: flex;
                gap: 5px;
                margin-top: 10px;
            }
            
            .update-btn, .delete-btn {
                padding: 5px 10px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .update-btn {
                background-color: var(--button-bg);
                color: white;
            }
            
            .delete-btn {
                background-color: #f44336;
                color: white;
            }
            
            .no-filters {
                color: var(--stats-text);
                font-style: italic;
                font-size: 12px;
                text-align: center;
                padding: 10px;
            }
            
            .modal-custom-filter-section {
                margin-top: 20px;
                border-top: 1px solid var(--border-color);
                padding-top: 15px;
            }
            
            .custom-filter-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .custom-filter-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                border-bottom: 1px solid var(--border-color);
            }
            
            .modal-close-button {
                display: block;
                width: 100%;
                padding: 10px;
                background-color: var(--button-bg);
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                cursor: pointer;
                margin-top: 15px;
            }
        `;
        document.head.appendChild(style);
    }

    // 필터 추가 모달 표시
    function showAddFilterModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h3');
        title.textContent = '필터 추가';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const filterList = document.createElement('div');
        filterList.className = 'filter-list';
        
        // 온라인 필터 목록 로드
        const timestamp = new Date().getTime();
        fetch(`https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/filterlist.json?t=${timestamp}`)
            .then(response => response.json())
            .then(data => {
                console.log("필터 목록 데이터:", data);
                Object.entries(data).forEach(([name, info]) => {
                    if (!window.selectedFilters.includes(name)) {
                        const filterItem = document.createElement('div');
                        filterItem.className = 'filter-item';
                        
                        const filterName = document.createElement('div');
                        filterName.className = 'filter-name';
                        filterName.textContent = name;
                        
                        if (info.beta) {
                            const betaTag = document.createElement('span');
                            betaTag.className = 'beta-tag';
                            betaTag.textContent = 'BETA';
                            filterName.appendChild(betaTag);
                        }
                        
                        const filterDesc = document.createElement('div');
                        filterDesc.className = 'filter-description';
                        filterDesc.textContent = info.description || '';
                        
                        const addBtn = document.createElement('button');
                        addBtn.className = 'add-btn';
                        addBtn.textContent = '추가';
                        addBtn.addEventListener('click', () => {
                            addFilter(name);
                            filterItem.remove();
                        });
                        
                        filterItem.appendChild(filterName);
                        filterItem.appendChild(filterDesc);
                        filterItem.appendChild(addBtn);
                        
                        filterList.appendChild(filterItem);
                    }
                });
            })
            .catch(error => {
                console.error('필터 목록 로드 중 오류:', error);
                const errorMsg = document.createElement('p');
                errorMsg.className = 'error-message';
                errorMsg.textContent = '필터 목록을 불러오는 중 오류가 발생했습니다.';
                filterList.appendChild(errorMsg);
            });
        
        const customUrlSection = document.createElement('div');
        customUrlSection.className = 'custom-url-section';
        
        const customUrlTitle = document.createElement('h4');
        customUrlTitle.textContent = '커스텀 필터 URL';
        
        const customUrlInput = document.createElement('input');
        customUrlInput.type = 'text';
        customUrlInput.placeholder = '필터 URL 입력...';
        customUrlInput.className = 'custom-url-input';
        
        const addCustomBtn = document.createElement('button');
        addCustomBtn.className = 'add-custom-btn';
        addCustomBtn.textContent = '추가';
        addCustomBtn.addEventListener('click', () => {
            const url = customUrlInput.value.trim();
            if (url) {
                addCustomFilter(url);
                customUrlInput.value = '';
            }
        });
        
        customUrlSection.appendChild(customUrlTitle);
        customUrlSection.appendChild(customUrlInput);
        customUrlSection.appendChild(addCustomBtn);
        
        modalContent.appendChild(header);
        modalContent.appendChild(filterList);
        modalContent.appendChild(customUrlSection);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const style = document.createElement('style');
        style.textContent = `
            .custom-url-section {
                margin-top: 20px;
                border-top: 1px solid var(--border-color);
                padding-top: 15px;
            }
            
            .custom-url-input {
                width: 100%;
                padding: 8px;
                margin: 10px 0;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background-color: var(--input-bg);
                color: var(--text-color);
            }
            
            .add-custom-btn {
                padding: 8px 15px;
                background-color: var(--button-bg);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .add-btn {
                padding: 5px 10px;
                background-color: var(--button-bg);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .error-message {
                color: #f44336;
                text-align: center;
                padding: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    // 필터 추가 함수
    async function addFilter(filterName) {
        try {
            console.log("필터 추가 중:", filterName);
            const timestamp = new Date().getTime();
            const response = await fetch(`https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/Filters/${filterName}.json?t=${timestamp}`);
            if (!response.ok) throw new Error('필터 다운로드 실패');
            
            const filterData = await response.json();
            console.log("다운로드된 필터 데이터:", filterData);
            
            // 필터 정보 저장
            window.filterDetails[filterName] = filterData;
            window.selectedFilters.push(filterName);
            
            // 스토리지 업데이트
            await chrome.storage.local.set({
                filterDetails: window.filterDetails,
                selectedFilters: window.selectedFilters
            });
            
            // 현재 탭에 필터 업데이트 알림
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'updateFilters',
                    filterDetails: window.filterDetails,
                    selectedFilters: window.selectedFilters
                });
            }
            
            // 필터 관리 모달 새로고침
            const modal = document.querySelector('.modal');
            if (modal) {
                document.body.removeChild(modal);
                showFilterManagement();
            }
        } catch (error) {
            console.error('필터 추가 중 오류:', error);
            alert('필터 추가 중 오류가 발생했습니다.');
        }
    }

    // 커스텀 필터 추가 함수
    async function addCustomFilter(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('필터 다운로드 실패');
            
            const filterData = await response.json();
            const filterName = filterData.name || url.split('/').pop().replace('.json', '');
            
            // 필터 정보 저장
            window.filterDetails[filterName] = filterData;
            window.selectedFilters.push(filterName);
            
            // 스토리지 업데이트
            await chrome.storage.local.set({
                filterDetails: window.filterDetails,
                selectedFilters: window.selectedFilters
            });
            
            // 현재 탭에 필터 업데이트 알림
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'updateFilters',
                    filterDetails: window.filterDetails,
                    selectedFilters: window.selectedFilters
                });
            }
            
            // 필터 관리 모달 새로고침
            const modal = document.querySelector('.modal');
            if (modal) {
                document.body.removeChild(modal);
                showFilterManagement();
            }
        } catch (error) {
            console.error('커스텀 필터 추가 중 오류:', error);
            alert('커스텀 필터 추가 중 오류가 발생했습니다.');
        }
    }

    // 필터 업데이트 함수
    async function updateFilter(filterName) {
        try {
            console.log("필터 업데이트 중:", filterName);
            const timestamp = new Date().getTime();
            const response = await fetch(`https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/Filters/${filterName}.json?t=${timestamp}`);
            if (!response.ok) throw new Error('필터 다운로드 실패');
            
            const filterData = await response.json();
            console.log("다운로드된 필터 데이터:", filterData);
            
            // 필터 정보 업데이트
            window.filterDetails[filterName] = filterData;
            
            // 스토리지 업데이트
            await chrome.storage.local.set({
                filterDetails: window.filterDetails
            });
            
            // 현재 탭에 필터 업데이트 알림
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'updateFilters',
                    filterDetails: window.filterDetails
                });
            }
            
            // 필터 관리 모달 새로고침
            const modal = document.querySelector('.modal');
            if (modal) {
                document.body.removeChild(modal);
                showFilterManagement();
            }

            // toast 메시지 표시
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = filterName + ' 필터가 업데이트되었습니다.';
            document.body.appendChild(toast);

            // 3초 후에 toast 메시지 삭제
            setTimeout(() => {  
                document.body.removeChild(toast);
            }, 3000);
            

        } catch (error) {
            console.error('필터 업데이트 중 오류:', error);
            alert('필터 업데이트 중 오류가 발생했습니다.');
        }
    }

    // 필터 삭제 함수
    async function removeFilter(filterName) {
        try {
            console.log("필터 삭제 중:", filterName);
            // 필터 정보 삭제
            delete window.filterDetails[filterName];
            window.selectedFilters = window.selectedFilters.filter(name => name !== filterName);
            
            // 스토리지 업데이트
            await chrome.storage.local.set({
                filterDetails: window.filterDetails,
                selectedFilters: window.selectedFilters
            });
            
            // 현재 탭에 필터 업데이트 알림
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'updateFilters',
                    filterDetails: window.filterDetails,
                    selectedFilters: window.selectedFilters
                });
            }
        } catch (error) {
            console.error('필터 삭제 중 오류:', error);
            alert('필터 삭제 중 오류가 발생했습니다.');
        }
    }

    // 단어 추가 기능
    async function addWord() {
        const word = wordInput.value.trim();
        if (word) {
            const { customFilters = [] } = await chrome.storage.local.get(['customFilters']);
            
            // 중복 확인
            if (!customFilters.includes(word)) {
                customFilters.push(word);
                await chrome.storage.local.set({ customFilters });
                wordInput.value = '';
                
                // 전역 변수 업데이트
                window.customFilters = customFilters;
                
                // 현재 탭에 필터 업데이트 알림
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                        await chrome.tabs.sendMessage(tabs[0].id, { 
                            action: 'updateFilters', 
                            customFilters 
                        });
                    }
                } catch (error) {
                    console.log('단어 추가 후 탭과 통신 중 오류 발생:', error);
                }
                
                // 모달이 열려있으면 리스트 업데이트
                const modal = document.querySelector('.modal');
                if (modal) {
                    const customFilterList = modal.querySelector('.custom-filter-list');
                    const noCustom = modal.querySelector('.no-filters');
                    
                    if (noCustom) {
                        noCustom.remove();
                    }
                    
                    if (!customFilterList) {
                        // 리스트가 없으면 새로 생성
                        const customFilterSection = modal.querySelector('.modal-custom-filter-section');
                        const newList = document.createElement('ul');
                        newList.className = 'custom-filter-list';
                        customFilterSection.appendChild(newList);
                        
                        // 새 항목 추가
                        const listItem = document.createElement('li');
                        listItem.className = 'custom-filter-item';
                        
                        const filterText = document.createElement('span');
                        filterText.textContent = word;
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-btn';
                        deleteBtn.textContent = '삭제';
                        deleteBtn.addEventListener('click', async () => {
                            await removeCustomFilter(customFilters.length - 1);
                            listItem.remove();
                            if (newList.children.length === 0) {
                                const noCustom = document.createElement('p');
                                noCustom.className = 'no-filters';
                                noCustom.textContent = '추가된 사용자 정의 필터가 없습니다.';
                                customFilterSection.appendChild(noCustom);
                            }
                        });
                        
                        listItem.appendChild(filterText);
                        listItem.appendChild(deleteBtn);
                        newList.appendChild(listItem);
                    } else {
                        // 기존 리스트에 새 항목 추가
                        const listItem = document.createElement('li');
                        listItem.className = 'custom-filter-item';
                        
                        const filterText = document.createElement('span');
                        filterText.textContent = word;
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-btn';
                        deleteBtn.textContent = '삭제';
                        deleteBtn.addEventListener('click', async () => {
                            await removeCustomFilter(customFilters.length - 1);
                            listItem.remove();
                            if (customFilterList.children.length === 0) {
                                const noCustom = document.createElement('p');
                                noCustom.className = 'no-filters';
                                noCustom.textContent = '추가된 사용자 정의 필터가 없습니다.';
                                customFilterList.parentElement.appendChild(noCustom);
                            }
                        });
                        
                        listItem.appendChild(filterText);
                        listItem.appendChild(deleteBtn);
                        customFilterList.appendChild(listItem);
                    }
                }
            } else {
                alert('이미 추가된 단어입니다.');
            }
        }
    }

    // 사용자 정의 필터 삭제
    async function removeCustomFilter(index) {
        try {
            // 현재 사용자 정의 필터 가져오기
            const { customFilters = [] } = await chrome.storage.local.get(['customFilters']);
            
            // 필터 삭제
            if (index >= 0 && index < customFilters.length) {
                customFilters.splice(index, 1);
                
                // 업데이트된 필터 저장
                await chrome.storage.local.set({ customFilters });
                
                // 전역 변수 업데이트
                window.customFilters = customFilters;
                
                // 현재 탭에 필터 업데이트 알림
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                        await chrome.tabs.sendMessage(tabs[0].id, { 
                            action: 'updateFilters', 
                            customFilters 
                        });
                    }
                } catch (error) {
                    console.log('필터 삭제 후 탭과 통신 중 오류 발생:', error);
                }
            }
        } catch (err) {
            console.error('필터 삭제 중 오류 발생:', err);
        }
    }

    // 단어 추가 버튼 이벤트 리스너
    addWordBtn.addEventListener('click', addWord);

    // 엔터 키로 단어 추가
    wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addWord();
    });

    // 단어 관리 버튼 이벤트 리스너
    manageWordsBtn.addEventListener('click', () => {
        // 필터 관리 페이지 표시
        showFilterManagement();
    });

    // 제보 버튼 이벤트 리스너
    reportBtn.addEventListener('click', showReportModal);

    // 차단된 댓글 목록 토글
    toggleListBtn.addEventListener('click', () => {
        if (blockedList.classList.contains('hidden')) {
            toggleListBtn.textContent = '▲';
            blockedList.classList.remove('hidden');
        } else {
            toggleListBtn.textContent = '▼';
            blockedList.classList.add('hidden');
        }
    });

    // 현재 탭에서 차단된 댓글 정보 가져오기
    updateBlockedCommentsInfo();
});

// 팝업 초기화 함수
async function initializePopup() {
    try {
        // 저장된 설정 불러오기
        const { 
            filterEnabled = false, 
            filters = [], 
            filterDetails = {},
            selectedFilters = [],
            customFilters = [],
            reportDraft = null
        } = await chrome.storage.local.get([
            'filterEnabled', 
            'filters', 
            'filterDetails', 
            'selectedFilters', 
            'customFilters',
            'reportDraft'
        ]);
        
        // 전역 변수에 할당
        window.filters = filters;
        window.filterDetails = filterDetails;
        window.selectedFilters = selectedFilters;
        window.customFilters = customFilters;
        
        // 필터가 없으면 환영 페이지로 리다이렉트
        if (filters.length === 0 && customFilters.length === 0) {
            window.location.href = 'welcome.html';
            return;
        }
        
        // 필터 스위치 상태 설정
        document.getElementById('filterSwitch').checked = filterEnabled;
        
        // 임시 저장된 제보 내용이 있으면 모달 자동 표시
        if (reportDraft) {
            showReportModal();
        }
        
        // 현재 탭이 YouTube 영상 페이지인지 확인
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if ((tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) || (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/shorts'))) {
                // 영상 페이지인 경우 차단된 댓글 정보 표시
                document.querySelector('.stats-section').style.display = 'block';
            } else {
                // 영상 페이지가 아닌 경우 차단된 댓글 정보 숨김
                document.querySelector('.stats-section').style.display = 'none';
            }
        } catch (error) {
            console.log('탭 정보 확인 중 오류 발생:', error);
            // 기본적으로 통계 섹션 숨기기
            document.querySelector('.stats-section').style.display = 'none';
        }
    } catch (err) {
        console.error('팝업 초기화 중 오류 발생:', err);
    }
}

// 필터 업데이트 함수 (서버에서 최신 필터 가져오기)
async function updateFilters() {
    // 환영 페이지로 이동하여 필터 선택
    window.location.href = 'welcome.html';
}

// 차단된 댓글 정보 업데이트
function updateBlockedCommentsInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if ((tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) || (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/shorts'))) {
            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getBlockedComments' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('차단된 댓글 정보를 가져오는 중 오류 발생:', chrome.runtime.lastError.message);
                        return;
                    }
                    
                    if (response && response.blockedComments) {
                        const { count, comments } = response.blockedComments;
                        document.getElementById('blockedCount').textContent = `차단된 댓글: ${count}`;
                        
                        const blockedList = document.getElementById('blockedList');
                        blockedList.innerHTML = '';
                        
                        if (comments.length === 0) {
                            const emptyItem = document.createElement('div');
                            emptyItem.className = 'blocked-item';
                            emptyItem.textContent = '차단된 댓글이 없습니다.';
                            blockedList.appendChild(emptyItem);
                        } else {
                            comments.forEach(comment => {
                                const commentItem = document.createElement('div');
                                commentItem.className = 'blocked-item';
                                
                                const commentText = document.createElement('div');
                                commentText.className = 'comment-text';
                                commentText.textContent = comment.text.substring(0, 100) + 
                                    (comment.text.length > 100 ? '...' : '');
                                
                                const commentInfo = document.createElement('div');
                                commentInfo.className = 'comment-info';
                                commentInfo.textContent = `차단 이유: ${comment.reason || '알 수 없음'}`;
                                
                                commentItem.appendChild(commentText);
                                commentItem.appendChild(commentInfo);
                                
                                blockedList.appendChild(commentItem);
                            });
                        }
                    }
                });
            } catch (error) {
                console.log('차단된 댓글 정보를 가져오는 중 오류 발생:', error);
            }
        }
    });
}

// 제보 모달 관련 함수들
function showReportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">댓글 제보하기</h3>
                <button class="close-btn">&times;</button>
            </div>
            <form class="report-form">
                <div class="form-group">
                    <label for="account">*신고하려는 계정(복붙해주세요)</label>
                    <input type="text" id="account" required>
                </div>
                <div class="form-group">
                    <label for="comment">*신고하려는 댓글의 내용(복붙해주세요)</label>
                    <textarea id="comment" required></textarea>
                </div>
                <div class="form-group">
                    <label for="opinion">의견</label>
                    <textarea id="opinion" placeholder="추가로 전달하고 싶은 내용이 있다면 입력해주세요."></textarea>
                </div>
                <button type="submit" class="submit-btn">전송</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 임시 저장된 내용 복원
    chrome.storage.local.get(['reportDraft'], (result) => {
        if (result.reportDraft) {
            document.getElementById('account').value = result.reportDraft.account || '';
            document.getElementById('comment').value = result.reportDraft.comment || '';
            document.getElementById('opinion').value = result.reportDraft.opinion || '';
        }
    });

    // 폼 내용 변경 시 임시 저장
    const form = modal.querySelector('.report-form');
    const saveDraft = () => {
        const draft = {
            account: document.getElementById('account').value,
            comment: document.getElementById('comment').value,
            opinion: document.getElementById('opinion').value
        };
        chrome.storage.local.set({ reportDraft: draft });
    };

    form.addEventListener('input', saveDraft);

    // 모달 닫기 버튼 이벤트
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['reportDraft']);
        document.body.removeChild(modal);
    });

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            chrome.storage.local.remove(['reportDraft']);
            document.body.removeChild(modal);
        }
    });

    // 폼 제출 이벤트
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const account = document.getElementById('account').value;
        const comment = document.getElementById('comment').value;
        const opinion = document.getElementById('opinion').value;

        if (!account || !comment) {
            showToast('필수 항목을 모두 입력해주세요.');
            return;
        }

        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '전송 중...';

        try {
            await sendReport(account, comment, opinion);
            chrome.storage.local.remove(['reportDraft']);
            showToast('제보가 성공적으로 전송되었습니다.');
            document.body.removeChild(modal);
        } catch (error) {
            console.error('제보 전송 중 오류:', error);
            showToast('제보 전송 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '전송';
        }
    });
}

async function sendReport(account, comment, opinion) {
    const webhookUrl = 'https://discord.com/api/webhooks/1358775531390242833/KsqbswJUQOIBYau2lXaOopZLJ3yqg6hGtCoflwhevNcrv8x4T6w_jM46xtMX8jMv54Us';
    const videoId = window.location.pathname.split('/').pop();
    
    const embed = {
        title: '새로운 댓글 제보',
        color: 0xFF0000,
        fields: [
            {
                name: '신고된 계정',
                value: account,
                inline: false
            },
            {
                name: '신고된 댓글',
                value: comment,
                inline: false
            }
        ],
        timestamp: new Date().toISOString()
    };

    if (opinion) {
        embed.fields.push({
            name: '추가 의견',
            value: opinion,
            inline: false
        });
    }
    embed.fields.push({
        name: 'Video URL',
        value: `https://youtu.be/${videoId}`,
        inline: false
    });

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: '<@344123360697122817>',
            embeds: [embed]
        })
    });

    if (!response.ok) {
        throw new Error('웹훅 전송 실패');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}
