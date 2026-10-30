const tmdbService = require('../services/tmdbService');
const ophimService = require('../services/ophimService');

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
    const data = { title: 'Danh sách Movies | CineVerse', genres: movieGenres, genre: '', page: 1,
        movies: [], totalPages: 0, error: '' };
    if (typeof pageValue !== 'string' || !/^[1-9]\d{0,2}$/.test(pageValue) || Number(pageValue) > 500 ||
        typeof genre !== 'string' || !movieGenres.some(item => item.id === genre)) {
        data.error = 'Trang hoặc thể loại không hợp lệ.';
        return res.status(400).render('pages/movies', data);
    }
    data.page = Number(pageValue);
    data.genre = genre;
    try {
        const result = await tmdbService.getMovieList(data.page, genre);
        if (!Array.isArray(result.results) || !Number.isInteger(result.total_pages)) throw new Error('Invalid TMDB response');
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
    if ((query !== undefined && typeof query !== 'string') ||
        (typeof query === 'string' && query.length > 200) ||
        typeof page !== 'string' || !/^[1-9]\d{0,2}$/.test(page) || Number(page) > 500) {
        return null;
    }
    return { keyword: (query || '').trim(), page: Number(page) };
}

exports.search = async (req, res) => {
    const search = readSearch(req);
    const data = { title: 'Tìm kiếm phim | CineVerse', keyword: search?.keyword || '',
        movies: [], page: search?.page || 1, totalPages: 0, totalResults: 0, error: '' };
    if (!search) {
        data.error = 'Từ khóa tối đa 200 ký tự và số trang từ 1 đến 500.';
        return res.status(400).render('pages/search', data);
    }
    try {
        if (search.keyword) {
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
        const result = await tmdbService.searchMovies(search.keyword);
        return res.json({ movies: result.results.slice(0, 5).map(movie => ({
            id: movie.id, title: movie.title, release_date: movie.release_date
        })) });
    } catch (error) {
        console.error('Lỗi gợi ý TMDB:', error.message);
        return res.status(502).json({ error: 'Không tải được gợi ý. Nhấn Enter để thử tìm kiếm.' });
    }
};

/**
 * 1. Lấy danh sách phim phổ biến cho trang chủ
 */
exports.getPopular = async (req, res) => {
    try {
        // Tải song song phim phổ biến và 5 thể loại chính để tối ưu tốc độ tải trang
        const [
            popularMovies,
            actionMovies,
            scifiMovies,
            horrorMovies,
            animationMovies,
            romanceMovies
        ] = await Promise.all([
            tmdbService.getPopularMovies(),
            tmdbService.getMoviesByGenre(28, 15),     // Hành Động
            tmdbService.getMoviesByGenre(878, 15),    // Khoa Học Viễn Tưởng
            tmdbService.getMoviesByGenre(27, 15),     // Kinh Dị
            tmdbService.getMoviesByGenre(16, 15),     // Hoạt Hình
            tmdbService.getMoviesByGenre(10749, 15)   // Tình Cảm / Lãng Mạn
        ]);

        // Lấy logo cho 5 phim đầu (hero slider) song song để không chậm trang
        const heroMovies = (popularMovies || []).slice(0, 5);
        const heroLogos = await Promise.all(heroMovies.map((m) => tmdbService.getMovieLogo(m.id)));

        res.render('pages/index', {
            title: 'Trang chủ CineVerse',
            movies: popularMovies,
            heroLogos: heroLogos,
            genresData: [
                { title: 'Hành Động', movies: actionMovies },
                { title: 'Viễn Tưởng', movies: scifiMovies },
                { title: 'Kinh Dị', movies: horrorMovies },
                { title: 'Hoạt Hình', movies: animationMovies },
                { title: 'Lãng Mạn', movies: romanceMovies }
            ]
        });
    } catch (error) {
        console.error('Lỗi lấy phim phổ biến & thể loại:', error.message);
        res.status(500).send('Lỗi Server');
    }
};

/**
 * 2. Hiển thị trang chi tiết phim với Đa Server & Fallback
 * - Lấy chi tiết phim từ TMDB
 * - Tạo link embed dự phòng VidSrc theo movie.id
 * - Dò tìm link Vietsub bên OPhim theo movie.original_title và lấy link embed tập 1
 * - Truyền (movie, vidsrcLink, ophimLink) sang view
 */
exports.getMovieDetail = async (req, res) => {
    try {
        const movieId = req.params.id || req.params.movieId;

        // 1. Gọi tmdbService.getMovieDetail(movieId)
        const movie = await tmdbService.getMovieDetail(movieId);

        if (!movie) {
            return res.status(404).send('Không tìm thấy thông tin phim.');
        }

        // 2. Tạo sẵn link dự phòng VidSrc dùng trực tiếp ID của TMDB
        const vidsrcLink = `https://vidsrc.me/embed/movie?tmdb=${movie.id}`;

        // 3. Gọi ophimService.searchOphim(movie.original_title) để dò tìm phim bên OPhim
        let ophimEmbedLink = null;
        const searchKeyword = movie.original_title || movie.title;
        if (searchKeyword) {
            let ophimResults = await ophimService.searchOphim(searchKeyword);
            
            // Nếu tìm theo tên gốc không ra kết quả, thử thêm với tiêu đề tiếng Việt
            if ((!ophimResults || ophimResults.length === 0) && movie.title && movie.title !== movie.original_title) {
                ophimResults = await ophimService.searchOphim(movie.title);
            }

            if (ophimResults && ophimResults.length > 0) {
                const firstOphimMovie = ophimResults[0];
                ophimEmbedLink = await ophimService.getFirstEpisodeEmbed(firstOphimMovie.slug);
            }
        }

        const ophimLink = ophimEmbedLink || null;

        // 4. Truyền đầy đủ các biến (movie, vidsrcLink, ophimLink) sang file view qua res.render()
        res.render('pages/movieDetail', {
            title: movie.title || movie.name || 'Chi tiết phim',
            movie: movie,
            vidsrcLink: vidsrcLink,
            ophimLink: ophimLink,
            ophimEmbedLink: ophimEmbedLink
        });
    } catch (error) {
        console.error(`Lỗi lấy chi tiết phim ID ${req.params.id}:`, error.message);
        res.status(500).send('Lỗi máy chủ khi tải chi tiết phim.');
    }
};
