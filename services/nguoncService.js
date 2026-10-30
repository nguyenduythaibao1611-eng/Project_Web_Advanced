const axios = require('axios');

const NGUONC_BASE_URL = 'https://phim.nguonc.com/api';

const nguoncApi = axios.create({
    baseURL: NGUONC_BASE_URL,
    timeout: 8000,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
});

/**
 * 1. Tìm kiếm phim trên NguonC theo từ khóa
 * Endpoint: /films/search?keyword=...
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
exports.searchFilm = async (keyword) => {
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
        return [];
    }

    try {
        const response = await nguoncApi.get('/films/search', {
            params: { keyword: keyword.trim() }
        });

        if (response.data && Array.isArray(response.data.items)) {
            return response.data.items;
        }
        return [];
    } catch (error) {
        console.warn(`[NguonC] Lỗi tìm kiếm "${keyword}":`, error.message);
        return [];
    }
};

/**
 * 2. Lấy thông tin chi tiết phim bao gồm server phát và link embed StreamC
 * Endpoint: /film/:slug
 * @param {string} slug
 * @returns {Promise<Object|null>}
 */
exports.getFilmDetail = async (slug) => {
    if (!slug || typeof slug !== 'string') {
        return null;
    }

    try {
        const response = await nguoncApi.get(`/film/${encodeURIComponent(slug.trim())}`);
        if (response.data && response.data.status === 'success' && response.data.movie) {
            return response.data.movie;
        }
        return null;
    } catch (error) {
        console.warn(`[NguonC] Lỗi lấy chi tiết "${slug}":`, error.message);
        return null;
    }
};

/**
 * 3. Lấy danh sách phim mới cập nhật theo trang
 * Endpoint: /films/phim-moi-cap-nhat?page=...
 * @param {number} page
 * @returns {Promise<{ items: Array, totalPages: number }>}
 */
exports.getLatestFilms = async (page = 1) => {
    try {
        const response = await nguoncApi.get('/films/phim-moi-cap-nhat', {
            params: { page }
        });

        const data = response.data;
        if (data && data.status === 'success') {
            return {
                items: Array.isArray(data.items) ? data.items : [],
                totalPages: data.paginate?.total_page || 1,
                currentPage: data.paginate?.current_page || page
            };
        }
        return { items: [], totalPages: 1, currentPage: page };
    } catch (error) {
        console.error(`[NguonC] Lỗi lấy danh sách trang ${page}:`, error.message);
        return { items: [], totalPages: 1, currentPage: page };
    }
};
