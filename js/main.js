        console.log('Starting mukuviewer...');

        // iOS Safari対応：正確なビューポート高さを取得するヘルパー関数
        function getViewportHeight() {
            // visualViewport APIが利用可能な場合はそれを使用（iOS Safari対応）
            if (window.visualViewport) {
                return window.visualViewport.height;
            }
            // フォールバック：document.documentElement.clientHeightを使用
            return document.documentElement.clientHeight;
        }

        // URLからbook_idを取得
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('book_id') || '00000001';
        console.log('Book ID:', bookId);

        // グローバル変数（Emscriptenが拡張する）
        var Module = {
            canvas: document.getElementById('viewer-canvas'),
            print: function(text) {
                console.log('[WASM]', text);
            },
            printErr: function(text) {
                console.error('[WASM]', text);
            },
            preRun: [function() {
                console.log('preRun called');
            }],
            postRun: [function() {
                console.log('postRun called');
                document.getElementById('loading').style.display = 'none';
                console.log('Loading hidden');

                // スプラッシュ画面をフェードアウト
                setTimeout(() => {
                    const splashScreen = document.getElementById('splash-screen');
                    splashScreen.classList.add('fade-out');
                    // フェードアウト完了後に要素を削除
                    setTimeout(() => {
                        splashScreen.style.display = 'none';
                    }, 800);
                }, 500); // 0.5秒後にフェードアウト開始
            }],
            onRuntimeInitialized: function() {
                console.log('onRuntimeInitialized called');
                try {
                    if (Module.ccall) {
                        console.log('Calling initialize with bookId:', bookId);
                        Module.ccall('initialize', null, ['string'], [bookId]);

                        // 画面の向きに応じて1ページモード/2ページモードを設定
                        const landscape = window.innerWidth > getViewportHeight();
                        const singlePage = !landscape; // 縦長の場合は1ページモード
                        Module.ccall('setSinglePageMode', null, ['boolean'], [singlePage]);
                        console.log(`初期表示モード: ${landscape ? '2ページ（横長）' : '1ページ（縦長）'}`);

                        // モバイルデバイスの場合は全画面ボタンを非表示、モード切り替えボタンを右端に移動
                        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
                        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
                        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                        const isSmallScreen = window.innerWidth <= 1024;
                        const isMobile = mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);

                        if (isMobile) {
                            const fullscreenButton = document.getElementById('fullscreen-button-fixed');
                            if (fullscreenButton) {
                                fullscreenButton.style.display = 'none';
                                console.log('モバイルデバイスのため全画面ボタンを非表示にしました');
                            }

                            const modeSwitchContainer = document.getElementById('mode-switch-container');
                            if (modeSwitchContainer) {
                                modeSwitchContainer.style.right = '30px';
                                console.log('モバイルデバイスのためモード切り替えボタンを右端に配置しました');
                            }
                        }

                        // UI要素のイベントリスナーを初期化（簡潔版）
                        window.isMouseOverUIControls = false;
                        ['submenu-open-button', 'submenu-popup', 'autoplay-button-fixed', 'mode-switch-container', 'fullscreen-button-fixed'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) {
                                el.addEventListener('mouseenter', () => { window.isMouseOverUIControls = true; clearTimeout(window.uiControlsTimeout); });
                                el.addEventListener('mouseleave', () => { window.isMouseOverUIControls = false; window.uiControlsTimeout = setTimeout(() => Module.ccall('hideUIControls', null, [], []), 3000); });
                            }
                        });
                        document.addEventListener('click', e => {
                            const s = document.getElementById('submenu-open-button'), p = document.getElementById('submenu-popup');
                            if ((s && s.contains(e.target)) || (p && p.contains(e.target))) { clearTimeout(window.uiControlsTimeout); window.uiControlsTimeout = setTimeout(() => { if (!window.isMouseOverUIControls) Module.ccall('hideUIControls', null, [], []); }, 3000); return; }
                            if (window.submenuOpen && p) { p.classList.remove('visible'); window.submenuOpen = false; }
                            if (window.viewMode === 'normal' && (e.target === document.getElementById('next-button') || e.target === document.getElementById('prev-button'))) return;
                            Module.ccall('showUIControls', null, [], []);
                        });
                        document.addEventListener('touchstart', e => {
                            const s = document.getElementById('submenu-open-button'), p = document.getElementById('submenu-popup'), t = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
                            if ((s && s.contains(t)) || (p && p.contains(t))) { clearTimeout(window.uiControlsTimeout); window.uiControlsTimeout = setTimeout(() => { if (!window.isMouseOverUIControls) Module.ccall('hideUIControls', null, [], []); }, 3000); return; }
                            if (window.viewMode === 'normal' && (t === document.getElementById('next-button') || t === document.getElementById('prev-button'))) return;
                            Module.ccall('showUIControls', null, [], []);
                        });
                        document.addEventListener('fullscreenchange', () => Module.ccall('updateFullscreenIcon', null, [], []));
                        document.addEventListener('webkitfullscreenchange', () => Module.ccall('updateFullscreenIcon', null, [], []));
                    } else {
                        console.error('Module.ccall is not available');
                    }
                } catch (e) {
                    console.error('Error in onRuntimeInitialized:', e);
                }
            },
            onAbort: function(what) {
                console.error('WASM aborted:', what);
            }
        };

        // ページ送り関数
        function nextPage() {
            console.log('nextPage called');
            try {
                if (Module._nextPage) {
                    Module._nextPage();
                } else if (Module.ccall) {
                    Module.ccall('nextPage', null, [], []);
                } else {
                    console.error('nextPage function not available');
                }
            } catch (e) {
                console.error('Error in nextPage:', e);
            }
        }

        function prevPage() {
            console.log('prevPage called');
            try {
                if (Module._prevPage) {
                    Module._prevPage();
                } else if (Module.ccall) {
                    Module.ccall('prevPage', null, [], []);
                } else {
                    console.error('prevPage function not available');
                }
            } catch (e) {
                console.error('Error in prevPage:', e);
            }
        }

        // キャッシュステータスを表示（デバッグ用）
        function showCacheStatus() {
            if (Module.ccall) {
                Module.ccall('printCacheStatus', null, [], []);
            }
        }

        // C++から呼ばれるページ描画関数
        window.renderPageToCanvas = function(canvasId, imgWidth, imgHeight, dataPtr, dataSize) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error('Canvas not found:', canvasId);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get 2d context for canvas:', canvasId);
                return;
            }

            // デバイスピクセル比を取得
            const dpr = window.devicePixelRatio || 1;

            // 表示倍率を適用
            const scale = zoomLevel;

            // 縦読みモードか横読みモードかを判定
            const isVerticalMode = canvasId.includes('vertical');

            let optimalWidth, canvasHeight;

            if (isVerticalMode) {
                // 縦読みモード：画面幅を基準にサイズを計算（論理サイズ）
                const imageAspect = imgWidth / imgHeight;
                const canvasWidth = window.innerWidth * scale;
                const optimalHeight = Math.floor(canvasWidth / imageAspect);

                optimalWidth = canvasWidth;
                canvasHeight = optimalHeight;
            } else {
                // 横読みモード：画面高さを基準にサイズを計算（論理サイズ）
                const imageAspect = imgWidth / imgHeight;
                canvasHeight = getViewportHeight() * scale;
                optimalWidth = Math.floor(canvasHeight * imageAspect);
            }

            // Canvasの描画バッファサイズを物理ピクセルで設定（高DPI対応）
            canvas.width = Math.floor(optimalWidth * dpr);
            canvas.height = Math.floor(canvasHeight * dpr);
            // CSSサイズは論理ピクセルで設定
            canvas.style.width = optimalWidth + 'px';
            canvas.style.height = canvasHeight + 'px';

            console.log(`Canvas ${canvasId} adjusted to: ${optimalWidth}x${canvasHeight} (logical), ${canvas.width}x${canvas.height} (physical), dpr: ${dpr}, scale: ${scale}, mode: ${isVerticalMode ? 'vertical' : 'horizontal'}`);
            console.log(`Image size: ${imgWidth}x${imgHeight}`);

            // コンテキストをデバイスピクセル比でスケーリング
            ctx.setTransform(1, 0, 0, 1, 0, 0); // リセット
            ctx.scale(dpr, dpr);

            // 画像を画面いっぱいに描画（アスペクト比維持）- 論理座標系で指定
            const displayWidth = optimalWidth;
            const displayHeight = canvasHeight;

            // 背景をクリア
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, optimalWidth, canvasHeight);

            // メモリからデータを取得
            let heap;
            if (typeof HEAPU8 !== 'undefined') {
                heap = HEAPU8;
            } else if (typeof Module !== 'undefined' && Module.HEAPU8) {
                heap = Module.HEAPU8;
            } else {
                console.error('HEAPU8 is not available');
                return;
            }

            const srcData = heap.subarray(dataPtr, dataPtr + dataSize);
            const data = new Uint8ClampedArray(srcData);
            const imageData = new ImageData(data, imgWidth, imgHeight);

            // 一時的なCanvasを作成して画像を描画
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgWidth;
            tempCanvas.height = imgHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);

            // 高品質な画像描画設定
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // メインCanvasいっぱいに描画（論理座標系で指定）
            ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);

            console.log("SIZE: " + displayWidth + "_" + displayHeight );

            console.log(`Rendered page to canvas ${canvasId}`);
        };

        // 表示モードの管理
        var viewMode = 'normal'; // 'normal', 'seamless-horizontal', 'seamless-vertical'
        window.viewMode = viewMode; // C++側から参照できるようにする
        let seamlessDirection = 'horizontal'; // 'horizontal' or 'vertical'
        let seamlessPages = [];
        let verticalPages = [];
        const MAX_PAGES = 20; // デモ版の最大ページ数
        const SEAMLESS_PRELOAD_RANGE = 5; // 現在位置から前後5ページを読み込む

        // 自動再生の管理
        let autoplayEnabled = false;
        let autoplayInterval = null;
        const AUTOPLAY_SPEED = 4; // 1フレームあたりのスクロール量（ピクセル）
        const AUTOPLAY_FPS = 30; // フレームレート

        // 表示倍率の管理
        let zoomLevel = 1; // 0.5: 縮小表示, 1: 標準表示, 2: 拡大表示

        // サブメニューの管理
        let submenuOpen = false;

        // 画面が横長かどうかを判定（C++側に移動）
        function isLandscape() {
            return Module.ccall('isLandscape', 'boolean', [], []);
        }

        // モバイルデバイスかどうかを判定（C++側に移動）
        function isMobileDevice() {
            return Module.ccall('isMobileDevice', 'boolean', [], []);
        }

        // サブメニューの開閉
        function toggleSubmenu() {
            submenuOpen = !submenuOpen;
            const submenuPopup = document.getElementById('submenu-popup');
            if (submenuOpen) {
                submenuPopup.classList.add('visible');
            } else {
                submenuPopup.classList.remove('visible');
            }
        }

        // サブメニューボタンの表示/非表示を更新（C++側に移動）
        function updateSubmenuVisibility() {
            Module.ccall('updateSubmenuVisibility', null, ['string'], [viewMode]);
        }

        // ズームレベルを設定
        function setZoomLevel(level) {
            if (zoomLevel === level) {
                return; // 既に同じレベルの場合は何もしない
            }

            const seamlessContainer = document.getElementById('seamless-container');
            const verticalContainer = document.getElementById('vertical-container');

            // ズームレベルを更新
            zoomLevel = level;

            // ボタンの状態を更新
            const zoomButtons = document.querySelectorAll('#submenu-zoom-section .submenu-button');
            zoomButtons.forEach(button => {
                button.classList.remove('active');
            });

            if (level === 0.5) {
                zoomButtons[0].classList.add('active'); // 縮小
                seamlessContainer.classList.add('zoomed');
                verticalContainer.classList.add('zoomed');
                console.log('縮小表示を有効化しました (0.5倍)');
            } else if (level === 1) {
                zoomButtons[1].classList.add('active'); // 標準
                seamlessContainer.classList.remove('zoomed');
                verticalContainer.classList.remove('zoomed');
                console.log('標準表示に設定しました (1倍)');
            } else if (level === 2) {
                zoomButtons[2].classList.add('active'); // 拡大
                seamlessContainer.classList.add('zoomed');
                verticalContainer.classList.add('zoomed');
                console.log('拡大表示を有効化しました (2倍)');
            }

            // 現在のモードに応じて再描画
            redrawZoomLevel();
        }

        // 縦読みモードに切り替え
        function switchToVertical() {
            if (seamlessDirection === 'vertical') {
                return; // 既に縦読みモードの場合は何もしない
            }

            // toggleDirection() を呼び出して切り替え
            toggleDirection();
        }

        // 横読みモードに切り替え
        function switchToHorizontal() {
            if (seamlessDirection === 'horizontal') {
                return; // 既に横読みモードの場合は何もしない
            }

            // toggleDirection() を呼び出して切り替え
            toggleDirection();
        }

        // 読み方向ボタンの状態を更新（C++側に移動）
        function updateDirectionButtons() {
            Module.ccall('updateDirectionButtons', null, ['string'], [seamlessDirection]);
        }

        // シームレスモードに切り替え
        function switchToSeamlessMode() {
            if (viewMode !== 'normal') {
                return; // 既にシームレスモードの場合は何もしない
            }

            // UI要素のタイマーをリセット
            clearTimeout(uiControlsTimeout);
            uiControlsTimeout = setTimeout(() => {
                if (!isMouseOverUIControls) {
                    hideUIControls();
                }
            }, UI_CONTROLS_HIDE_DELAY);

            // シームレスモードに切り替え（画面サイズに応じて初期モードを決定）
            const landscape = window.innerWidth > getViewportHeight();
            seamlessDirection = landscape ? 'horizontal' : 'vertical';
            viewMode = landscape ? 'seamless-horizontal' : 'seamless-vertical';
            window.viewMode = viewMode;

            document.getElementById('normal-mode-content').style.display = 'none';

            // 自動再生ボタンを表示（左下固定）
            const autoplayButton = document.getElementById('autoplay-button-fixed');
            autoplayButton.classList.add('visible');
            autoplayButton.classList.add('show');

            // サブメニューボタンを表示
            updateSubmenuVisibility();

            // サブメニューオープンボタンも表示
            const submenuButton = document.getElementById('submenu-open-button');
            if (submenuButton && submenuButton.classList.contains('visible')) {
                submenuButton.classList.add('show');
            }

            // 画面の向きに応じて初期化
            if (landscape) {
                // 横長 → 横読みモード
                document.getElementById('seamless-container').classList.add('active');
                document.getElementById('vertical-container').classList.remove('active');
                initSeamlessMode();
                console.log('画面が横長のため、横読みモードで開始');
            } else {
                // 縦長 → 縦読みモード
                document.getElementById('seamless-container').classList.remove('active');
                document.getElementById('vertical-container').classList.add('active');
                initVerticalMode();
                console.log('画面が縦長のため、縦読みモードで開始');
            }

            // 読み方向ボタンの状態を更新
            updateDirectionButtons();

            // モード切り替えボタンの状態を更新
            updateModeSwitchButtons();
        }

        // 見開きモードに切り替え
        function switchToNormalMode() {
            if (viewMode === 'normal') {
                return; // 既に見開きモードの場合は何もしない
            }

            // UI要素のタイマーをリセット
            clearTimeout(uiControlsTimeout);
            uiControlsTimeout = setTimeout(() => {
                if (!isMouseOverUIControls) {
                    hideUIControls();
                }
            }, UI_CONTROLS_HIDE_DELAY);

            // 通常モードに切り替え
            viewMode = 'normal';
            window.viewMode = viewMode;
            document.getElementById('seamless-container').classList.remove('active');
            document.getElementById('vertical-container').classList.remove('active');
            document.getElementById('normal-mode-content').style.display = 'block';

            // 自動再生を停止して非表示
            if (autoplayEnabled) {
                toggleAutoplay();
            }
            // ズームレベルを標準に戻す
            if (zoomLevel !== 1) {
                setZoomLevel(1);
            }

            // 自動再生ボタンを非表示
            const autoplayButton = document.getElementById('autoplay-button-fixed');
            autoplayButton.classList.remove('visible');
            autoplayButton.classList.remove('show');

            // サブメニューボタンを非表示
            updateSubmenuVisibility();

            // 通常モードを再描画
            if (Module.ccall) {
                Module.ccall('refresh', null, [], []);
            }

            // モード切り替えボタンの状態を更新
            updateModeSwitchButtons();
        }

        // モード切り替えボタンの状態を更新（C++側に移動）
        function updateModeSwitchButtons() {
            Module.ccall('updateModeSwitchButtons', null, ['string'], [viewMode]);
            // onclickイベントは JavaScript 側で設定
            const seamlessButton = document.getElementById('seamless-mode-button');
            const normalButton = document.getElementById('normal-mode-button');

            if (viewMode === 'normal') {
                seamlessButton.onclick = switchToSeamlessMode;
                normalButton.onclick = null;
            } else {
                seamlessButton.onclick = null;
                normalButton.onclick = switchToNormalMode;
            }
        }

        // 横読み・縦読み切り替え
        function toggleDirection() {
            // 自動再生中の場合は停止
            if (autoplayEnabled) {
                toggleAutoplay();
            }

            if (seamlessDirection === 'horizontal') {
                // 縦読みに切り替え
                seamlessDirection = 'vertical';
                viewMode = 'seamless-vertical';
                window.viewMode = viewMode;
                document.getElementById('seamless-container').classList.remove('active');
                document.getElementById('vertical-container').classList.add('active');

                // 縦読みモードを初期化
                initVerticalMode();
            } else {
                // 横読みに切り替え
                seamlessDirection = 'horizontal';
                viewMode = 'seamless-horizontal';
                window.viewMode = viewMode;
                document.getElementById('seamless-container').classList.add('active');
                document.getElementById('vertical-container').classList.remove('active');

                // 横読みモードを初期化
                initSeamlessMode();
            }

            // 読み方向ボタンの状態を更新
            updateDirectionButtons();
        }

        // シームレスモード（横読み）の初期化
        function initSeamlessMode() {
            console.log('Initializing seamless horizontal mode...');
            const scrollContainer = document.getElementById('seamless-scroll');
            scrollContainer.innerHTML = ''; // クリア
            seamlessPages = [];

            // 右開きのため、ページを逆順で配置（20, 19, 18, ... 2, 1）
            for (let i = 20; i >= 1 && i <= MAX_PAGES; i--) {
                const canvas = createPageCanvas(i);
                scrollContainer.appendChild(canvas);
            }

            // スクロールイベントを設定
            const seamlessContainer = document.getElementById('seamless-container');
            seamlessContainer.addEventListener('scroll', onSeamlessScroll);

            // ドラッグスクロールを設定
            setupDragScroll(seamlessContainer);

            // 初期スクロール位置を一番右端（1ページ目）に設定
            setTimeout(() => {
                seamlessContainer.scrollLeft = seamlessContainer.scrollWidth - seamlessContainer.clientWidth;
                renderVisiblePages();
            }, 100);
        }

        // 縦読みモードの初期化
        function initVerticalMode() {
            console.log('Initializing vertical mode...');
            const scrollContainer = document.getElementById('vertical-scroll');
            scrollContainer.innerHTML = ''; // クリア
            verticalPages = [];

            // 縦に配置（1, 2, 3, ... 20）
            for (let i = 1; i <= 20 && i <= MAX_PAGES; i++) {
                const canvas = createVerticalPageCanvas(i);
                scrollContainer.appendChild(canvas);
            }

            // スクロールイベントを設定
            const verticalContainer = document.getElementById('vertical-container');
            verticalContainer.addEventListener('scroll', onVerticalScroll);

            // ドラッグスクロールを設定（縦方向）
            setupVerticalDragScroll(verticalContainer);

            // 初期スクロール位置を一番上（1ページ目）に設定
            setTimeout(() => {
                verticalContainer.scrollTop = 0;
                renderVerticalVisiblePages();
            }, 100);
        }

        // ドラッグでスクロールする機能（右から左へのスクロール）
        function setupDragScroll(container) {
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let scrollLeft = 0;
            let scrollTop = 0;
            let autoplayPausedByDrag = false;

            container.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.pageX - container.offsetLeft;
                startY = e.pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;
                container.style.cursor = 'grabbing';
                container.style.userSelect = 'none';
                container.style.scrollBehavior = 'auto'; // ドラッグ中はsmoothを無効化

                console.log(`[Horizontal] Drag start - scrollLeft: ${scrollLeft}, scrollTop: ${scrollTop}, zoomLevel: ${zoomLevel}`);

                // 自動再生中の場合は一時停止
                if (autoplayEnabled) {
                    autoplayPausedByDrag = true;
                    if (autoplayInterval) {
                        clearInterval(autoplayInterval);
                        autoplayInterval = null;
                    }
                }
            });

            container.addEventListener('mouseleave', () => {
                isDragging = false;
                container.style.cursor = 'grab';
                container.style.scrollBehavior = 'smooth'; // smoothに戻す
            });

            container.addEventListener('mouseup', () => {
                isDragging = false;
                container.style.cursor = 'grab';
                container.style.scrollBehavior = 'smooth'; // smoothに戻す

                // ドラッグで一時停止していた場合は再開
                if (autoplayPausedByDrag && autoplayEnabled) {
                    autoplayPausedByDrag = false;
                    startHorizontalAutoplay(container);
                }
            });

            container.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                const walkX = (x - startX) * 2; // スクロール速度を調整
                const walkY = (y - startY) * 2;

                // 左にドラッグでページが増える、右にドラッグでページが減る
                const newScrollLeft = scrollLeft - walkX;
                container.scrollLeft = newScrollLeft;
                console.log(`[Horizontal] Setting scrollLeft to ${newScrollLeft} (original: ${scrollLeft}, walkX: ${walkX})`);

                // 拡大・縮小表示時は縦方向にもスクロール
                if (zoomLevel !== 1) {
                    const newScrollTop = scrollTop - walkY;
                    container.scrollTop = newScrollTop;
                    console.log(`[Horizontal] Setting scrollTop to ${newScrollTop} (original: ${scrollTop}, walkY: ${walkY})`);
                }
            });

            // タッチイベント（モバイル対応）
            container.addEventListener('touchstart', (e) => {
                isDragging = true;
                startX = e.touches[0].pageX - container.offsetLeft;
                startY = e.touches[0].pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;

                // 自動再生中の場合は一時停止
                if (autoplayEnabled) {
                    autoplayPausedByDrag = true;
                    if (autoplayInterval) {
                        clearInterval(autoplayInterval);
                        autoplayInterval = null;
                    }
                }
            });

            container.addEventListener('touchend', () => {
                isDragging = false;

                // ドラッグで一時停止していた場合は再開
                if (autoplayPausedByDrag && autoplayEnabled) {
                    autoplayPausedByDrag = false;
                    startHorizontalAutoplay(container);
                }
            });

            container.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                const x = e.touches[0].pageX - container.offsetLeft;
                const y = e.touches[0].pageY - container.offsetTop;
                const walkX = (x - startX) * 2;
                const walkY = (y - startY) * 2;

                // 左にドラッグでページが増える、右にドラッグでページが減る
                container.scrollLeft = scrollLeft - walkX;

                // 拡大・縮小表示時は縦方向にもスクロール
                if (zoomLevel !== 1) {
                    container.scrollTop = scrollTop - walkY;
                }
            });

            // カーソルスタイルを設定
            container.style.cursor = 'grab';
        }

        // ページ用のCanvasを作成（横読み用）
        function createPageCanvas(pageNum) {
            // 既に存在する場合は既存のものを返す
            const existing = document.getElementById(`page-canvas-${pageNum}`);
            if (existing) {
                return existing;
            }

            const canvas = document.createElement('canvas');
            canvas.id = `page-canvas-${pageNum}`;
            canvas.className = 'page-canvas';
            canvas.dataset.pageNum = pageNum;
            canvas.dataset.loaded = 'false';

            // デバイスピクセル比を取得
            const dpr = window.devicePixelRatio || 1;

            // 一般的なマンガのアスペクト比（2:3）で初期サイズを設定（論理サイズ）
            // 表示倍率を適用
            const scale = zoomLevel;
            const canvasHeight = getViewportHeight() * scale;
            const canvasWidth = Math.floor(canvasHeight * (2 / 3));

            // 描画バッファサイズは物理ピクセル（高DPI対応）
            canvas.width = Math.floor(canvasWidth * dpr);
            canvas.height = Math.floor(canvasHeight * dpr);
            // CSSサイズは論理ピクセル
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';

            seamlessPages.push(pageNum);

            console.log(`Created horizontal canvas for page ${pageNum}, logical: ${canvasWidth}x${canvasHeight}, physical: ${canvas.width}x${canvas.height}, dpr: ${dpr}, scale: ${scale}`);

            return canvas;
        }

        // 縦読み用のCanvasを作成
        function createVerticalPageCanvas(pageNum) {
            // 既に存在する場合は既存のものを返す
            const existing = document.getElementById(`vertical-canvas-${pageNum}`);
            if (existing) {
                return existing;
            }

            const canvas = document.createElement('canvas');
            canvas.id = `vertical-canvas-${pageNum}`;
            canvas.className = 'vertical-page-canvas';
            canvas.dataset.pageNum = pageNum;
            canvas.dataset.loaded = 'false';

            // デバイスピクセル比を取得
            const dpr = window.devicePixelRatio || 1;

            // 一般的なマンガのアスペクト比（2:3）で初期サイズを設定（論理サイズ）
            // 表示倍率を適用
            const scale = zoomLevel;
            const canvasWidth = window.innerWidth * scale;
            const canvasHeight = Math.floor(canvasWidth * (3 / 2));

            // 描画バッファサイズは物理ピクセル（高DPI対応）
            canvas.width = Math.floor(canvasWidth * dpr);
            canvas.height = Math.floor(canvasHeight * dpr);
            // CSSサイズは論理ピクセル
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';

            verticalPages.push(pageNum);

            console.log(`Created vertical canvas for page ${pageNum}, logical: ${canvasWidth}x${canvasHeight}, physical: ${canvas.width}x${canvas.height}, dpr: ${dpr}, scale: ${scale}`);

            return canvas;
        }

        // シームレスモード（横読み）のスクロール処理
        let scrollTimeout;
        function onSeamlessScroll() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                loadMorePagesIfNeeded();
                renderVisiblePages();
            }, 100);
        }

        // 縦読みモードのスクロール処理
        let verticalScrollTimeout;
        function onVerticalScroll() {
            clearTimeout(verticalScrollTimeout);
            verticalScrollTimeout = setTimeout(() => {
                loadMoreVerticalPagesIfNeeded();
                renderVerticalVisiblePages();
            }, 100);
        }

        // 必要に応じてさらにページを読み込む
        function loadMorePagesIfNeeded() {
            if (!Module.ccall) return;

            const container = document.getElementById('seamless-container');
            const containerRect = container.getBoundingClientRect();

            // 現在表示されている最も小さいページ番号を見つける
            const allCanvases = Array.from(document.querySelectorAll('.page-canvas'));
            let minVisiblePage = MAX_PAGES;

            allCanvases.forEach(canvas => {
                const rect = canvas.getBoundingClientRect();
                // 表示範囲内または左側に近い場合
                if (rect.right > containerRect.left - containerRect.width) {
                    const pageNum = parseInt(canvas.dataset.pageNum);
                    if (pageNum < minVisiblePage) {
                        minVisiblePage = pageNum;
                    }
                }
            });

            // 表示中のページから先のページを追加で作成
            const nextPageStart = Math.min(...seamlessPages) - 1;
            const pagesToAdd = [];

            // 次の10ページ分のCanvasを作成（まだ存在しない場合）
            for (let i = nextPageStart; i > Math.max(1, nextPageStart - 10); i--) {
                if (i >= 1 && !document.getElementById(`page-canvas-${i}`)) {
                    pagesToAdd.push(i);
                }
            }

            // 降順でページを追加（大きい番号から小さい番号へ）
            pagesToAdd.sort((a, b) => b - a);
            pagesToAdd.forEach(pageNum => {
                const canvas = createPageCanvas(pageNum);
                // 先頭に追加（降順なので）
                const scrollContainer = document.getElementById('seamless-scroll');
                const firstChild = scrollContainer.firstChild;
                if (firstChild) {
                    scrollContainer.insertBefore(canvas, firstChild);
                } else {
                    scrollContainer.appendChild(canvas);
                }
                console.log(`Added canvas for page ${pageNum}`);

                // ページをキャッシュに読み込む
                Module.ccall('loadPageToCache', null, ['number'], [pageNum]);
            });
        }

        // 表示範囲内のページを描画
        function renderVisiblePages() {
            if (!Module.ccall) {
                console.log('Module.ccall not ready');
                return;
            }

            const container = document.getElementById('seamless-container');
            const scrollLeft = container.scrollLeft;
            const containerWidth = container.clientWidth;

            seamlessPages.forEach(pageNum => {
                const canvas = document.getElementById(`page-canvas-${pageNum}`);
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                // Canvasが表示範囲内にあるか確認（余裕を持たせる）
                const isVisible = rect.left < containerRect.right + containerWidth &&
                                rect.right > containerRect.left - containerWidth;

                if (isVisible && canvas.dataset.loaded === 'false') {
                    // ページを読み込んで描画
                    console.log(`Loading and rendering page ${pageNum} in seamless mode`);
                    canvas.dataset.loaded = 'loading';

                    // まずページをキャッシュに読み込む
                    Module.ccall('loadPageToCache', null, ['number'], [pageNum]);

                    // ページの読み込みを待ってから描画を試みる（リトライ機能付き）
                    let retryCount = 0;
                    const maxRetries = 10;
                    const tryRender = () => {
                        try {
                            Module.ccall('renderSinglePage', null, ['number', 'string'],
                                       [pageNum, `page-canvas-${pageNum}`]);
                            canvas.dataset.loaded = 'true';
                            console.log(`Successfully rendered page ${pageNum}`);
                        } catch (e) {
                            retryCount++;
                            if (retryCount < maxRetries) {
                                setTimeout(tryRender, 300);
                            } else {
                                console.error(`Gave up rendering page ${pageNum} after ${maxRetries} attempts`);
                                canvas.dataset.loaded = 'false';
                            }
                        }
                    };

                    setTimeout(tryRender, 200);
                }
            });
        }


        // 縦読みモード用：必要に応じてさらにページを読み込む
        function loadMoreVerticalPagesIfNeeded() {
            if (!Module.ccall) return;

            const container = document.getElementById('vertical-container');
            const containerHeight = container.clientHeight;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;

            // 下端に近づいたら次のページを追加
            if (scrollTop + containerHeight > scrollHeight - containerHeight * 2) {
                const nextPageStart = Math.max(...verticalPages) + 1;
                const pagesToAdd = [];

                // 次の10ページ分のCanvasを作成
                for (let i = nextPageStart; i < nextPageStart + 10 && i <= MAX_PAGES; i++) {
                    if (!document.getElementById(`vertical-canvas-${i}`)) {
                        pagesToAdd.push(i);
                    }
                }

                pagesToAdd.forEach(pageNum => {
                    const canvas = createVerticalPageCanvas(pageNum);
                    document.getElementById('vertical-scroll').appendChild(canvas);
                    console.log(`Added vertical canvas for page ${pageNum}`);

                    // ページをキャッシュに読み込む
                    Module.ccall('loadPageToCache', null, ['number'], [pageNum]);
                });
            }
        }

        // 縦読みモード：表示範囲内のページを描画
        function renderVerticalVisiblePages() {
            if (!Module.ccall) {
                console.log('Module.ccall not ready');
                return;
            }

            const container = document.getElementById('vertical-container');
            const containerRect = container.getBoundingClientRect();
            const containerHeight = container.clientHeight;

            verticalPages.forEach(pageNum => {
                const canvas = document.getElementById(`vertical-canvas-${pageNum}`);
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();

                // Canvasが表示範囲内にあるか確認（余裕を持たせる）
                const isVisible = rect.top < containerRect.bottom + containerHeight &&
                                rect.bottom > containerRect.top - containerHeight;

                if (isVisible && canvas.dataset.loaded === 'false') {
                    // ページを読み込んで描画
                    console.log(`Loading and rendering vertical page ${pageNum}`);
                    canvas.dataset.loaded = 'loading';

                    // まずページをキャッシュに読み込む
                    Module.ccall('loadPageToCache', null, ['number'], [pageNum]);

                    // ページの読み込みを待ってから描画を試みる
                    let retryCount = 0;
                    const maxRetries = 10;
                    const tryRender = () => {
                        try {
                            Module.ccall('renderSinglePage', null, ['number', 'string'],
                                       [pageNum, `vertical-canvas-${pageNum}`]);
                            canvas.dataset.loaded = 'true';
                            console.log(`Successfully rendered vertical page ${pageNum}`);
                        } catch (e) {
                            retryCount++;
                            if (retryCount < maxRetries) {
                                setTimeout(tryRender, 300);
                            } else {
                                console.error(`Gave up rendering vertical page ${pageNum} after ${maxRetries} attempts`);
                                canvas.dataset.loaded = 'false';
                            }
                        }
                    };

                    setTimeout(tryRender, 200);
                }
            });
        }

        // 縦ドラッグでスクロールする機能
        function setupVerticalDragScroll(container) {
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let scrollLeft = 0;
            let scrollTop = 0;
            let autoplayPausedByDrag = false;

            container.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.pageX - container.offsetLeft;
                startY = e.pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;
                container.style.cursor = 'grabbing';
                container.style.userSelect = 'none';
                container.style.scrollBehavior = 'auto'; // ドラッグ中はsmoothを無効化

                console.log(`[Vertical] Drag start - scrollLeft: ${scrollLeft}, scrollTop: ${scrollTop}, zoomLevel: ${zoomLevel}`);

                // 自動再生中の場合は一時停止
                if (autoplayEnabled) {
                    autoplayPausedByDrag = true;
                    if (autoplayInterval) {
                        clearInterval(autoplayInterval);
                        autoplayInterval = null;
                    }
                }
            });

            container.addEventListener('mouseleave', () => {
                isDragging = false;
                container.style.cursor = 'grab';
                container.style.scrollBehavior = 'smooth'; // smoothに戻す
            });

            container.addEventListener('mouseup', () => {
                isDragging = false;
                container.style.cursor = 'grab';
                container.style.scrollBehavior = 'smooth'; // smoothに戻す

                // ドラッグで一時停止していた場合は再開
                if (autoplayPausedByDrag && autoplayEnabled) {
                    autoplayPausedByDrag = false;
                    startVerticalAutoplay(container);
                }
            });

            container.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                const walkX = (x - startX) * 2; // スクロール速度を調整
                const walkY = (y - startY) * 2;

                const newScrollTop = scrollTop - walkY;
                container.scrollTop = newScrollTop;
                console.log(`[Vertical] Setting scrollTop to ${newScrollTop} (original: ${scrollTop}, walkY: ${walkY})`);

                // 拡大・縮小表示時は横方向にもスクロール
                if (zoomLevel !== 1) {
                    const newScrollLeft = scrollLeft - walkX;
                    container.scrollLeft = newScrollLeft;
                    console.log(`[Vertical] Setting scrollLeft to ${newScrollLeft} (original: ${scrollLeft}, walkX: ${walkX})`);
                }
            });

            // タッチイベント（モバイル対応）
            container.addEventListener('touchstart', (e) => {
                isDragging = true;
                startX = e.touches[0].pageX - container.offsetLeft;
                startY = e.touches[0].pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;
                container.style.scrollBehavior = 'auto'; // ドラッグ中はsmoothを無効化

                // 自動再生中の場合は一時停止
                if (autoplayEnabled) {
                    autoplayPausedByDrag = true;
                    if (autoplayInterval) {
                        clearInterval(autoplayInterval);
                        autoplayInterval = null;
                    }
                }
            });

            container.addEventListener('touchend', () => {
                isDragging = false;
                container.style.scrollBehavior = 'smooth'; // smoothに戻す

                // ドラッグで一時停止していた場合は再開
                if (autoplayPausedByDrag && autoplayEnabled) {
                    autoplayPausedByDrag = false;
                    startVerticalAutoplay(container);
                }
            });

            container.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                const x = e.touches[0].pageX - container.offsetLeft;
                const y = e.touches[0].pageY - container.offsetTop;
                const walkX = (x - startX) * 2;
                const walkY = (y - startY) * 2;

                const newScrollTop = scrollTop - walkY;
                container.scrollTop = newScrollTop;

                // 拡大・縮小表示時は横方向にもスクロール
                if (zoomLevel !== 1) {
                    const newScrollLeft = scrollLeft - walkX;
                    container.scrollLeft = newScrollLeft;
                }
            });

            // カーソルスタイルを設定
            container.style.cursor = 'grab';
        }

        // 自動再生の切り替え
        function toggleAutoplay() {
            // UI要素のタイマーをリセット
            clearTimeout(uiControlsTimeout);
            uiControlsTimeout = setTimeout(() => {
                if (!isMouseOverUIControls) {
                    hideUIControls();
                }
            }, UI_CONTROLS_HIDE_DELAY);

            const button = document.getElementById('autoplay-button-fixed');
            const textSpan = button.querySelector('span');

            if (!autoplayEnabled) {
                // 自動再生を開始
                autoplayEnabled = true;
                textSpan.textContent = '再生中';
                button.classList.add('playing');

                if (seamlessDirection === 'horizontal') {
                    const container = document.getElementById('seamless-container');
                    startHorizontalAutoplay(container);
                } else {
                    const container = document.getElementById('vertical-container');
                    startVerticalAutoplay(container);
                }

                console.log('自動再生を開始しました');
            } else {
                // 自動再生を停止
                autoplayEnabled = false;
                textSpan.textContent = '自動再生';
                button.classList.remove('playing');

                if (autoplayInterval) {
                    clearInterval(autoplayInterval);
                    autoplayInterval = null;
                }

                console.log('自動再生を停止しました');
            }
        }

        // 横読み自動再生を開始
        function startHorizontalAutoplay(container) {
            let frameCount = 0;
            autoplayInterval = setInterval(() => {
                if (container.scrollLeft > 0) {
                    // 左にスクロール（ページを読み進める）
                    container.scrollLeft -= AUTOPLAY_SPEED;

                    // 10フレームごとに新しいページを読み込む
                    frameCount++;
                    if (frameCount % 10 === 0) {
                        loadMorePagesIfNeeded();
                        renderVisiblePages();
                    }
                } else {
                    // 最後のページに到達したら自動再生を停止
                    console.log('最後のページに到達しました');
                    toggleAutoplay();
                }
            }, 1000 / AUTOPLAY_FPS);
        }

        // 縦読み自動再生を開始
        function startVerticalAutoplay(container) {
            let frameCount = 0;
            autoplayInterval = setInterval(() => {
                const maxScroll = container.scrollHeight - container.clientHeight;
                if (container.scrollTop < maxScroll) {
                    // 下にスクロール（ページを読み進める）
                    container.scrollTop += AUTOPLAY_SPEED;

                    // 10フレームごとに新しいページを読み込む
                    frameCount++;
                    if (frameCount % 10 === 0) {
                        loadMoreVerticalPagesIfNeeded();
                        renderVerticalVisiblePages();
                    }
                } else {
                    // 最後のページに到達したら自動再生を停止
                    console.log('最後のページに到達しました');
                    toggleAutoplay();
                }
            }, 1000 / AUTOPLAY_FPS);
        }

        // ズームレベル変更時の再描画処理
        function redrawZoomLevel() {
            if (seamlessDirection === 'horizontal') {
                // 横読みモードの場合：全Canvasをクリアして再作成
                const scrollContainer = document.getElementById('seamless-scroll');
                const currentScrollLeft = document.getElementById('seamless-container').scrollLeft;
                const previousZoomLevel = currentScrollLeft > 0 ?
                    (zoomLevel === 2 ? 1 : (zoomLevel === 0.5 ? 1 : zoomLevel)) : 1;

                // すべてのページの読み込み状態をリセット
                seamlessPages.forEach(pageNum => {
                    const canvas = document.getElementById(`page-canvas-${pageNum}`);
                    if (canvas) {
                        canvas.dataset.loaded = 'false';
                    }
                });

                // Canvasのサイズを再計算して再描画
                recreateHorizontalCanvases();

                // スクロール位置を調整（拡大率に応じて）
                setTimeout(() => {
                    const container = document.getElementById('seamless-container');
                    const scale = zoomLevel / previousZoomLevel;
                    container.scrollLeft = currentScrollLeft * scale;
                    renderVisiblePages();
                }, 100);
            } else {
                // 縦読みモードの場合：全Canvasをクリアして再作成
                const currentScrollTop = document.getElementById('vertical-container').scrollTop;
                const previousZoomLevel = currentScrollTop > 0 ?
                    (zoomLevel === 2 ? 1 : (zoomLevel === 0.5 ? 1 : zoomLevel)) : 1;

                // すべてのページの読み込み状態をリセット
                verticalPages.forEach(pageNum => {
                    const canvas = document.getElementById(`vertical-canvas-${pageNum}`);
                    if (canvas) {
                        canvas.dataset.loaded = 'false';
                    }
                });

                // Canvasのサイズを再計算して再描画
                recreateVerticalCanvases();

                // スクロール位置を調整
                setTimeout(() => {
                    const container = document.getElementById('vertical-container');
                    const scale = zoomLevel / previousZoomLevel;
                    container.scrollTop = currentScrollTop * scale;
                    renderVerticalVisiblePages();
                }, 100);
            }
        }

        // 横読みモードのCanvasを再作成
        function recreateHorizontalCanvases() {
            const dpr = window.devicePixelRatio || 1;
            const pages = [...seamlessPages];
            pages.forEach(pageNum => {
                const canvas = document.getElementById(`page-canvas-${pageNum}`);
                if (canvas) {
                    // Canvasのサイズを再計算（論理サイズ）
                    const scale = zoomLevel;
                    const canvasHeight = getViewportHeight() * scale;
                    const canvasWidth = Math.floor(canvasHeight * (2 / 3));

                    // 描画バッファサイズは物理ピクセル（高DPI対応）
                    canvas.width = Math.floor(canvasWidth * dpr);
                    canvas.height = Math.floor(canvasHeight * dpr);
                    // CSSサイズは論理ピクセル
                    canvas.style.width = canvasWidth + 'px';
                    canvas.style.height = canvasHeight + 'px';
                    canvas.dataset.loaded = 'false';
                }
            });
        }

        // 縦読みモードのCanvasを再作成
        function recreateVerticalCanvases() {
            const dpr = window.devicePixelRatio || 1;
            const pages = [...verticalPages];
            pages.forEach(pageNum => {
                const canvas = document.getElementById(`vertical-canvas-${pageNum}`);
                if (canvas) {
                    // Canvasのサイズを再計算（論理サイズ）
                    const scale = zoomLevel;
                    const canvasWidth = window.innerWidth * scale;
                    const canvasHeight = Math.floor(canvasWidth * (3 / 2));

                    // 描画バッファサイズは物理ピクセル（高DPI対応）
                    canvas.width = Math.floor(canvasWidth * dpr);
                    canvas.height = Math.floor(canvasHeight * dpr);
                    // CSSサイズは論理ピクセル
                    canvas.style.width = canvasWidth + 'px';
                    canvas.style.height = canvasHeight + 'px';
                    canvas.dataset.loaded = 'false';
                }
            });
        }

        // 全画面表示の切り替え
        function toggleFullscreen() {
            // UI要素のタイマーをリセット
            clearTimeout(uiControlsTimeout);
            uiControlsTimeout = setTimeout(() => {
                if (!isMouseOverUIControls) {
                    hideUIControls();
                }
            }, UI_CONTROLS_HIDE_DELAY);

            const container = document.getElementById('container');

            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                // 全画面モードに入る
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(err => {
                        console.error('全画面表示に失敗:', err);
                    });
                } else if (container.webkitRequestFullscreen) {
                    // Safari対応
                    container.webkitRequestFullscreen();
                } else if (container.msRequestFullscreen) {
                    // IE11対応
                    container.msRequestFullscreen();
                }
            } else {
                // 全画面モードから抜ける
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }

        // 全画面表示アイコンを更新（C++側に移動）
        function updateFullscreenIcon() {
            Module.ccall('updateFullscreenIcon', null, [], []);
        }

        // UI要素の自動表示/非表示管理
        let uiControlsTimeout;
        let isMouseOverUIControls = false;
        const UI_CONTROLS_HIDE_DELAY = 3000; // 3秒後に自動で非表示

        // UI要素を表示する関数（C++側に移動）
        function showUIControls() {
            Module.ccall('showUIControls', null, [], []);
        }

        // UI要素を非表示にする関数（C++側に移動）
        function hideUIControls() {
            Module.ccall('hideUIControls', null, [], []);
        }

        // ナビゲーションバーの自動表示/非表示管理
        let navBarTimeout;
        let isMouseOverNavBar = false;
        const NAV_BAR_ZONE_HEIGHT = 100; // 画面下部から何ピクセルの範囲で表示するか
        const NAV_BAR_HIDE_DELAY = 3000; // 3秒後に自動で非表示

        // 初期状態で非表示
        const navBar = document.getElementById('nav-bar');
        navBar.classList.add('hide');

        // ナビゲーションバーを表示する関数
        function showNavBar() {
            navBar.classList.remove('hide');
            navBar.classList.add('show');

            // 既存のタイマーをクリア
            clearTimeout(navBarTimeout);

            // 3秒後に自動で非表示にする（ナビゲーションバー上にマウスがない場合）
            navBarTimeout = setTimeout(() => {
                if (!isMouseOverNavBar) {
                    hideNavBar();
                }
            }, NAV_BAR_HIDE_DELAY);
        }

        // ナビゲーションバーを非表示にする関数
        function hideNavBar() {
            if (!isMouseOverNavBar) {
                navBar.classList.remove('show');
                navBar.classList.add('hide');
            }
        }

        // マウスムーブで画面下部に入ったら表示
        document.addEventListener('mousemove', function(e) {
            const windowHeight = getViewportHeight();
            const mouseY = e.clientY;

            // 画面下部のゾーンに入ったら表示
            if (mouseY > windowHeight - NAV_BAR_ZONE_HEIGHT) {
                showNavBar();
            }
        });

        // ナビゲーションバーにマウスが乗っている間は非表示にしない
        navBar.addEventListener('mouseenter', function() {
            isMouseOverNavBar = true;
            clearTimeout(navBarTimeout);
        });

        navBar.addEventListener('mouseleave', function() {
            isMouseOverNavBar = false;
            // マウスが離れたら3秒後に非表示
            navBarTimeout = setTimeout(() => {
                hideNavBar();
            }, NAV_BAR_HIDE_DELAY);
        });

        // 全画面モードの変化を検知（C++側のinitializeUIEventListenersで処理）

        // キーボードショートカット
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') {
                nextPage();
            } else if (e.key === 'ArrowRight') {
                prevPage();
            } else if (e.key === 'c' || e.key === 'C') {
                showCacheStatus();
            }
        });

        // 右クリックメニューを無効化（画像保存を防ぐ）
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });

        // ドラッグによる画像保存を防ぐ
        document.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });

        // スクリプトロードのエラーハンドリング
        window.addEventListener('error', function(e) {
            console.error('Script error:', e);
        });

        // ウィンドウリサイズ時に再描画 & モード自動切り替え
        let resizeTimer;
        let previousOrientation = window.innerWidth > getViewportHeight(); // 前回の画面の向きを記憶
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                console.log('Window resized, re-rendering...');

                const currentOrientation = window.innerWidth > getViewportHeight();

                if (viewMode !== 'normal') {
                    // シームレスモード中で、画面の向きが変わった場合は自動的にモードを切り替え
                    if (currentOrientation !== previousOrientation) {
                        console.log(`画面の向きが変わりました: ${currentOrientation ? '横長' : '縦長'}`);

                        // 自動再生中の場合は一時停止
                        const wasAutoplayEnabled = autoplayEnabled;
                        if (autoplayEnabled) {
                            toggleAutoplay();
                        }

                        if (currentOrientation) {
                            // 横長になった → 横読みモードに切り替え
                            if (seamlessDirection !== 'horizontal') {
                                seamlessDirection = 'horizontal';
                                viewMode = 'seamless-horizontal';
                                window.viewMode = viewMode;
                                document.getElementById('seamless-container').classList.add('active');
                                document.getElementById('vertical-container').classList.remove('active');
                                initSeamlessMode();
                                updateDirectionButtons();
                                console.log('横読みモードに自動切り替え');
                            }
                        } else {
                            // 縦長になった → 縦読みモードに切り替え
                            if (seamlessDirection !== 'vertical') {
                                seamlessDirection = 'vertical';
                                viewMode = 'seamless-vertical';
                                window.viewMode = viewMode;
                                document.getElementById('seamless-container').classList.remove('active');
                                document.getElementById('vertical-container').classList.add('active');
                                initVerticalMode();
                                updateDirectionButtons();
                                console.log('縦読みモードに自動切り替え');
                            }
                        }

                        // 自動再生が有効だった場合は再開
                        if (wasAutoplayEnabled) {
                            setTimeout(() => {
                                toggleAutoplay();
                            }, 500);
                        }

                        previousOrientation = currentOrientation;
                    }
                } else if (viewMode === 'normal') {
                    // 通常モード（見開きモード）の場合
                    if (currentOrientation !== previousOrientation && Module.ccall) {
                        // 画面の向きが変わった場合、1ページ/2ページモードを切り替え
                        const singlePage = !currentOrientation; // 縦長の場合は1ページモード
                        console.log(`通常モード: ${currentOrientation ? '2ページ表示（横長）' : '1ページ表示（縦長）'}に切り替え`);

                        try {
                            Module.ccall('setSinglePageMode', null, ['boolean'], [singlePage]);
                        } catch (e) {
                            console.error('Error in setSinglePageMode:', e);
                        }

                        previousOrientation = currentOrientation;
                    } else if (Module.ccall) {
                        // 画面の向きが変わっていない場合は再描画のみ
                        try {
                            Module.ccall('refresh', null, [], []);
                        } catch (e) {
                            console.error('Error in resize handler:', e);
                        }
                    }
                }
            }, 250);
        });
