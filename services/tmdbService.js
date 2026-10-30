const axios = require('axios');

// Tạo một trạm phát request gốc (instance)
// Cách này giúp bạn không phải viết đi viết lại cái URL và Token ở mỗi hàm
const tmdbApi = axios.create({
    baseURL: process.env.TMDB_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`
    }
});

exports.getMovieList = async (page, genre) => {
    const response = await tmdbApi.get('/discover/movie', {
        params: {
            language: 'vi-VN',
            sort_by: 'popularity.desc',
            include_adult: false,
            page,
            ...(genre && { with_genres: genre })
        },
        timeout: 8000
    });
    return response.data;
};

/**
 * 1. Lấy danh sách phim phổ biến (Trang chủ)
 */
exports.getPopularMovies = async () => {
    try {
        const response = await tmdbApi.get('/movie/popular?language=vi-VN&page=1');
        return response.data.results; // Trả về mảng chứa các bộ phim
    } catch (error) {
        console.error("Lỗi lấy phim phổ biến:", error.message);
        return []; // Trả về mảng rỗng nếu lỗi để không làm sập web
    }
};

/**
 * 2. Tìm kiếm phim theo từ khóa
 */
exports.searchMovies = async (keyword, page = 1) => {
    const response = await tmdbApi.get('/search/movie', {
        params: {
            query: keyword,
            language: 'vi-VN',
            page,
            include_adult: false
        },
        timeout: 8000
    });
    return response.data;
};

/**
 * 3. Lấy chi tiết 1 bộ phim (Dành cho trang movieDetail)
 */
exports.getMovieDetail = async (movieId) => {
    try {
        const response = await tmdbApi.get(`/movie/${movieId}?language=vi-VN`);
        return response.data; // Chi tiết phim là 1 object, không phải mảng (không có .results)
    } catch (error) {
        console.error(`Lỗi lấy chi tiết phim ID ${movieId}:`, error.message);
        return null; // Trả về null nếu không tìm thấy phim
    }
};

/**
 * 4. Lấy logo chính thức trong suốt của bộ phim từ TMDB (Title Logo như Disney+/Netflix)
 */
exports.getMovieLogo = async (movieId) => {
    try {
        const response = await tmdbApi.get(`/movie/${movieId}/images?include_image_language=en,vi,null`);
        if (response.data.logos && response.data.logos.length > 0) {
            // Ưu tiên logo ngôn ngữ tiếng Anh hoặc tiếng Việt
            const bestLogo = response.data.logos.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'vi') || response.data.logos[0];
            return bestLogo.file_path;
        }
        return null;
    } catch (error) {
        console.warn(`Không lấy được logo cho phim ${movieId}:`, error.message);
        return null;
    }
};

/**
 * 5. Lấy danh sách phim theo thể loại (Genre ID) từ TMDB Discover API
 */
exports.getMoviesByGenre = async (genreId, limit = 15) => {
    try {
        const response = await tmdbApi.get('/discover/movie', {
            params: {
                with_genres: genreId,
                language: 'vi-VN',
                sort_by: 'popularity.desc',
                include_adult: false,
                page: 1
            }
        });
        return (response.data.results || []).slice(0, limit);
    } catch (error) {
        console.error(`Lỗi lấy phim theo thể loại ${genreId}:`, error.message);
        return [];
    }
};
