/**
 * CineVerse Player Engine
 * Quản lý Trình phát thông minh HLS.js, Chuyển đổi Đa Server (Server 1 & 2),
 * Danh sách tập phim bộ với phân trang 50 tập, Khóa 5 phút VIP Paywall tích lũy,
 * và Tự động đồng bộ Lịch sử xem phim theo tập.
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
    const VIDSRC_URL = config.vidsrcUrl || '';
    const IS_LOGGED_IN = Boolean(config.isLoggedIn);
    let isVipUser = Boolean(config.isVipUser);
    const IS_MOVIE_VIP = Boolean(config.isMovieVip);
    let initialResumeSeconds = Number(config.initialResumeSeconds || 0);
    const MOVIE_RUNTIME_SECONDS = Number(config.runtimeSeconds || 7200);
    const HISTORY_EPISODE_NAME = config.historyEpisodeName ? String(config.historyEpisodeName).trim() : null;

    // Danh sách Server từ máy chủ
    const SERVERS = Array.isArray(config.servers) ? config.servers : [];
    let currentEpisodeIndex = Number(config.currentEpisodeIndex || 0);

    // Giới hạn 5 phút cho tài khoản miễn phí (300 giây) áp dụng CHO PHIM GẮN TAG VIP
    const FREE_LIMIT_SECONDS = 300;

    // Helper kiểm tra URL an toàn (chỉ chấp nhận http:// hoặc https://)
    function safeHttpUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return '';
    }

    // Lấy danh sách tập chuẩn từ server 1 (hoặc server 2)
    function getCanonicalEpisodes() {
        if (SERVERS[0]?.episodes?.length) return SERVERS[0].episodes;
        if (SERVERS[1]?.episodes?.length) return SERVERS[1].episodes;
        return [];
    }

    // Đếm tổng thời gian xem tích lũy để khóa VIP (KHÔNG bao giờ bị reset khi đổi tập)
    let totalVipWatchSeconds = 0;
    let currentEpisodeWatchedSeconds = Math.max(initialResumeSeconds, 0);
    let lastVideoTime = 0;

    // Helper kiểm tra có cần áp dụng khóa 5 phút VIP hay không
    function isLockEnforced() {
        return IS_MOVIE_VIP && !isVipUser && totalVipWatchSeconds >= FREE_LIMIT_SECONDS;
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
    const playerNotice = document.getElementById('playerNotice');
    const playerNoticeText = document.getElementById('playerNoticeText');
    const episodesGrid = document.getElementById('episodesGrid');
    const episodesTabs = document.getElementById('episodesTabs');

    let hlsInstance = null;
    let currentServer = M3U8_URL ? 1 : 2;
    let lastHistorySyncTime = 0;
    let iframeTimer = null;

    // Helper format thời gian mm:ss
    function formatTime(seconds) {
        const sec = Math.floor(seconds || 0);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Hiển thị / Ẩn thông báo máy chủ
    function showNotice(msg) {
        if (playerNotice && playerNoticeText) {
            playerNoticeText.textContent = msg;
            playerNotice.style.display = 'flex';
        }
    }

    function hideNotice() {
        if (playerNotice) {
            playerNotice.style.display = 'none';
        }
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
    function initHlsPlayer(sourceUrl) {
        const urlToLoad = safeHttpUrl(sourceUrl || M3U8_URL);
        if (!urlToLoad || !video) return;

        if (window.Hls && window.Hls.isSupported()) {
            if (hlsInstance) {
                hlsInstance.destroy();
            }
            hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            hlsInstance.loadSource(urlToLoad);
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
            video.src = urlToLoad;
        }
    }

    // 3. Logic VIP & Giới hạn 5 phút (300 giây) tích lũy trên Server 1
    function attachPaywallListeners() {
        if (!video) return;

        video.addEventListener('timeupdate', function() {
            const current = video.currentTime || 0;
            const delta = current - lastVideoTime;
            if (delta > 0 && delta < 2) {
                totalVipWatchSeconds += delta;
            }
            lastVideoTime = current;
            currentEpisodeWatchedSeconds = Math.floor(current);

            if (isLockEnforced()) {
                video.pause();
                showVipPaywall();
            }
            checkAndSyncHistory();
        });

        video.addEventListener('play', function() {
            lastVideoTime = video.currentTime || 0;
            if (isLockEnforced()) {
                video.pause();
                showVipPaywall();
            }
        });

        video.addEventListener('seeking', function() {
            if (isLockEnforced()) {
                video.pause();
                showVipPaywall();
            }
        });
    }

    // Bộ đếm theo dõi thời gian xem trên Server 2 (Iframe)
    function startIframeWatchTracking() {
        stopIframeWatchTracking();
        iframeTimer = setInterval(function() {
            totalVipWatchSeconds++;
            currentEpisodeWatchedSeconds++;

            // Khóa VIP 5 phút tích lũy trên Server 2
            if (isLockEnforced()) {
                stopIframeWatchTracking();
                if (iframe) {
                    iframe.style.display = 'none';
                }
                showVipPaywall();
                return;
            }

            // Định kỳ lưu Watch History trên Server 2 mỗi 12 giây
            if (IS_LOGGED_IN && (currentEpisodeWatchedSeconds - lastHistorySyncTime >= 12)) {
                syncWatchHistory(currentEpisodeWatchedSeconds, MOVIE_RUNTIME_SECONDS);
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
            : Math.floor((video && video.currentTime) || currentEpisodeWatchedSeconds || 0);
        const duration = explicitDuration !== undefined
            ? Math.floor(explicitDuration)
            : ((video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS);

        if (current < 5) return;

        const episodes = getCanonicalEpisodes();
        const currentEp = episodes[currentEpisodeIndex];
        const episodeName = currentEp ? currentEp.name : (HISTORY_EPISODE_NAME || 'Tập 1');

        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movieId: MOVIE_ID,
                    movieTitle: MOVIE_TITLE,
                    posterUrl: POSTER_URL,
                    episode: episodeName,
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
        const current = currentServer === 1 ? Math.floor((video && video.currentTime) || 0) : currentEpisodeWatchedSeconds;
        if (Math.abs(current - lastHistorySyncTime) >= 12) {
            syncWatchHistory(current, (video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS);
        }
    }

    // Gửi ngầm vị trí xem khi người dùng tắt tab hoặc chuyển trang
    window.addEventListener('beforeunload', function() {
        if (!IS_LOGGED_IN) return;
        const current = currentServer === 1 
            ? Math.floor((video && video.currentTime) || currentEpisodeWatchedSeconds || 0)
            : currentEpisodeWatchedSeconds;
        const duration = (video && video.duration) ? Math.floor(video.duration) : MOVIE_RUNTIME_SECONDS;
        if (current < 5) return;

        const episodes = getCanonicalEpisodes();
        const currentEp = episodes[currentEpisodeIndex];
        const episodeName = currentEp ? currentEp.name : (HISTORY_EPISODE_NAME || 'Tập 1');

        const payload = JSON.stringify({
            movieId: MOVIE_ID,
            movieTitle: MOVIE_TITLE,
            posterUrl: POSTER_URL,
            episode: episodeName,
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

    // 5. Gợi ý Tiếp tục xem (Resume Playback) - Chỉ áp dụng cho đúng tập lưu trong lịch sử
    function setupResumePrompt() {
        const episodes = getCanonicalEpisodes();
        const currentEp = episodes[currentEpisodeIndex];
        const isTargetEpisode = !HISTORY_EPISODE_NAME || (currentEp && currentEp.name === HISTORY_EPISODE_NAME);

        if (!isTargetEpisode || initialResumeSeconds < 10) return;

        if (isLockEnforced()) {
            showVipPaywall();
            return;
        }

        if (resumeBanner && resumeTimeText) {
            resumeTimeText.textContent = formatTime(initialResumeSeconds);
            resumeBanner.style.display = 'inline-flex';

            if (btnResumeYes) {
                btnResumeYes.addEventListener('click', function() {
                    currentEpisodeWatchedSeconds = initialResumeSeconds;
                    if (currentServer === 1 && video) {
                        video.currentTime = initialResumeSeconds;
                        video.play().catch(function() {});
                    }
                    resumeBanner.style.display = 'none';
                });
            }

            if (btnResumeNo) {
                btnResumeNo.addEventListener('click', function() {
                    currentEpisodeWatchedSeconds = 0;
                    if (video) video.currentTime = 0;
                    resumeBanner.style.display = 'none';
                });
            }

            setTimeout(function() {
                if (resumeBanner) resumeBanner.style.display = 'none';
            }, 10000);
        }
    }

    // 6. Tải nguồn phát cho tập hiện tại
    function loadCurrentEpisodeSource(autoPlay) {
        hideNotice();

        if (currentServer === 1) {
            const s1 = SERVERS[0];
            const s1Ep = s1?.episodes?.[currentEpisodeIndex];
            const m3u8Url = safeHttpUrl(s1Ep?.m3u8);
            const embedUrl = safeHttpUrl(s1Ep?.embed);

            if (m3u8Url) {
                stopIframeWatchTracking();
                if (iframe) {
                    iframe.src = 'about:blank';
                    iframe.style.display = 'none';
                }
                if (video) {
                    video.style.display = 'block';
                    if (window.Hls && window.Hls.isSupported()) {
                        if (hlsInstance) {
                            hlsInstance.loadSource(m3u8Url);
                        } else {
                            initHlsPlayer(m3u8Url);
                        }
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = m3u8Url;
                    }
                    video.currentTime = 0;
                    lastVideoTime = 0;
                    if (autoPlay) {
                        video.play().catch(function() {});
                    }
                }
            } else if (embedUrl) {
                // Fallback embed trên Server 1
                if (video) {
                    video.pause();
                    video.style.display = 'none';
                }
                if (iframe) {
                    if (iframe.src !== embedUrl) iframe.src = embedUrl;
                    iframe.style.display = 'block';
                }
                startIframeWatchTracking();
            } else {
                if (video) {
                    video.pause();
                    video.style.display = 'none';
                }
                if (iframe) {
                    iframe.src = 'about:blank';
                    iframe.style.display = 'none';
                }
                stopIframeWatchTracking();
                showNotice('Tập này chưa có nguồn ở Server 1. Vui lòng chuyển sang Server 2.');
            }
        } else if (currentServer === 2) {
            const s2 = SERVERS[1];
            const canonEps = getCanonicalEpisodes();
            const currEpName = canonEps[currentEpisodeIndex]?.name || '';

            let s2Ep = null;
            if (s2?.episodes?.length) {
                s2Ep = s2.episodes.find(function(e) {
                    return e.name && currEpName && e.name.trim().toLowerCase() === currEpName.trim().toLowerCase();
                });
                if (!s2Ep) {
                    s2Ep = s2.episodes[currentEpisodeIndex] || s2.episodes[s2.episodes.length - 1];
                }
            }

            const s2Url = safeHttpUrl(s2Ep?.embed || s2Ep?.m3u8 || SERVERS[0]?.episodes?.[currentEpisodeIndex]?.embed || VIDSRC_URL);

            if (s2Url) {
                if (video) {
                    video.pause();
                    video.style.display = 'none';
                }
                if (iframe) {
                    if (iframe.src !== s2Url) iframe.src = s2Url;
                    iframe.style.display = 'block';
                }
                startIframeWatchTracking();
            } else {
                if (video) {
                    video.pause();
                    video.style.display = 'none';
                }
                if (iframe) {
                    iframe.src = 'about:blank';
                    iframe.style.display = 'none';
                }
                stopIframeWatchTracking();
                showNotice('Tập này chưa có nguồn ở Server 2. Vui lòng chuyển sang Server 1.');
            }
        }
    }

    // 7. Chuyển tập phim (playEpisode)
    function playEpisode(index) {
        const episodes = getCanonicalEpisodes();
        const targetIdx = parseInt(index, 10);
        if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= episodes.length) return;

        currentEpisodeIndex = targetIdx;

        // Cập nhật trạng thái active trên giao diện tập phim
        if (episodesGrid) {
            const btns = episodesGrid.querySelectorAll('.episode-btn');
            btns.forEach(function(b) {
                const bIdx = parseInt(b.getAttribute('data-index'), 10);
                b.classList.toggle('active', bIdx === currentEpisodeIndex);
            });
        }

        // Đổi tập không được reset bộ đếm VIP tích lũy, chỉ reset thời gian xem tập hiện tại
        currentEpisodeWatchedSeconds = 0;
        lastVideoTime = 0;

        if (isLockEnforced()) {
            if (video) video.pause();
            if (iframe) iframe.style.display = 'none';
            showVipPaywall();
            return;
        }

        loadCurrentEpisodeSource(true);

        // Lưu lịch sử xem khi người dùng chuyển sang tập mới
        if (IS_LOGGED_IN) {
            syncWatchHistory(0, MOVIE_RUNTIME_SECONDS);
        }
    }

    // 8. Chuyển Server mượt mà (Không tải lại trang, giữ nguyên tập hiện tại)
    function switchToServer(serverNum) {
        const prevServer = currentServer;
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

        // Khớp tập ở server đích
        const targetServer = SERVERS[serverNum - 1];
        const sourceServer = SERVERS[prevServer - 1];
        const sourceEp = sourceServer?.episodes?.[currentEpisodeIndex];

        if (targetServer?.episodes?.length) {
            let matchedIdx = -1;
            if (sourceEp?.name) {
                matchedIdx = targetServer.episodes.findIndex(function(ep) {
                    return ep.name && ep.name.trim().toLowerCase() === sourceEp.name.trim().toLowerCase();
                });
            }

            if (matchedIdx === -1 && targetServer.episodes[currentEpisodeIndex]) {
                matchedIdx = currentEpisodeIndex;
            }

            if (matchedIdx === -1) {
                matchedIdx = targetServer.episodes.length - 1;
                showNotice('Server ' + serverNum + ' không có tập này, đã chuyển sang ' + (targetServer.episodes[matchedIdx]?.name || 'tập gần nhất'));
            }

            currentEpisodeIndex = matchedIdx;

            // Đồng bộ trạng thái active của nút tập trên UI
            if (episodesGrid) {
                const btns = episodesGrid.querySelectorAll('.episode-btn');
                btns.forEach(function(b) {
                    const bIdx = parseInt(b.getAttribute('data-index'), 10);
                    b.classList.toggle('active', bIdx === currentEpisodeIndex);
                });
            }
        }

        if (isLockEnforced()) {
            if (video) video.pause();
            if (iframe) iframe.style.display = 'none';
            showVipPaywall();
            return;
        }

        hideVipPaywall();
        loadCurrentEpisodeSource(true);
    }

    // 9. Vẽ lại các nút tập cho tab 50 tập (dùng createElement + textContent)
    function renderEpisodeTab(tabIndex) {
        if (!episodesGrid) return;
        const episodes = getCanonicalEpisodes();
        const start = tabIndex * 50;
        const end = Math.min(start + 50, episodes.length);

        // Cập nhật tab active
        if (episodesTabs) {
            const tabBtns = episodesTabs.querySelectorAll('.episodes-tab-btn');
            tabBtns.forEach(function(b) {
                const bIdx = parseInt(b.getAttribute('data-tab-index'), 10);
                const isActive = bIdx === tabIndex;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
        }

        // Xóa sạch các nút của tab cũ
        while (episodesGrid.firstChild) {
            episodesGrid.removeChild(episodesGrid.firstChild);
        }

        // Tạo mới đúng 50 nút bằng createElement và textContent
        for (let i = start; i < end; i++) {
            const ep = episodes[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'episode-btn' + (i === currentEpisodeIndex ? ' active' : '');
            btn.setAttribute('data-index', String(i));
            btn.textContent = ep.name || ('Tập ' + (i + 1));
            episodesGrid.appendChild(btn);
        }
    }

    // 10. Gắn Event Delegation cho Lưới tập phim & Thanh tab
    function setupEpisodeListeners() {
        if (episodesGrid) {
            episodesGrid.addEventListener('click', function(e) {
                const btn = e.target.closest('.episode-btn');
                if (!btn) return;
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                if (!isNaN(idx)) {
                    playEpisode(idx);
                }
            });
        }

        if (episodesTabs) {
            episodesTabs.addEventListener('click', function(e) {
                const tabBtn = e.target.closest('.episodes-tab-btn');
                if (!tabBtn) return;
                const tabIdx = parseInt(tabBtn.getAttribute('data-tab-index'), 10);
                if (!isNaN(tabIdx)) {
                    renderEpisodeTab(tabIdx);
                }
            });
        }
    }

    // Gán ra window để tương thích với các lệnh gọi hoặc test bên ngoài
    window.switchToServer = switchToServer;
    window.playEpisode = playEpisode;

    // 11. Xử lý Nút Nâng Cấp VIP (Kích hoạt nhanh / Instant Upgrade)
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

                    loadCurrentEpisodeSource(true);
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

    // 12. Xử lý Nút Xem Lại Từ Đầu
    if (btnRewatchStart) {
        btnRewatchStart.addEventListener('click', function() {
            totalVipWatchSeconds = 0;
            currentEpisodeWatchedSeconds = 0;
            hideVipPaywall();
            loadCurrentEpisodeSource(true);
        });
    }

    // 13. Khởi chạy khi DOM sẵn sàng
    function bootPlayer() {
        setupEpisodeListeners();
        attachPaywallListeners();
        setupResumePrompt();

        const s1Ep = SERVERS[0]?.episodes?.[currentEpisodeIndex];
        const m3u8Url = safeHttpUrl(s1Ep?.m3u8 || M3U8_URL);

        if (m3u8Url) {
            initHlsPlayer(m3u8Url);
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
