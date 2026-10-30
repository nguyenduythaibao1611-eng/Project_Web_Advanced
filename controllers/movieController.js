const tmdbService = require('../services/tmdbService');
const ophimService = require('../services/ophimService');
const WatchHistory = require('../models/watchHistoryModel');
const Movie = require('../models/movieModel');
const mongoose = require('mongoose');

const movieGenres = [
    { id: '', name: 'Tất cả' },
    { id: '28', name: 'Hành động' },
    { id: '12', name: 'Phiêu lưu' },
    { id: '878', name: 'Viễn tưởng' },
    { id: '35', name: 'Hài' },
    { id: '27', name: 'Kinh dị' },
    { id: '16', name: 'Hoạt hình' },
    { id: '10749', name: 'Lãng mạn' }
];

exports.getMovieList = async (req, res) => {
    const pageValue = req.query.page === undefined ? '1' : req.query.page;
    const genre = req.query.genre === undefined ? '' : req.query.genre;
    const data = {
        title: 'Danh sách Movies | CineVerse',
        genres: movieGenres,
        genre: '',
        page: 1,
        movies: [],
        totalPages: 0,
        error: ''
    };
    if (
        typeof pageValue !== 'string' ||
        !/^[1-9]\d{0,2}$/.test(pageValue) ||
        Number(pageValue) > 500 ||
        typeof genre !== 'string' ||
        !movieGenres.some((item) => item.id === genre)
    ) {
        data.error = 'Trang hoặc thể loại không hợp lệ.';
        return res.status(400).render('pages/movies', data);
    }
    data.page = Number(pageValue);
    data.genre = genre;
    try {
        if (mongoose.connection.readyState === 1) {
            const count = await Movie.countDocuments({ isDeleted: { $ne: true } });
            if (count > 0) {
                const limit = 24;
                const filter = { isDeleted: { $ne: true } };
                if (genre) {
                    const selectedGenre = movieGenres.find((g) => g.id === genre);
                    if (selectedGenre && selectedGenre.name && selectedGenre.name !== 'Tất cả') {
                        filter['genres.name'] = new RegExp(selectedGenre.name, 'i');
                    }
                }
                const totalFiltered = await Movie.countDocuments(filter);
                const dbMovies = await Movie.find(filter)
                    .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
                    .skip((data.page - 1) * limit)
                    .limit(limit)
                    .lean();

                data.movies = dbMovies.map((m) => ({
                    id: String(m._id),
                    _id: String(m._id),
                    movieId: String(m._id),
                    slug: m.slug,
                    title: m.title,
                    overview: m.overview || '',
                    backdrop_path: m.backdrop_url || '',
                    poster_path: m.poster_url || '',
                    vote_average: m.rating || 8.0,
                    release_date: m.year ? `${m.year}-01-01` : '',
                    isVip: Boolean(m.isVip),
                    isFromDb: true
                }));
                data.totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
                return res.render('pages/movies', data);
            }
        }

        const result = await tmdbService.getMovieList(data.page, genre);
        if (!Array.isArray(result.results) || !Number.isInteger(result.total_pages)) {
            throw new Error('Invalid TMDB response');
        }
        data.movies = result.results;
        data.totalPages = Math.min(result.total_pages, 500);
        return res.render('pages/movies', data);
    } catch (error) {
        console.error('Lỗi tải danh sách phim:', error.message);
        data.error = 'Chưa thể tải danh sách phim. Vui lòng thử lại sau.';
        return res.status(502).render('pages/movies', data);
    }
};

function readSearch(req) {
    const query = req.query.q;
    const page = req.query.page === undefined ? '1' : req.query.page;
    if (
        (query !== undefined && typeof query !== 'string') ||
        (typeof query === 'string' && query.length > 200) ||
        typeof page !== 'string' ||
        !/^[1-9]\d{0,2}$/.test(page) ||
        Number(page) > 500
    ) {
        return null;
    }
    return { keyword: (query || '').trim(), page: Number(page) };
}

