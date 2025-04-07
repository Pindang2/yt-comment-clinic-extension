// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM이 로드됨');
    
    // 현재 스텝
    let currentStep = 1;
    // 필터 목록
    let filterList = {};
    // 선택된 필터
    let selectedFilters = [];
    // 다운로드된 필터
    let downloadedFilters = {};
    
    // DOM 요소
    const step1Element = document.getElementById('step1');
    const step2Element = document.getElementById('step2');
    const step3Element = document.getElementById('step3');
    const nextButton = document.getElementById('nextButton');
    const backButton = document.getElementById('backButton');
    const downloadButton = document.getElementById('downloadButton');
    const finishButton = document.getElementById('finishButton');
    const filterListElement = document.getElementById('filterList');
    const errorMessageElement = document.getElementById('errorMessage');
    const downloadProgressElement = document.getElementById('downloadProgress');
    const progressBarElement = document.getElementById('progressBar');
    
    console.log('step1 요소:', step1Element);
    console.log('step2 요소:', step2Element);
    console.log('step3 요소:', step3Element);
    console.log('nextButton 요소:', nextButton);
    
    // 스텝 변경 함수
    function changeStep(step) {
        console.log('changeStep 함수 호출됨, step:', step);
        
        // 현재 활성화된 스텝 확인
        const activeStep = document.querySelector('.view-step.active');
        console.log('현재 활성화된 스텝:', activeStep?.id);
        
        if (activeStep) {
            // 이전 스텝 비활성화
            activeStep.classList.remove('active');
            console.log(`${activeStep.id}에서 active 클래스 제거됨`);
        } else {
            console.warn('활성화된 스텝을 찾을 수 없습니다.');
        }
        
        // 새 스텝 활성화
        const newStep = document.getElementById(`step${step}`);
        if (newStep) {
            newStep.classList.add('active');
            console.log(`${newStep.id}에 active 클래스 추가됨`);
        } else {
            console.error(`step${step} 요소를 찾을 수 없습니다.`);
        }
        
        currentStep = step;
    }
    
    // 필터 목록 불러오기
    async function fetchFilterList() {
        try {
            const response = await fetch(`https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/filterlist.json?t=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error('필터 목록을 불러오는데 실패했습니다.');
            }
            
            const data = await response.json();
            filterList = data;
            
            // 필터 목록 표시
            renderFilterList();
        } catch (error) {
            console.error('필터 목록 불러오기 오류:', error);
            errorMessageElement.textContent = error.message;
            errorMessageElement.style.display = 'block';
            filterListElement.innerHTML = '';
        }
    }
    
    // 필터 목록 표시
    function renderFilterList() {
        if (!filterList.TOC || filterList.TOC.length === 0) {
            filterListElement.innerHTML = '<div class="loading">사용 가능한 필터가 없습니다.</div>';
            return;
        }
        
        filterListElement.innerHTML = '';
        
        filterList.TOC.forEach(filterName => {
            const filterInfo = filterList[filterName];
            if (!filterInfo) return;
            
            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `filter-${filterName}`;
            checkbox.value = filterName;
            checkbox.addEventListener('change', handleFilterSelection);
            
            const label = document.createElement('label');
            label.htmlFor = `filter-${filterName}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'filter-name';
            nameSpan.textContent = filterName;
            
            if (filterInfo.is_beta) {
                const betaTag = document.createElement('span');
                betaTag.className = 'beta-tag';
                betaTag.textContent = 'BETA';
                nameSpan.appendChild(betaTag);
            }
            
            const descSpan = document.createElement('span');
            descSpan.className = 'filter-description';
            descSpan.textContent = filterInfo.description || '';
            
            label.appendChild(nameSpan);
            label.appendChild(descSpan);
            
            filterItem.appendChild(checkbox);
            filterItem.appendChild(label);
            
            filterListElement.appendChild(filterItem);
        });
    }
    
    // 필터 선택 처리
    function handleFilterSelection(event) {
        const filterName = event.target.value;
        
        if (event.target.checked) {
            if (!selectedFilters.includes(filterName)) {
                selectedFilters.push(filterName);
            }
        } else {
            const index = selectedFilters.indexOf(filterName);
            if (index !== -1) {
                selectedFilters.splice(index, 1);
            }
        }
        
        // 다운로드 버튼 활성화/비활성화
        downloadButton.disabled = selectedFilters.length === 0;
    }
    
    // 선택된 필터 다운로드
    async function downloadSelectedFilters() {
        if (selectedFilters.length === 0) {
            alert('최소 하나 이상의 필터를 선택해주세요.');
            return;
        }
        
        downloadProgressElement.style.display = 'block';
        downloadButton.disabled = true;
        backButton.disabled = true;
        
        let downloaded = 0;
        let totalFilters = selectedFilters.length;
        
        try {
            for (const filterName of selectedFilters) {
                try {
                    const url = `https://cdn.jsdelivr.net/gh/Pindang2/yt-comment-clinic-filter@main/Filters/${filterName}.json?t=${new Date().getTime()}`;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`${filterName} 필터를 다운로드하는데 실패했습니다.`);
                    }
                    
                    const filterData = await response.json();
                    console.log('filterData:', filterData); 
                    downloadedFilters[filterName] = filterData;
                    
                    // 진행률 업데이트
                    downloaded++;
                    const progress = (downloaded / totalFilters) * 100;
                    progressBarElement.style.width = `${progress}%`;
                    
                } catch (error) {
                    console.error(`${filterName} 필터 다운로드 중 오류:`, error);
                    throw error;
                }
            }
            
            // 모든 필터 다운로드 완료
            // 필터 저장
            const allFilters = [];
            
            // 각 필터에서 규칙 추출 및 변환
            const filterTypes = {
                pattern: 0,
                accountpattern: 0,
                account: 0,
                string: 0,
                word: 0,
                unknown: 0
            };

            console.log('필터 추출 시작, 필터 수:', Object.keys(downloadedFilters).length);

            for (const filterName in downloadedFilters) {
                const filterData = downloadedFilters[filterName];
                
                console.log(`필터 [${filterName}] 처리 중, 룰 수:`, filterData.filters?.length || 0);
                
                if (filterData.filters && Array.isArray(filterData.filters)) {
                    filterData.filters.forEach(filter => {
                        try {
                            // 필터 타입 확인 로깅
                            console.log('처리 중인 필터 타입:', filter.type, filter);
                            
                            // 모든 필터 타입이 template 속성에 값을 가지고 있음
                            switch (filter.type) {
                                case 'pattern':
                                    if (filter.template) {
                                        // 패턴 필터는 그대로 사용
                                        allFilters.push(filter.template);
                                        filterTypes.pattern++;
                                        console.log(`패턴 필터 추가: ${filter.template.substring(0, 30)}${filter.template.length > 30 ? '...' : ''}`);
                                    }
                                    break;
                                case 'accountpattern':
                                    if (filter.template) {
                                        // accountpattern 필터는 type:value 형식으로 저장
                                        allFilters.push(`accountpattern:${filter.template}`);
                                        filterTypes.accountpattern++;
                                        console.log(`계정 패턴 필터 추가: ${filter.template}`);
                                    }
                                    break;
                                case 'account':
                                    if (filter.template) {
                                        // 계정 필터 - 우선 이름으로 저장
                                        allFilters.push(`account:name:${filter.template}`);
                                        filterTypes.account++;
                                        console.log(`계정 필터 추가: ${filter.template}`);
                                    }
                                    break;
                                case 'string':
                                    if (filter.template) {
                                        // 정확한 문자열 필터
                                        allFilters.push(`string:${filter.template}`);
                                        filterTypes.string++;
                                        console.log(`문자열 필터 추가: ${filter.template.substring(0, 30)}${filter.template.length > 30 ? '...' : ''}`);
                                    }
                                    break;
                                case 'word':
                                    if (filter.template) {
                                        // 단어 필터
                                        allFilters.push(`word:${filter.template}`);
                                        filterTypes.word++;
                                        console.log(`단어 필터 추가: ${filter.template}`);
                                    }
                                    break;
                                default:
                                    console.warn(`알 수 없는 필터 타입: ${filter.type}`, filter);
                                    filterTypes.unknown++;
                            }
                        } catch (error) {
                            console.error('필터 변환 중 오류 발생:', error, filter);
                        }
                    });
                }
            }

            console.log('필터 추출 완료, 총 필터 수:', allFilters.length);
            console.log('필터 타입별 개수:', filterTypes);
            
            // 크롬 스토리지에 저장
            try {
                console.log('크롬 스토리지에 필터 저장 시도', {
                    filters: `${allFilters.length}개`,
                    selectedFilters: selectedFilters,
                    filterDetails: `${Object.keys(downloadedFilters).length}개 필터`
                });
                
                // 저장 전 디버깅을 위해 첫 10개 필터 내용 출력
                console.log('저장할 필터 샘플 (최대 10개):', allFilters.slice(0, 10));
                
                // 스토리지에 저장
                await chrome.storage.local.set({
                    filters: allFilters, 
                    selectedFilters: selectedFilters,
                    filterDetails: downloadedFilters,
                    filterEnabled: true,
                    lastUpdated: Date.now()
                });
                
                // 저장 후 확인
                const savedData = await chrome.storage.local.get(['filters', 'selectedFilters', 'filterDetails']);
                console.log('저장된 필터 수:', savedData.filters?.length || 0);
                console.log('저장된 필터 타입 체크:', 
                    savedData.filters?.filter(f => !f.includes(':')).length || 0, '개의 pattern 필터',
                    savedData.filters?.filter(f => f.includes('accountpattern:')).length || 0, '개의 accountpattern 필터',
                    savedData.filters?.filter(f => f.includes('account:')).length || 0, '개의 account 필터',
                    savedData.filters?.filter(f => f.includes('string:')).length || 0, '개의 string 필터',
                    savedData.filters?.filter(f => f.includes('word:')).length || 0, '개의 word 필터'
                );
                
                console.log('크롬 스토리지에 필터 저장 성공');
            } catch (storageError) {
                console.error('크롬 스토리지 저장 중 오류:', storageError);
                throw storageError;
            }
            
            // 다음 단계로 이동
            setTimeout(() => {
                // 직접 스타일 변경
                document.getElementById('step2').style.display = 'none';
                document.getElementById('step3').style.display = 'block';
                
                changeStep(3);
            }, 500);
            
        } catch (error) {
            console.error('필터 다운로드 중 오류:', error);
            errorMessageElement.textContent = error.message;
            errorMessageElement.style.display = 'block';
            downloadButton.disabled = false;
            backButton.disabled = false;
        }
    }
    
    // 이벤트 리스너 설정
    nextButton.addEventListener('click', () => {
        console.log('다음 버튼 클릭됨');
        
        // 직접 스타일 변경
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        
        changeStep(2);
        fetchFilterList();
    });
    
    backButton.addEventListener('click', () => {
        // 직접 스타일 변경
        document.getElementById('step2').style.display = 'none';
        document.getElementById('step1').style.display = 'block';
        
        changeStep(1);
    });
    
    downloadButton.addEventListener('click', downloadSelectedFilters);
    
    finishButton.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });
    
    // 초기화시 다운로드 버튼 비활성화
    downloadButton.disabled = true;
}); 