const axios = require('axios');

const PRIMARY_BASE_URL = process.env.OPHIM_BASE_URL || 'https://ophim1.com';
const BACKUP_BASE_URL = 'https://phimapi.com';

// Axios instance mặc định với timeout và headers thông dụng
const ophimApi = axios.create({
    baseURL: PRIMARY_BASE_URL,
    timeout: 5000,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

/**
 * Hàm helper gọi API hỗ trợ fallback sang domain dự phòng nếu domain chính bị lỗi
 */
const requestWithFallback = async (path, params = {}) => {
    try {
        return await ophimApi.get(path, { params });
    } catch (primaryError) {
        // Nếu domain chính bị lỗi (404, timeout, sập web...), thử domain dự phòng
        try {
            return await axios.get(`${BACKUP_BASE_URL}${path}`, {
                params,
                timeout: 5000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        } catch {
            throw primaryError; // Ném lỗi ban đầu để catch bên ngoài ghi log
        }
    }
};

/**
 * 1. Tìm kiếm phim theo từ khóa (tên gốc hoặc tên tiếng Anh)
 * Endpoint: /v1/api/tim-kiem?keyword=...
 * @param {string} keyword - Từ khóa tên phim
 * @returns {Promise<Array>} - Mảng danh sách các phim tìm được, hoặc [] nếu lỗi / không tìm thấy
 */
exports.searchMovies = async (keyword) => {
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
        return [];
    }

    try {
        const response = await requestWithFallback('/v1/api/tim-kiem', {
            keyword: keyword.trim()
        });

        // OPhim trả về danh sách phim trong response.data.data.items
        const items = response.data?.data?.items;
        if (Array.isArray(items)) {
            return items;
        }

        return [];
    } catch (error) {
        console.error(`[OPhim Service] Lỗi tìm kiếm phim "${keyword}":`, error.message);
        return []; // Trả về mảng rỗng để tránh làm sập server
    }
};

/**
 * 2. Lấy thông tin chi tiết phim theo slug
 * Endpoint: /phim/:slug
 * @param {string} slug - Định danh slug của phim (VD: "spider-man-no-way-home")
 * @returns {Promise<Object>} - Object thông tin phim & danh sách tập, hoặc {} nếu lỗi
 */
exports.getMovieDetail = async (slug) => {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return {};
    }

    try {
        const cleanSlug = slug.trim();
        const response = await requestWithFallback(`/phim/${cleanSlug}`);

        // OPhim trả về { status, msg, movie, episodes } hoặc { data: { item } }
        const data = response.data;
        if (!data) return {};

        return data;
    } catch (error) {
        console.error(`[OPhim Service] Lỗi lấy chi tiết phim slug "${slug}":`, error.message);
        return {}; // Trả về object rỗng nếu không tìm thấy phim
    }
};

/**
 * 3. Lấy link embed của tập phim đầu tiên theo slug
 * @param {string} slug - Định danh slug của phim
 * @returns {Promise<string|null>} - Link embed tập đầu tiên, hoặc null nếu không tìm thấy
 */
exports.getFirstEpisodeEmbed = async (slug) => {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return null;
    }

    try {
        const detailData = await exports.getMovieDetail(slug);
        if (!detailData || Object.keys(detailData).length === 0) {
            return null;
        }

        // Bóc tách danh sách server tập phim
        // Hỗ trợ cả 2 cấu trúc: data.episodes hoặc data.data.item.episodes
        const episodes = detailData.episodes || detailData.data?.item?.episodes || [];
        if (!Array.isArray(episodes) || episodes.length === 0) {
            return null;
        }

        // Lấy server đầu tiên (thường là Vietsub #1)
        const firstServer = episodes[0];
        const serverData = firstServer?.server_data;
        if (!Array.isArray(serverData) || serverData.length === 0) {
            return null;
        }

        // Lấy tập đầu tiên
        const firstEpisode = serverData[0];
        const linkEmbed = firstEpisode?.link_embed || null;

        return linkEmbed;
    } catch (error) {
        console.error(`[OPhim Service] Lỗi bóc tách link embed tập đầu phim slug "${slug}":`, error.message);
        return null;
    }
};

/**
 * 4. Helper lấy đầy đủ thông tin tập đầu tiên (tên tập, link embed, link m3u8)
 * @param {string} slug - Định danh slug của phim
 * @returns {Promise<Object>} - Thông tin tập 1 và phim, hoặc object rỗng
 */
exports.getFirstEpisode = async (slug) => {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return {};
    }

    try {
        const detailData = await exports.getMovieDetail(slug);
        if (!detailData || Object.keys(detailData).length === 0) {
            return {};
        }

        const movieInfo = detailData.movie || detailData.data?.item || {};
        const episodes = detailData.episodes || detailData.data?.item?.episodes || [];
        const firstServer = episodes[0];
        const firstEpisode = firstServer?.server_data?.[0];

        if (!firstEpisode) {
            return {
                movie: movieInfo,
                episode: null,
                embedUrl: null,
                m3u8Url: null
            };
        }

        return {
            movie: movieInfo,
            serverName: firstServer?.server_name || '',
            episodeName: firstEpisode.name || '',
            embedUrl: firstEpisode.link_embed || null,
            m3u8Url: firstEpisode.link_m3u8 || null
        };
    } catch (error) {
        console.error(`[OPhim Service] Lỗi lấy tập đầu tiên slug "${slug}":`, error.message);
        return {};
    }
};

// Alias tương thích với yêu cầu gọi searchOphim
exports.searchOphim = exports.searchMovies;
