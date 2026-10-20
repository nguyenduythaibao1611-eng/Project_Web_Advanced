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

    pairs.forEach(([btn, panel]) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !panel.classList.contains('active');
            pairs.forEach(([, p]) => p.classList.remove('active'));
            panel.classList.toggle('active', willOpen);
            const input = panel.querySelector('input');
            if (willOpen && input) input.focus();
        });
        panel.addEventListener('click', (e) => e.stopPropagation());
    });

    document.addEventListener('click', () => pairs.forEach(([, p]) => p.classList.remove('active')));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') pairs.forEach(([, p]) => p.classList.remove('active'));
    });

    const closeSearch = document.getElementById('quickSearchClose');
    const searchInput = document.getElementById('quickSearchInput');
    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            document.getElementById('searchExpandBar').classList.remove('active');
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // Lọc nhanh các thẻ phim đang có trên trang
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            document.querySelectorAll('.movie-card-cinematic').forEach((card) => {
                const t = (card.querySelector('.card-title') || {}).textContent || '';
                card.style.display = !q || t.toLowerCase().includes(q) ? '' : 'none';
            });
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
        };

        const start = () => {
            stop();
            if (slides.length > 1) timer = setInterval(() => go(current + 1), DURATION);
        };
        const stop = () => timer && clearInterval(timer);

        thumbs.forEach((t) => t.addEventListener('click', () => {
            go(Number(t.dataset.index));
            start();
        }));

        hero.addEventListener('mouseenter', () => { stop(); hero.classList.add('is-paused'); });
        hero.addEventListener('mouseleave', () => { hero.classList.remove('is-paused'); go(current); start(); });
        start();
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
