const Movie = require('../models/movieModel');
const { text, url } = require('../utils/adminValidation');

const safeUrl = value => { try { return url(value); } catch { return ''; } };

exports.list = async (req, res) => {
    try {
        const q = text(req.query.q, 100);
        const page = req.query.page === undefined ? '1' : req.query.page;
        if (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page)) return res.status(400).send('Trang không hợp lệ.');
        const filter = { isPublished: { $ne: false } };
        if (q) filter.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const [movies, total] = await Promise.all([
            Movie.find(filter).select('title slug year quality isVip poster_url').sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * 20).limit(20).lean(),
            Movie.countDocuments(filter)
        ]);
        movies.forEach(movie => { movie.poster_url = safeUrl(movie.poster_url); });
        res.render('pages/library', { title: 'Thư viện phim | CineVerse', movies, total, q, page: Number(page), pages: Math.ceil(total / 20) });
    } catch (error) {
        console.error('Library:', error.message);
        res.status(error.status || 503).send(error.status === 400 ? error.message : 'Chưa thể tải kho phim. Vui lòng thử lại.');
    }
};

exports.detail = async (req, res) => {
    try {
        const movie = await Movie.findOne({ slug: req.params.slug, isPublished: { $ne: false } }).lean();
        if (!movie) return res.status(404).send('Không tìm thấy phim.');
        res.set('Cache-Control', 'no-store');
        const allowed = !movie.isVip || (req.user && (req.user.isVip || req.user.role === 'admin'));
        movie.poster_url = safeUrl(movie.poster_url);
        const episodes = allowed ? (movie.danh_sach_server || []).flatMap(server => server.server_data.map(episode => ({
            name: `${server.server_name} · ${episode.name}`, embed: safeUrl(episode.link_embed), hls: safeUrl(episode.link_m3u8), type: server.server_type
        }))).filter(episode => episode.type === 'iframe' ? episode.embed : episode.hls) : [];
        // Không truyền nguồn VIP xuống template khi người xem chưa có quyền.
        delete movie.danh_sach_server;
        const selection = req.query.episode === undefined ? '0' : req.query.episode;
        if (typeof selection !== 'string' || !/^\d{1,4}$/.test(selection)) return res.status(400).send('Tập phim không hợp lệ.');
        const selected = episodes[Number(selection)] || episodes[0] || null;
        res.render('pages/libraryDetail', { title: 'Chi tiết phim | CineVerse', movie, episodes, selected, allowed });
    } catch (error) {
        console.error('Library detail:', error.message);
        res.status(503).send('Chưa thể tải phim. Vui lòng thử lại.');
    }
};
