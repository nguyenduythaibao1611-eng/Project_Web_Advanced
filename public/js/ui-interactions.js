/**
 * ui-interactions.js - Tương tác giao diện: hero slider, hàng phim cuộn ngang,
 * dropdown header, tìm kiếm nhanh, và chặn các tính năng chưa làm.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ---------- Toast dùng chung ----------
    function toast(message) {
        let box = document.getElementById('toastContainer');
        if (!box) {
            box = document.createElement('div');
            box.id = 'toastContainer';
            box.className = 'toast-container';
            document.body.appendChild(box);
        }
        const el = document.createElement('div');
        el.className = 'toast toast-info show';
        el.innerHTML = `<span class="toast-icon"><i class="fa-solid fa-hourglass-half"></i></span><span class="toast-message">${message}</span>`;
        box.appendChild(el);
        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 300);
        }, 2800);
    }

    // ---------- Tính năng chưa làm: chặn click + báo "sắp ra mắt" ----------
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-feature]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        toast(`${el.dataset.feature} đang được phát triển, sẽ sớm ra mắt!`);
    }, true);

    // ---------- Header đổi nền khi cuộn ----------
    const header = document.querySelector('.site-header');
    const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // ---------- Dropdown (thông báo, avatar) & ô tìm kiếm ----------
    const pairs = [
        [document.getElementById('notifBtn'), document.getElementById('notifDropdown')],
        [document.getElementById('userAvatarBtn'), document.getElementById('userDropdown')],
        [document.getElementById('searchToggleBtn'), document.getElementById('searchExpandBar')]
    ].filter(([btn, panel]) => btn && panel);

    function setPanel(btn, panel, open) {
        panel.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', String(open));
        if (panel.id === 'searchExpandBar') panel.inert = !open;
    }

    pairs.forEach(([btn, panel]) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !panel.classList.contains('active');
            pairs.forEach(([b, p]) => setPanel(b, p, false));
            setPanel(btn, panel, willOpen);
            const input = panel.querySelector('input');
            if (willOpen && input) input.focus();
        });
        panel.addEventListener('click', (e) => e.stopPropagation());
    });

    document.addEventListener('click', () => pairs.forEach(([b, p]) => setPanel(b, p, false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') pairs.forEach(([b, p]) => {
            if (p.contains(document.activeElement)) b.focus();
            setPanel(b, p, false);
        });
    });

    const closeSearch = document.getElementById('quickSearchClose');
    const searchInput = document.getElementById('quickSearchInput');
    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            const toggle = document.getElementById('searchToggleBtn');
            setPanel(toggle, document.getElementById('searchExpandBar'), false);
            toggle.focus();
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // Gợi ý từ kho phim, hủy request cũ để kết quả luôn khớp từ khóa mới.
    if (searchInput) {
        const suggestions = document.getElementById('searchSuggestions');
        const status = document.getElementById('searchStatus');
        const list = document.getElementById('searchSuggestionList');
        let timer;
        let request;
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            if (request) request.abort();
            const q = searchInput.value.trim();
            list.replaceChildren();
            suggestions.hidden = q.length < 2;
            status.textContent = 'Đang tìm phim…';
            if (q.length < 2) return;
            request = new AbortController();
            const signal = request.signal;
            timer = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
                    if (!response.ok) throw new Error('Search failed');
                    const { movies } = await response.json();
                    if (signal.aborted) return;
                    status.textContent = movies.length ? 'Phim gợi ý · Nhấn Enter để xem tất cả' : 'Không có gợi ý phù hợp. Nhấn Enter để tìm kiếm.';
                    movies.forEach(movie => {
                        const item = document.createElement('li');
                        const link = document.createElement('a');
                        link.href = `/movies/${encodeURIComponent(movie.id)}`;
                        link.textContent = `${movie.title}${movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''}`;
                        item.appendChild(link);
                        list.appendChild(item);
                    });
                } catch {
                    if (!signal.aborted) status.textContent = 'Chưa tải được gợi ý. Nhấn Enter để thử tìm kiếm.';
                }
            }, 300);
        });
        searchInput.form.addEventListener('submit', (event) => {
            searchInput.value = searchInput.value.trim();
            if (!searchInput.value) event.preventDefault();
        });
    }

    // ---------- Hero slider ----------
    const hero = document.getElementById('hero');
    if (hero) {
        const slides = hero.querySelectorAll('.hero-slide');
        const thumbs = hero.querySelectorAll('.hero-thumb');
        const DURATION = 8000;
        let current = 0;
        let timer = null;
        let startTime = Date.now();
        let remaining = DURATION;
        let isPaused = false;

        const go = (i) => {
            current = (i + slides.length) % slides.length;
            slides.forEach((s, idx) => s.classList.toggle('is-active', idx === current));
            thumbs.forEach((t, idx) => {
                t.classList.remove('is-active');
                if (idx === current) {
                    void t.offsetWidth; // restart thanh tiến trình
                    t.classList.add('is-active');
                }
            });
            remaining = DURATION;
            startTime = Date.now();
        };

        const scheduleNext = (delay) => {
            if (timer) clearTimeout(timer);
            if (slides.length <= 1) return;
            startTime = Date.now();
            timer = setTimeout(() => {
                go(current + 1);
                scheduleNext(DURATION);
            }, delay);
        };

        const pause = () => {
            if (isPaused) return;
            isPaused = true;
            if (timer) clearTimeout(timer);
            const elapsed = Date.now() - startTime;
            remaining = Math.max(500, remaining - elapsed);
            hero.classList.add('is-paused');
        };

        const resume = () => {
            if (!isPaused) return;
            isPaused = false;
            hero.classList.remove('is-paused');
            scheduleNext(remaining);
        };

        thumbs.forEach((t) => t.addEventListener('click', () => {
            if (timer) clearTimeout(timer);
            hero.classList.remove('is-paused');
            isPaused = false;
            go(Number(t.dataset.index));
            scheduleNext(DURATION);
        }));

        hero.addEventListener('mouseenter', pause);
        hero.addEventListener('mouseleave', resume);

        scheduleNext(DURATION);
    }

    // ---------- Hàng phim: nút mũi tên cuộn ngang ----------
    document.querySelectorAll('.row').forEach((row) => {
        const track = row.querySelector('.row-track');
        if (!track) return;
        const arrows = row.querySelectorAll('.row-arrow');

        const update = () => {
            const max = track.scrollWidth - track.clientWidth - 4;
            arrows.forEach((a) => {
                const dir = Number(a.dataset.dir);
                a.disabled = dir < 0 ? track.scrollLeft <= 4 : track.scrollLeft >= max;
            });
        };

        arrows.forEach((a) => a.addEventListener('click', () => {
            track.scrollBy({ left: Number(a.dataset.dir) * track.clientWidth * 0.85, behavior: 'smooth' });
        }));
        track.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    });

    // ---------- Tab SUGGESTED: cuộn xuống hàng phim ----------
    const tabSuggested = document.getElementById('tabSuggested');
    if (tabSuggested) {
        tabSuggested.addEventListener('click', () => {
            const target = document.getElementById('suggestedSection');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
});
