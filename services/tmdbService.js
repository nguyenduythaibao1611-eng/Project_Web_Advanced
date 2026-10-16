const axios = require('axios');

// Tạo một trạm phát request gốc (instance)
// Cách này giúp bạn không phải viết đi viết lại cái URL và Token ở mỗi hàm
const tmdbApi = axios.create({
    baseURL: process.env.TMDB_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`
    }
});

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
exports.searchMovies = async (keyword) => {
    try {
        const response = await tmdbApi.get(`/search/movie`, {
            params: {
                query: keyword,
                language: 'vi-VN',
                page: 1
            }
        });
        return response.data.results;
    } catch (error) {
        console.error(`Lỗi tìm kiếm phim "${keyword}":`, error.message);
        return [];
    }
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