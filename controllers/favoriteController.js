const Favorite = require('../models/favoriteModel');

/**
 * 1. Render giao diện trang danh sách phim yêu thích
 * GET /favorites
 */
exports.getFavoritesPage = async (req, res) => {
    try {
        const favorites = await Favorite.find().sort({ createdAt: -1 });

        res.render('pages/favorites', {
            title: 'Phim Yêu Thích - CineVerse',
            movies: favorites
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách phim yêu thích:', error.message);
        res.render('pages/favorites', {
            title: 'Phim Yêu Thích - CineVerse',
            movies: [],
            error: 'Không thể tải danh sách phim yêu thích vào lúc này.'
        });
    }
};

/**
 * 2. Lấy danh sách ID các phim đã được yêu thích (dùng cho frontend đánh dấu sao)
 * GET /api/favorites/ids
 */
exports.getFavoriteIds = async (req, res) => {
    try {
        const favorites = await Favorite.find({}, 'movieId');
        const ids = favorites.map((item) => item.movieId);
        return res.json({ success: true, ids });
    } catch (error) {
        console.error('Lỗi lấy danh sách ID yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 3. Lấy toàn bộ danh sách phim yêu thích dạng JSON
 * GET /api/favorites
 */
exports.getAllFavoritesApi = async (req, res) => {
    try {
        const favorites = await Favorite.find().sort({ createdAt: -1 });
        return res.json({ success: true, count: favorites.length, data: favorites });
    } catch (error) {
        console.error('Lỗi lấy dữ liệu API yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 4. Toggle thêm/xóa phim khỏi danh sách yêu thích
 * POST /api/favorites/toggle
 */
exports.toggleFavorite = async (req, res) => {
    try {
        const { movieId, title, poster_path, vote_average, release_date, overview } = req.body;

        if (!movieId) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu movieId trong yêu cầu.'
            });
        }

        const numericMovieId = Number(movieId);
        const existing = await Favorite.findOne({ movieId: numericMovieId });

        if (existing) {
            await Favorite.deleteOne({ movieId: numericMovieId });
            return res.json({
                success: true,
                isFavorite: false,
                message: `Đã xóa "${existing.title}" khỏi danh sách yêu thích.`
            });
        }

        const newFavorite = await Favorite.create({
            movieId: numericMovieId,
            title: title || 'Không có tiêu đề',
            poster_path: poster_path || '',
            vote_average: Number(vote_average) || 0,
            release_date: release_date || '',
            overview: overview || ''
        });

        return res.status(201).json({
            success: true,
            isFavorite: true,
            message: `Đã thêm "${newFavorite.title}" vào danh sách yêu thích ⭐`,
            data: newFavorite
        });
    } catch (error) {
        console.error('Lỗi khi toggle yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 5. Thêm phim vào yêu thích (Explicit POST)
 * POST /api/favorites
 */
exports.addFavorite = async (req, res) => {
    try {
        const { movieId, title, poster_path, vote_average, release_date, overview } = req.body;

        if (!movieId) {
            return res.status(400).json({ success: false, message: 'Thiếu movieId.' });
        }

        const numericMovieId = Number(movieId);
        let favorite = await Favorite.findOne({ movieId: numericMovieId });

        if (!favorite) {
            favorite = await Favorite.create({
                movieId: numericMovieId,
                title: title || 'Không có tiêu đề',
                poster_path: poster_path || '',
                vote_average: Number(vote_average) || 0,
                release_date: release_date || '',
                overview: overview || ''
            });
        }

        return res.json({
            success: true,
            isFavorite: true,
            message: `Đã lưu "${favorite.title}" vào danh sách yêu thích.`,
            data: favorite
        });
    } catch (error) {
        console.error('Lỗi khi thêm yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 6. Xóa phim khỏi yêu thích bằng movieId (DELETE /api/favorites/:movieId)
 */
exports.removeFavorite = async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const deleted = await Favorite.findOneAndDelete({ movieId });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phim này trong danh sách yêu thích.'
            });
        }

        return res.json({
            success: true,
            isFavorite: false,
            message: `Đã xóa "${deleted.title}" khỏi danh sách yêu thích.`
        });
    } catch (error) {
        console.error('Lỗi khi xóa yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
