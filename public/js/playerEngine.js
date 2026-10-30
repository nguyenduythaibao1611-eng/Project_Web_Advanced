/**
 * CineVerse Player Engine
 * Quản lý Trình phát thông minh HLS.js, Chuyển đổi Đa Server (Server 1 & 2),
 * Khóa 5 phút VIP Paywall trên cả 2 server, và Tự động đồng bộ Lịch sử xem phim.
 */
(function() {
    'use strict';

    // 1. Đọc dữ liệu cấu hình từ thẻ JSON nhúng an toàn
    const configEl = document.getElementById('playerConfig');
    if (!configEl) {
        return;
    }

    let config;
    try {
        config = JSON.parse(configEl.textContent || '{}');
    } catch (e) {
        console.error('[PlayerEngine] Lỗi đọc cấu hình player:', e);
        return;
    }

    const MOVIE_ID = config.movieId || '';
    const MOVIE_TITLE = config.movieTitle || '';
    const POSTER_URL = config.posterUrl || '';
    const M3U8_URL = config.m3u8Url || '';
    const EMBED_URL = config.embedUrl || '';
    const VIDSRC_URL = config.vidsrcUrl || '';
    const IS_LOGGED_IN = Boolean(config.isLoggedIn);
    let isVipUser = Boolean(config.isVipUser);
    const IS_MOVIE_VIP = Boolean(config.isMovieVip);
    let initialResumeSeconds = Number(config.initialResumeSeconds || 0);
    const MOVIE_RUNTIME_SECONDS = Number(config.runtimeSeconds || 7200);

    // Giới hạn 5 phút cho tài khoản miễn phí (300 giây) áp dụng CHO PHIM GẮN TAG VIP
    const FREE_LIMIT_SECONDS = 300;

    // Helper kiểm tra có cần áp dụng khóa 5 phút VIP hay không
    function isLockEnforced(seconds) {
        return IS_MOVIE_VIP && !isVipUser && seconds >= FREE_LIMIT_SECONDS;
    }

    // Elements
    const video = document.getElementById('cineversePlayer');
    const iframe = document.getElementById('fallbackPlayer');
    const paywallOverlay = document.getElementById('vipPaywallOverlay');
    const resumeBanner = document.getElementById('resumeBanner');
    const resumeTimeText = document.getElementById('resumeTimeText');
    const btnResumeYes = document.getElementById('btnResumeYes');
    const btnResumeNo = document.getElementById('btnResumeNo');
    const btnUpgradeVip = document.getElementById('btnUpgradeVip');
    const btnRewatchStart = document.getElementById('btnRewatchStart');
    const btnServer1 = document.getElementById('btnServer1');
    const btnServer2 = document.getElementById('btnServer2');

    let hlsInstance = null;
    let currentServer = M3U8_URL ? 1 : 2;
    let lastHistorySyncTime = 0;
    let iframeTimer = null;
    let currentWatchedSeconds = Math.max(initialResumeSeconds, 0);

    // Helper format thời gian mm:ss
    function formatTime(seconds) {
        const sec = Math.floor(seconds || 0);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Hiển thị Paywall
    function showVipPaywall() {
        if (paywallOverlay) {
            paywallOverlay.style.display = 'flex';
        }
    }

    // Ẩn Paywall
    function hideVipPaywall() {
        if (paywallOverlay) {
            paywallOverlay.style.display = 'none';
        }
    }

    // 2. Khởi tạo HLS.js cho Server 1
    function initHlsPlayer() {
        if (!M3U8_URL || !video) return;

        if (window.Hls && window.Hls.isSupported()) {
            if (hlsInstance) {
                hlsInstance.destroy();
            }
            hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            hlsInstance.loadSource(M3U8_URL);
            hlsInstance.attachMedia(video);

            hlsInstance.on(window.Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            console.warn('[HLS] Lỗi mạng, đang thử nạp lại...');
                            hlsInstance.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            console.warn('[HLS] Lỗi media, đang khôi phục luồng...');
                            hlsInstance.recoverMediaError();
                            break;
                        default:
                            console.error('[HLS] Lỗi nghiêm trọng:', data);
                            hlsInstance.destroy();
                            switchToServer(2);
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = M3U8_URL;
        }
    }

    // 3. Logic VIP & Giới hạn 5 phút (300 giây) cho tài khoản Free trên Server 1
    function attachPaywallListeners() {
        if (!video) return;

        video.addEventListener('timeupdate', function() {
            currentWatchedSeconds = Math.max(currentWatchedSeconds, Math.floor(video.currentTime || 0));
            if (isLockEnforced(video.currentTime)) {
                video.pause();
                video.currentTime = FREE_LIMIT_SECONDS;
                showVipPaywall();
            }
            checkAndSyncHistory();
        });

        video.addEventListener('seeking', function() {
            if (isLockEnforced(video.currentTime)) {
                video.currentTime = FREE_LIMIT_SECONDS;
                video.pause();
                showVipPaywall();
            }
        });

        video.addEventListener('seeked', function() {
            if (isLockEnforced(video.currentTime)) {
                video.currentTime = FREE_LIMIT_SECONDS;
                video.pause();
                showVipPaywall();
            }
        });

        video.addEventListener('play', function() {
            if (isLockEnforced(video.currentTime)) {
                video.pause();
                video.currentTime = FREE_LIMIT_SECONDS;
                showVipPaywall();
            }
        });
    }

    // Bộ đếm theo dõi thời gian xem trên Server 2 (Iframe)
    function startIframeWatchTracking() {
        stopIframeWatchTracking();
        iframeTimer = setInterval(function() {
            currentWatchedSeconds++;

            // Khóa VIP 5 phút (300 giây) trên Server 2 cho tài khoản Free nếu là phim VIP
            if (isLockEnforced(currentWatchedSeconds)) {
                stopIframeWatchTracking();
                if (iframe) {
                    iframe.style.display = 'none';
                }
                showVipPaywall();
                return;
            }

            // Định kỳ lưu Watch History trên Server 2 mỗi 12 giây
            if (IS_LOGGED_IN && (currentWatchedSeconds - lastHistorySyncTime >= 12)) {
                syncWatchHistory(currentWatchedSeconds, MOVIE_RUNTIME_SECONDS);
            }
        }, 1000);
    }

    function stopIframeWatchTracking() {
        if (iframeTimer) {
            clearInterval(iframeTimer);
            iframeTimer = null;
        }
    }

    // 4. API & Đồng bộ Lịch sử xem (Watch History)
    async function syncWatchHistory(explicitCurrent, explicitDuration) {
        if (!IS_LOGGED_IN) return;
        const current = explicitCurrent !== undefined
            ? Math.floor(explicitCurrent)
            : Math.floor((video && video.currentTime) || currentWatchedSeconds || 0);
        const duration = explicitDuration !== undefined
            ? Math.floor(explicitDuration)
            : ((video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS);

        if (current < 5) return;

        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movieId: MOVIE_ID,
                    movieTitle: MOVIE_TITLE,
                    posterUrl: POSTER_URL,
                    episode: 'Tập 1',
                    currentTime: current,
                    duration: duration
                })
            });
            lastHistorySyncTime = current;
        } catch (err) {
            console.warn('[History] Không thể đồng bộ lịch sử xem:', err.message);
        }
    }

    function checkAndSyncHistory() {
        if (!IS_LOGGED_IN) return;
        const current = currentServer === 1 ? Math.floor((video && video.currentTime) || 0) : currentWatchedSeconds;
        if (Math.abs(current - lastHistorySyncTime) >= 12) {
            syncWatchHistory(current, (video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS);
        }
    }

    // Gửi ngầm vị trí xem khi người dùng tắt tab hoặc chuyển trang
    window.addEventListener('beforeunload', function() {
        if (!IS_LOGGED_IN) return;
        const current = currentServer === 1 
            ? Math.floor((video && video.currentTime) || currentWatchedSeconds || 0)
            : currentWatchedSeconds;
        const duration = (video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS;
        if (current < 5) return;

        const payload = JSON.stringify({
            movieId: MOVIE_ID,
            movieTitle: MOVIE_TITLE,
            posterUrl: POSTER_URL,
            episode: 'Tập 1',
            currentTime: current,
            duration: duration
        });

        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon('/api/history', blob);
        } else {
            fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            });
        }
    });

    // 5. Gợi ý Tiếp tục xem (Resume Playback)
    function setupResumePrompt() {
        if (initialResumeSeconds < 10) return;

        if (isLockEnforced(initialResumeSeconds)) {
            initialResumeSeconds = FREE_LIMIT_SECONDS;
            showVipPaywall();
            return;
        }

        if (resumeBanner && resumeTimeText) {
            resumeTimeText.textContent = formatTime(initialResumeSeconds);
            resumeBanner.style.display = 'inline-flex';

            if (btnResumeYes) {
                btnResumeYes.addEventListener('click', function() {
                    currentWatchedSeconds = initialResumeSeconds;
                    if (currentServer === 1 && video) {
                        video.currentTime = initialResumeSeconds;
                        video.play().catch(function() {});
                    }
                    resumeBanner.style.display = 'none';
                });
            }

            if (btnResumeNo) {
                btnResumeNo.addEventListener('click', function() {
                    currentWatchedSeconds = 0;
                    if (video) video.currentTime = 0;
                    resumeBanner.style.display = 'none';
                });
            }

            setTimeout(function() {
                if (resumeBanner) resumeBanner.style.display = 'none';
            }, 10000);
        }
    }

    // 6. Xử lý Chuyển Server mượt mà (Không tải lại trang)
    function switchToServer(serverNum) {
        currentServer = serverNum;

        if (btnServer1) {
            btnServer1.classList.toggle('active', serverNum === 1);
            const ind1 = btnServer1.querySelector('.server-indicator');
            if (ind1) ind1.classList.toggle('live', serverNum === 1);
        }
        if (btnServer2) {
            btnServer2.classList.toggle('active', serverNum === 2);
            const ind2 = btnServer2.querySelector('.server-indicator');
            if (ind2) ind2.classList.toggle('live', serverNum === 2);
        }

        if (serverNum === 1) {
            stopIframeWatchTracking();
            if (iframe) {
                iframe.src = 'about:blank';
                iframe.style.display = 'none';
            }
            if (video) {
                video.style.display = 'block';
                if (!hlsInstance && !video.src) {
                    initHlsPlayer();
                }

                if (currentWatchedSeconds > 0 && Math.abs(video.currentTime - currentWatchedSeconds) > 3) {
                    video.currentTime = (IS_MOVIE_VIP && !isVipUser)
                        ? Math.min(currentWatchedSeconds, FREE_LIMIT_SECONDS)
                        : currentWatchedSeconds;
                }

                if (isLockEnforced(video.currentTime) || isLockEnforced(currentWatchedSeconds)) {
                    showVipPaywall();
                } else {
                    hideVipPaywall();
                }
            }
        } else if (serverNum === 2) {
            if (video) {
                currentWatchedSeconds = Math.max(currentWatchedSeconds, Math.floor(video.currentTime || 0));
                video.pause();
                video.style.display = 'none';
            }

            // Kiểm tra ngay giới hạn 5 phút VIP trên Server 2 nếu là phim VIP
            if (isLockEnforced(currentWatchedSeconds)) {
                if (iframe) iframe.style.display = 'none';
                showVipPaywall();
                return;
            }

            hideVipPaywall();

            if (iframe) {
                const targetUrl = EMBED_URL || VIDSRC_URL;
                if (targetUrl && iframe.src !== targetUrl) {
                    iframe.src = targetUrl;
                }
                iframe.style.display = 'block';
            }

            startIframeWatchTracking();
        }
    }

    // Gán ra window để tương thích với thuộc tính onclick="switchToServer(...)"
    window.switchToServer = switchToServer;

    // 7. Xử lý Nút Nâng Cấp VIP (Kích hoạt nhanh / Instant Upgrade)
    if (btnUpgradeVip) {
        btnUpgradeVip.addEventListener('click', async function() {
            if (!IS_LOGGED_IN) {
                window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + '#player');
                return;
            }

            btnUpgradeVip.disabled = true;
            btnUpgradeVip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kích hoạt VIP...';

            try {
                const response = await fetch('/api/auth/upgrade-vip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const result = await response.json();

                if (result.success) {
                    isVipUser = true;
                    hideVipPaywall();

                    const heroMeta = document.querySelector('.hero-meta');
                    if (heroMeta && !heroMeta.querySelector('.badge-vip-pill')) {
                        const vipBadge = document.createElement('span');
                        vipBadge.className = 'badge-vip-pill';
                        vipBadge.innerHTML = '<i class="fa-solid fa-crown"></i> VIP';
                        heroMeta.appendChild(vipBadge);
                    }

                    if (typeof window.showToast === 'function') {
                        window.showToast(result.message || 'Chúc mừng! Bạn đã là thành viên VIP.', 'success');
                    }

                    if (currentServer === 2) {
                        if (iframe) {
                            const targetUrl = EMBED_URL || VIDSRC_URL;
                            if (iframe.src === 'about:blank' || !iframe.src) iframe.src = targetUrl;
                            iframe.style.display = 'block';
                        }
                        startIframeWatchTracking();
                    } else if (video) {
                        video.play().catch(function() {});
                    }
                } else {
                    alert(result.message || 'Không thể kích hoạt VIP lúc này. Vui lòng thử lại sau.');
                    btnUpgradeVip.disabled = false;
                    btnUpgradeVip.innerHTML = '<i class="fa-solid fa-bolt"></i> NÂNG CẤP VIP NGAY (KÍCH HOẠT NHANH)';
                }
            } catch (err) {
                console.error('Lỗi nâng cấp VIP:', err);
                btnUpgradeVip.disabled = false;
                btnUpgradeVip.innerHTML = '<i class="fa-solid fa-bolt"></i> NÂNG CẤP VIP NGAY (KÍCH HOẠT NHANH)';
            }
        });
    }

    // 8. Xử lý Nút Xem Lại Từ Đầu
    if (btnRewatchStart) {
        btnRewatchStart.addEventListener('click', function() {
            currentWatchedSeconds = 0;
            if (currentServer === 2) {
                hideVipPaywall();
                if (iframe) {
                    const targetUrl = EMBED_URL || VIDSRC_URL;
                    iframe.src = targetUrl;
                    iframe.style.display = 'block';
                }
                startIframeWatchTracking();
            } else if (video) {
                video.currentTime = 0;
                hideVipPaywall();
                video.play().catch(function() {});
            }
        });
    }

    // 9. Khởi chạy khi DOM sẵn sàng
    function bootPlayer() {
        if (M3U8_URL) {
            initHlsPlayer();
            attachPaywallListeners();
            setupResumePrompt();
        } else if (currentServer === 2) {
            switchToServer(2);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootPlayer);
    } else {
        bootPlayer();
    }
})();