exports.search = async (req, res) => {
    const search = readSearch(req);
    const data = {
        title: 'Tìm kiếm phim | CineVerse',
        keyword: search?.keyword || '',
        movies: [],
        page: search?.page || 1,
        totalPages: 0,
        totalResults: 0,
        error: ''
    };
    if (!search) {
        data.error = 'Từ khóa tối đa 200 ký tự và số trang từ 1 đến 500.';
        return res.status(400).render('pages/search', data);
    }
    try {
        if (search.keyword) {
            if (mongoose.connection.readyState === 1) {
                const count = await Movie.countDocuments({ isDeleted: { $ne: true } });
                if (count > 0) {
                    const regex = new RegExp(search.keyword, 'i');
                    const filter = {
                        isDeleted: { $ne: true },
                        $or: [{ title: regex }, { origin_name: regex }, { slug: regex }]
                    };
                    const limit = 20;
                    const totalResults = await Movie.countDocuments(filter);
                    const dbMovies = await Movie.find(filter)
                        .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
                        .skip((search.page - 1) * limit)
                        .limit(limit)
                        .lean();

                    data.movies = dbMovies.map((m) => ({
                        id: String(m._id),
                        _id: String(m._id),
                        movieId: String(m._id),
                        slug: m.slug,
                        title: m.title,
                        overview: m.overview || '',
                        backdrop_path: m.backdrop_url || '',
                        poster_path: m.poster_url || '',
                        vote_average: m.rating || 8.0,
                        release_date: m.year ? `${m.year}-01-01` : '',
                        isVip: Boolean(m.isVip),
                        isFromDb: true
                    }));
                    data.totalResults = totalResults;
                    data.totalPages = Math.max(1, Math.ceil(totalResults / limit));
                    return res.render('pages/search', data);
                }
            }

            const result = await tmdbService.searchMovies(search.keyword, search.page);
            data.movies = result.results;
            data.totalPages = Math.min(result.total_pages, 500);
            data.totalResults = result.total_results;
        }
        return res.render('pages/search', data);
    } catch (error) {
        console.error('Lỗi tìm kiếm TMDB:', error.message);
        data.error = 'Chưa thể tải kết quả. Vui lòng thử lại sau.';
        return res.status(502).render('pages/search', data);
    }
};

exports.searchSuggestions = async (req, res) => {
    const search = readSearch(req);
    if (!search) return res.status(400).json({ error: 'Từ khóa không hợp lệ.' });
    if (search.keyword.length < 2) return res.json({ movies: [] });
    try {
        if (mongoose.connection.readyState === 1) {
            const count = await Movie.countDocuments({ isDeleted: { $ne: true } });
            if (count > 0) {
                const regex = new RegExp(search.keyword, 'i');
                const filter = {
                    isDeleted: { $ne: true },
                    $or: [{ title: regex }, { origin_name: regex }, { slug: regex }]
                };
                const dbMovies = await Movie.find(filter).limit(5).lean();
                return res.json({
                    movies: dbMovies.map((m) => ({
                        id: String(m._id),
                        title: m.title,
                        release_date: m.year ? `${m.year}-01-01` : ''
                    }))
                });
            }
        }

        const result = await tmdbService.searchMovies(search.keyword);
        return res.json({
            movies: result.results.slice(0, 5).map((movie) => ({
                id: movie.id,
                title: movie.title,
                release_date: movie.release_date
            }))
        });
    } catch (error) {
        console.error('Lỗi gợi ý TMDB:', error.message);
        return res.status(502).json({ error: 'Không tải được gợi ý. Nhấn Enter để thử tìm kiếm.' });
    }
};

/**
 * 1. Lấy danh sách phim phổ biến cho trang chủ & Tiếp tục xem (Continue Watching)
 */
