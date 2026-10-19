const tmdbService = require('../services/tmdbService');
const ophimService = require('../services/ophimService');

/**
 * 1. Lấy danh sách phim phổ biến cho trang chủ
 */
exports.getPopular = async (req, res) => {
    try {
        const movies = await tmdbService.getPopularMovies();

        res.render('pages/index', {
            title: 'Trang chủ CineVerse',
            movies: movies
        });
    } catch (error) {
        console.error('Lỗi lấy phim phổ biến:', error.message);
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