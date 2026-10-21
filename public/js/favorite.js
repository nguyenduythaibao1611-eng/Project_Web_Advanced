/* eslint-disable */
/**
 * favorite.js - Xử lý tính năng thêm/xóa phim yêu thích bằng dấu sao
 */

document.addEventListener('DOMContentLoaded', () => {
    const favoritedIds = new Set();

    // 1. Cập nhật số lượng phim yêu thích trên Header Badge
    function updateBadge(count) {
        const badge = document.getElementById('favCountBadge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // 2. Đồng bộ trạng thái ngôi sao trên toàn bộ các thẻ phim đang có trên màn hình
    function syncButtons() {
        const buttons = document.querySelectorAll('.favorite-btn');
        buttons.forEach((btn) => {
            const movieId = Number(btn.dataset.movieId);
            const isFav = favoritedIds.has(movieId);

            btn.classList.toggle('active', isFav);
            btn.setAttribute('title', isFav ? 'Xóa khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích');

            const label = btn.querySelector('.fav-label');
            if (label) {
                label.textContent = isFav ? 'Đã yêu thích' : 'Yêu thích';
            }
        });
    }

    // 3. Khởi tạo: Lấy danh sách ID đã yêu thích từ Server
    async function loadFavoriteIds() {
        try {
            const response = await fetch('/api/favorites/ids');
            if (!response.ok) return;

            const data = await response.json();
            if (data.success && Array.isArray(data.ids)) {
                data.ids.forEach((id) => favoritedIds.add(Number(id)));
                updateBadge(favoritedIds.size);
                syncButtons();
            }
        } catch (err) {
            console.warn('Chưa thể tải danh sách ID yêu thích:', err.message);
        }
    }

    // 4. Hiển thị thông báo Toast nhanh gọn & bắt mắt
    function showToast(message, type = 'info', isHtml = false) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconMap = {
            success: '⭐',
            info: '🗑️',
            error: '⚠️'
        };
        const icon = iconMap[type] || '🔔';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message"></span>
            <button type="button" class="toast-close" aria-label="Đóng">&times;</button>
        `;

        const msgSpan = toast.querySelector('.toast-message');
        if (msgSpan) {
            if (isHtml) {
                msgSpan.innerHTML = message;
            } else {
                msgSpan.textContent = message;
            }
        }

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 250);
        });

        container.appendChild(toast);

        // Kích hoạt animation xuất hiện
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Tự động biến mất sau 3 giây
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 250);
            }
        }, 3000);
    }

    // 5. Bắt sự kiện click vào nút Ngôi Sao (dùng Event Delegation)
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.favorite-btn');
        if (!btn) return;

        // CỰC KỲ QUAN TRỌNG: Ngăn chặn mở link trang chi tiết phim khi bấm vào ngôi sao
        e.preventDefault();
        e.stopPropagation();

        const movieId = Number(btn.dataset.movieId);
        if (!movieId) return;

        const title = btn.dataset.title || 'Phim';
        const poster_path = btn.dataset.poster || '';
        const vote_average = Number(btn.dataset.vote) || 0;
        const release_date = btn.dataset.release || '';
        const overview = btn.dataset.overview || '';

        // Hiệu ứng Optimistic UI: Đổi trạng thái nút ngay lập tức để người dùng cảm thấy phản hồi tức thì
        const wasActive = btn.classList.contains('active');
        const nextState = !wasActive;

        // Cập nhật tất cả các nút cùng movieId trên trang (nếu có)
        const matchingBtns = document.querySelectorAll(`.favorite-btn[data-movie-id="${movieId}"]`);
        matchingBtns.forEach((b) => {
            b.classList.toggle('active', nextState);
            b.setAttribute('title', nextState ? 'Xóa khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích');
            const label = b.querySelector('.fav-label');
            if (label) {
                label.textContent = nextState ? 'Đã yêu thích' : 'Yêu thích';
            }
        });

        // Hàm hoàn tác trạng thái nút khi có lỗi hoặc chưa đăng nhập
        const revertButtons = () => {
            matchingBtns.forEach((b) => {
                b.classList.toggle('active', wasActive);
                b.setAttribute('title', wasActive ? 'Xóa khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích');
                const label = b.querySelector('.fav-label');
                if (label) {
                    label.textContent = wasActive ? 'Đã yêu thích' : 'Yêu thích';
                }
            });
        };

        try {
            const response = await fetch('/api/favorites/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    movieId,
                    title,
                    poster_path,
                    vote_average,
                    release_date,
                    overview
                })
            });

            // Nếu người dùng chưa đăng nhập (HTTP 401)
            if (response.status === 401) {
                revertButtons();
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                showToast(
                    `Vui lòng <a href="/login?redirect=${returnUrl}" style="color: #f5c518; text-decoration: underline; font-weight: 700;">đăng nhập</a> để thêm phim vào danh sách yêu thích!`,
                    'error',
                    true
                );
                return;
            }

            const data = await response.json();

            if (data.success) {
                if (data.isFavorite) {
                    favoritedIds.add(movieId);
                    showToast(data.message, 'success');
                } else {
                    favoritedIds.delete(movieId);
                    showToast(data.message, 'info');
                }

                updateBadge(favoritedIds.size);

                // Nếu đang đứng ở trang /favorites mà người dùng gỡ bỏ phim:
                if (!data.isFavorite && window.location.pathname.startsWith('/favorites')) {
                    const cardLink = btn.closest('.movie-card-cinematic');
                    if (cardLink) {
                        cardLink.classList.add('removing');
                        setTimeout(() => {
                            cardLink.remove();

                            const grid = document.getElementById('favoritesGrid');
                            if (grid && grid.querySelectorAll('.movie-card-cinematic').length === 0) {
                                grid.outerHTML = `
                                    <div class="empty-state" id="emptyFavorites">
                                        <i class="fa-regular fa-bookmark"></i>
                                        <h2>Danh sách của bạn đang trống</h2>
                                        <p>Bấm biểu tượng bookmark trên thẻ phim hoặc nút <strong>+ MY LIST</strong> để lưu phim.</p>
                                        <a href="/" class="btn btn-primary"><i class="fa-solid fa-compass"></i> Khám phá phim</a>
                                    </div>
                                `;
                            }
                        }, 300);
                    }
                }
            } else {
                // Phục hồi lại trạng thái cũ nếu lỗi từ server
                revertButtons();
                showToast(data.message || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Lỗi khi toggle favorite:', error);
            revertButtons();
            showToast('Không thể kết nối đến máy chủ.', 'error');
        }
    });

    // Bắt đầu nạp danh sách
    loadFavoriteIds();
});