exports.getPopular = async (req, res) => {
    try {
        let popularMovies = [];
        let heroBannerMovies = [];
        let heroLogos = [];
        let genresData = [];

        // 1. ƯU TIÊN TUYỆT ĐỐI: Chỉ đẩy những phim đã lưu trên MongoDB Atlas lên trang web
        let dbMovies = [];
        try {
            if (mongoose.connection.readyState === 1) {
                dbMovies = await Movie.find({ isDeleted: { $ne: true } })
                    .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
                    .lean();
            }
        } catch (dbErr) {
            console.error('Lỗi lấy phim từ MongoDB khi tải trang chủ:', dbErr.message);
        }

        if (dbMovies && dbMovies.length > 0) {
            // Chuẩn hóa dữ liệu phim từ MongoDB
            const mappedDbMovies = dbMovies.map((m) => ({
                id: String(m._id),
                _id: String(m._id),
                movieId: String(m._id),
                slug: m.slug,
                title: m.title,
                original_title: m.origin_name || '',
                overview: m.overview || '',
                backdrop_path: m.backdrop_url || '',
                poster_path: m.poster_url || '',
                vote_average: m.rating || (m.tmdb && m.tmdb.vote_average) || 8.0,
                rating: m.rating || 8.0,
                release_date: m.year ? `${m.year}-01-01` : '',
                year: m.year || '',
                genres: (m.genres || []).map((g) => g.name || g).filter(Boolean),
                isVip: Boolean(m.isVip),
                isFromDb: true
            }));

            // Top 5 phim có ảnh backdrop đưa lên Hero Banner
            const bannerCandidates = mappedDbMovies.filter((m) => m.backdrop_path);
            heroBannerMovies = bannerCandidates.length >= 5
                ? bannerCandidates.slice(0, 5)
                : mappedDbMovies.slice(0, 5);

            heroLogos = await Promise.all(
                heroBannerMovies.map((m) => {
                    const original = dbMovies.find((dm) => String(dm._id) === m.id);
                    return original && original.tmdb && original.tmdb.id
                        ? tmdbService.getMovieLogo(original.tmdb.id)
                        : null;
                })
            );

            // Toàn bộ danh sách phim chính trên trang chủ là phim từ MongoDB
            popularMovies = mappedDbMovies;

            // Phân loại các hàng thể loại từ chính kho phim MongoDB
            const actionList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /hành động|phiêu lưu|võ thuật/i.test(g))
            );
            const scifiList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /viễn tưởng|khoa học/i.test(g))
            );
            const animeList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /hoạt hình/i.test(g))
            );
            const dramaList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /chính kịch|tâm lý|gia đình/i.test(g))
            );
            const romanceList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /tình cảm|lãng mạn/i.test(g))
            );
            const comedyList = mappedDbMovies.filter((m) =>
                m.genres.some((g) => /hài hước|hài/i.test(g))
            );

            genresData = [
                { title: 'Chính Kịch & Tâm Lý Đặc Sắc', movies: dramaList },
                { title: 'Hành Động & Phiêu Lưu', movies: actionList },
                { title: 'Hoạt Hình Chọn Lọc', movies: animeList },
                { title: 'Khoa Học & Viễn Tưởng', movies: scifiList },
                { title: 'Hài Hước & Gia Đình', movies: comedyList.length ? comedyList : romanceList }
            ].filter((g) => g.movies && g.movies.length > 0);
        } else {
            // 2. Fallback: Nếu MongoDB chưa có dữ liệu thì mới tải từ TMDB
            const [
                tmdbPopular,
                actionMovies,
                scifiMovies,
                horrorMovies,
                animationMovies,
                romanceMovies
            ] = await Promise.all([
                tmdbService.getPopularMovies(),
                tmdbService.getMoviesByGenre(28, 15),
                tmdbService.getMoviesByGenre(878, 15),
                tmdbService.getMoviesByGenre(27, 15),
                tmdbService.getMoviesByGenre(16, 15),
                tmdbService.getMoviesByGenre(10749, 15)
            ]);

            popularMovies = tmdbPopular || [];
            heroBannerMovies = popularMovies.slice(0, 5);
            heroLogos = await Promise.all(heroBannerMovies.map((m) => tmdbService.getMovieLogo(m.id)));
            genresData = [
                { title: 'Hành Động', movies: actionMovies },
                { title: 'Viễn Tưởng', movies: scifiMovies },
                { title: 'Kinh Dị', movies: horrorMovies },
                { title: 'Hoạt Hình', movies: animationMovies },
                { title: 'Lãng Mạn', movies: romanceMovies }
            ];
        }

        // Lấy danh sách Top 10 thịnh hành TMDB hôm nay (đồng bộ rank 1 -> 10)
        let top10Movies = [];
        try {
            if (mongoose.connection.readyState === 1) {
                const top10Db = await Movie.find({
                    top10Rank: { $gte: 1, $lte: 10 },
                    isDeleted: { $ne: true }
                })
                    .sort({ top10Rank: 1 })
                    .lean();

                if (top10Db && top10Db.length > 0) {
                    top10Movies = top10Db.map((m) => ({
                        id: String(m._id),
                        _id: String(m._id),
                        movieId: String(m._id),
                        slug: m.slug,
                        title: m.title,
                        original_title: m.origin_name || '',
                        overview: m.overview || '',
                        backdrop_path: m.backdrop_url || '',
                        poster_path: m.poster_url || '',
                        vote_average: m.rating || 8.0,
                        rating: m.rating || 8.0,
                        year: m.year || '',
                        isVip: Boolean(m.isVip),
                        top10Rank: m.top10Rank,
                        isFromDb: true
                    }));
                }
            }
        } catch (top10Err) {
            console.error('Lỗi lấy Top 10 TMDB:', top10Err.message);
        }

        // Lấy danh sách phim đang xem dở (Continue Watching) nếu người dùng đã đăng nhập
        let continueWatching = [];
        if (req.user) {
            try {
                continueWatching = await WatchHistory.find({ userId: req.user._id })
                    .sort({ updatedAt: -1 })
                    .limit(10);
            } catch (historyErr) {
                console.error('Lỗi lấy lịch sử xem trang chủ:', historyErr.message);
            }
        }

        res.render('pages/index', {
            title: 'Trang chủ CineVerse',
            movies: popularMovies,
            heroBannerMovies: heroBannerMovies,
            heroLogos: heroLogos,
            continueWatching: continueWatching,
            genresData: genresData,
            top10Movies: top10Movies
        });
    } catch (error) {
        console.error('Lỗi lấy phim phổ biến & thể loại:', error.message);
        res.status(500).send('Lỗi Server');
    }
};

/**
 * 2. Hiển thị trang chi tiết phim với Đa Server, HLS.js, VIP Paywall & Lịch sử xem
 * - Lấy chi tiết phim từ TMDB (hoặc MongoDB Atlas nếu tạo thủ công trong Admin)
 * - Tạo link embed dự phòng VidSrc theo movie.id (Server 2)
 * - Dò tìm phim bên OPhim để lấy luồng .m3u8 chất lượng cao (Server 1) & link embed
 * - Lấy vị trí xem dở từ WatchHistory (nếu đã đăng nhập)
 * - Truyền đầy đủ trạng thái VIP và nguồn phát xuống View
 */
const sanitizeHttpUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return '';
};

exports.getMovieDetail = async (req, res) => {
    try {
        const movieId = req.params.id || req.params.movieId;
        let movie = null;
        let dbMovie = null;
        let vidsrcLink = null;
        let ophimEmbedLink = null;
        let ophimM3u8Link = null;

        // Nếu movieId không phải thuần số (TMDB ID) thì kiểm tra MongoDB Atlas trước
        const isNumericId = /^\d+$/.test(String(movieId));
        if (!isNumericId) {
            const query = { isDeleted: { $ne: true } };
            if (mongoose.Types.ObjectId.isValid(movieId)) {
                query.$or = [{ _id: movieId }, { slug: movieId }];
            } else {
                query.slug = movieId;
            }
            try {
                dbMovie = await Movie.findOne(query);
                if (dbMovie) {
                    const numericTmdbId = (dbMovie.tmdb && dbMovie.tmdb.id && !isNaN(Number(dbMovie.tmdb.id))) ? Number(dbMovie.tmdb.id) : null;
                    movie = {
                        id: numericTmdbId || dbMovie._id,
                        title: dbMovie.title,
                        original_title: dbMovie.origin_name || dbMovie.title,
                        overview: dbMovie.overview,
                        poster_path: dbMovie.poster_url,
                        backdrop_path: dbMovie.backdrop_url,
                        runtime: parseInt(dbMovie.time, 10) || 120,
                        release_date: `${dbMovie.year || 2024}-01-01`,
                        vote_average: dbMovie.rating || 0,
                        genres: dbMovie.genres || [],
                        isVip: dbMovie.isVip
                    };

                    let s1M3u8 = null;
                    let s1Embed = null;
                    let s2Embed = null;

                    if (Array.isArray(dbMovie.danh_sach_server)) {
                        for (const s of dbMovie.danh_sach_server) {
                            const isIframeServer = s.server_type === 'iframe' || /vidsrc|dự phòng|iframe/i.test(s.server_name || '');
                            if (s.server_data && s.server_data.length > 0) {
                                for (const ep of s.server_data) {
                                    if (isIframeServer) {
                                        if (ep.link_embed && !s2Embed) s2Embed = sanitizeHttpUrl(ep.link_embed);
                                    } else {
                                        if (ep.link_m3u8 && !s1M3u8) s1M3u8 = sanitizeHttpUrl(ep.link_m3u8);
                                        if (ep.link_embed && !s1Embed) s1Embed = sanitizeHttpUrl(ep.link_embed);
                                    }
                                }
                            }
                        }
                    }
                    ophimM3u8Link = s1M3u8;
                    ophimEmbedLink = s1Embed;
                    vidsrcLink = s2Embed || (dbMovie.tmdb && dbMovie.tmdb.id ? `https://vidsrc.xyz/embed/movie?tmdb=${dbMovie.tmdb.id}` : (ophimEmbedLink || `https://vidsrc.me/embed/movie?tmdb=${dbMovie._id}`));
                }
            } catch (dbErr) {
                console.error('Lỗi tìm phim MongoDB:', dbErr.message);
            }
        }

        // Nếu chưa có (là ID TMDB hoặc không tìm thấy trong MongoDB), gọi tmdbService
        if (!movie) {
            movie = await tmdbService.getMovieDetail(movieId);
        }

        if (!movie) {
            return res.status(404).send('Không tìm thấy thông tin phim.');
        }

        // Tạo sẵn link dự phòng VidSrc dùng trực tiếp ID của TMDB (Server 2) nếu chưa có
        if (!vidsrcLink) {
            vidsrcLink = `https://vidsrc.me/embed/movie?tmdb=${movie.id}`;
        }

        // Gọi OPhim Service để bóc tách link .m3u8 và link embed (Server 1) nếu chưa có sẵn từ DB
        if (!ophimM3u8Link && !ophimEmbedLink) {
            const searchKeyword = movie.original_title || movie.title;
            if (searchKeyword) {
                let ophimResults = await ophimService.searchOphim(searchKeyword);

                // Nếu tìm theo tên gốc không ra kết quả, thử thêm với tiêu đề tiếng Việt
                if ((!ophimResults || ophimResults.length === 0) && movie.title && movie.title !== movie.original_title) {
                    ophimResults = await ophimService.searchOphim(movie.title);
                }

                if (ophimResults && ophimResults.length > 0) {
                    const firstOphimMovie = ophimResults[0];
                    const epData = await ophimService.getFirstEpisode(firstOphimMovie.slug);
                    if (epData) {
                        ophimEmbedLink = epData.embedUrl || null;
                        ophimM3u8Link = epData.m3u8Url || null;
                    }
                }
            }
        }

        let ophimLink = ophimM3u8Link || ophimEmbedLink || null;

        // Chuẩn hóa cấu trúc máy chủ (serversData) từ MongoDB hoặc fallback
        let serversData = [];
        if (dbMovie && Array.isArray(dbMovie.danh_sach_server) && dbMovie.danh_sach_server.length > 0) {
            serversData = dbMovie.danh_sach_server.map((s, sIdx) => ({
                name: s.server_name ? String(s.server_name).trim() : (`Server ${sIdx + 1}`),
                type: s.server_type === 'iframe' ? 'iframe' : 'm3u8',
                episodes: Array.isArray(s.server_data)
                    ? s.server_data.map((ep, epIdx) => ({
                          name: ep.name ? String(ep.name).trim() : (`Tập ${epIdx + 1}`),
                          m3u8: sanitizeHttpUrl(ep.link_m3u8),
                          embed: sanitizeHttpUrl(ep.link_embed)
                      }))
                    : []
            }));
        }

        // Nếu chưa có serversData (phim TMDB hoặc không có danh_sach_server), tạo cấu trúc 2 server đơn lẻ
        if (serversData.length === 0) {
            serversData = [
                {
                    name: 'Server 1 (HLS)',
                    type: 'm3u8',
                    episodes: [
                        {
                            name: 'Full',
                            m3u8: sanitizeHttpUrl(ophimM3u8Link),
                            embed: sanitizeHttpUrl(ophimEmbedLink)
                        }
                    ]
                },
                {
                    name: 'Server 2 (Iframe)',
                    type: 'iframe',
                    episodes: [
                        {
                            name: 'Full',
                            m3u8: '',
                            embed: sanitizeHttpUrl(vidsrcLink || ophimEmbedLink)
                        }
                    ]
                }
            ];
        }

        const episodesList = serversData[0]?.episodes?.length ? serversData[0].episodes : (serversData[1]?.episodes || []);

        // Lấy vị trí xem dở nếu người dùng đã đăng nhập & xác định tập bắt đầu phát
        let lastWatchedSeconds = 0;
        let lastWatchedDuration = 0;
        let historyEpisodeName = null;
        let currentEpisodeIndex = 0;

        if (req.user) {
            try {
                const targetNumericId = Number(movie.id) || (dbMovie?.tmdb?.id && Number(dbMovie.tmdb.id));
                if (targetNumericId && !isNaN(targetNumericId)) {
                    const history = await WatchHistory.findOne({
                        userId: req.user._id,
                        movieId: targetNumericId
                    });
                if (history) {
                    historyEpisodeName = history.episode ? String(history.episode).trim() : null;
                    if (historyEpisodeName) {
                        const foundIdx = episodesList.findIndex(
                            (ep) => ep.name.toLowerCase() === historyEpisodeName.toLowerCase()
                        );
                        if (foundIdx >= 0) {
                            currentEpisodeIndex = foundIdx;
                            lastWatchedSeconds = history.currentTime || 0;
                            lastWatchedDuration = history.duration || 0;
                        }
                    } else {
                        lastWatchedSeconds = history.currentTime || 0;
                        lastWatchedDuration = history.duration || 0;
                    }
                }
                }
            } catch (histErr) {
                console.error('Lỗi lấy tiến độ xem dở:', histErr.message);
            }
        }

        // Cập nhật link phát ban đầu theo đúng tập bắt đầu
        const s1CurrentEp = serversData[0]?.episodes?.[currentEpisodeIndex];
        if (s1CurrentEp) {
            ophimM3u8Link = s1CurrentEp.m3u8 || '';
            ophimEmbedLink = s1CurrentEp.embed || '';
        }
        const s2CurrentEp = serversData[1]?.episodes?.[currentEpisodeIndex];
        if (s2CurrentEp && s2CurrentEp.embed) {
            vidsrcLink = s2CurrentEp.embed;
        }

        ophimLink = ophimM3u8Link || ophimEmbedLink || null;
        const isVip = Boolean(req.user && req.user.isVip);

        // Truyền đầy đủ các biến sang file view qua res.render()
        res.render('pages/movieDetail', {
            title: movie.title || movie.name || 'Chi tiết phim',
            movie: movie,
            vidsrcLink: vidsrcLink,
            ophimLink: ophimLink,
            ophimM3u8: ophimM3u8Link,
            ophimEmbed: ophimEmbedLink,
            ophimEmbedLink: ophimEmbedLink,
            isVip: isVip,
            lastWatchedSeconds: lastWatchedSeconds,
            lastWatchedDuration: lastWatchedDuration,
            servers: serversData,
            episodes: episodesList,
            currentEpisodeIndex: currentEpisodeIndex,
            historyEpisodeName: historyEpisodeName
        });
    } catch (error) {
        console.error(`Lỗi lấy chi tiết phim ID ${req.params.id}:`, error.message);
        res.status(500).send('Lỗi máy chủ khi tải chi tiết phim.');
    }
};
