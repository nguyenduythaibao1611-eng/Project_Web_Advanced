const Favorite = require('../models/favoriteModel');

/**
 * 1. Render giao diện trang danh sách phim yêu thích của người dùng hiện tại
 * GET /favorites (Được bảo vệ bởi requireAuth)
 */
exports.getFavoritesPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });

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
 * 2. Lấy danh sách ID các phim đã được yêu thích của người dùng hiện tại
 * GET /api/favorites/ids (Được bảo vệ bởi requireAuth)
 */
exports.getFavoriteIds = async (req, res) => {
    try {
        const userId = req.user._id;
        const favorites = await Favorite.find({ userId }, 'movieId');
        const ids = favorites.map((item) => item.movieId);
        return res.json({ success: true, ids });
    } catch (error) {
        console.error('Lỗi lấy danh sách ID yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 3. Lấy toàn bộ danh sách phim yêu thích dạng JSON của người dùng hiện tại
 * GET /api/favorites (Được bảo vệ bởi requireAuth)
 */
exports.getAllFavoritesApi = async (req, res) => {
    try {
        const userId = req.user._id;
        const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });
        return res.json({ success: true, count: favorites.length, data: favorites });
    } catch (error) {
        console.error('Lỗi lấy dữ liệu API yêu thích:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 4. Toggle thêm/xóa phim khỏi danh sách yêu thích của người dùng hiện tại
 * POST /api/favorites/toggle (Được bảo vệ bởi requireAuth)
 */
exports.toggleFavorite = async (req, res) => {
    try {
        const userId = req.user._id;
        const { movieId, title, poster_path, vote_average, release_date, overview } = req.body;

        if (!movieId || isNaN(Number(movieId))) {
            return res.status(400).json({
                success: false,
                message: 'movieId không hợp lệ.'
            });
        }

        const numericMovieId = Number(movieId);
        const existing = await Favorite.findOne({ userId, movieId: numericMovieId });

        if (existing) {
            await Favorite.deleteOne({ userId, movieId: numericMovieId });
            return res.json({
                success: true,
                isFavorite: false,
                message: `Đã xóa "${existing.title}" khỏi danh sách yêu thích.`
            });
        }

        const newFavorite = await Favorite.create({
            userId,
            movieId: numericMovieId,
            title: title ? String(title).trim() : 'Không có tiêu đề',
            poster_path: poster_path ? String(poster_path).trim() : '',
            vote_average: Number(vote_average) || 0,
            release_date: release_date ? String(release_date).trim() : '',
            overview: overview ? String(overview).trim() : ''
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
 * POST /api/favorites (Được bảo vệ bởi requireAuth)
 */
exports.addFavorite = async (req, res) => {
    try {
        const userId = req.user._id;
        const { movieId, title, poster_path, vote_average, release_date, overview } = req.body;

        if (!movieId || isNaN(Number(movieId))) {
            return res.status(400).json({ success: false, message: 'movieId không hợp lệ.' });
        }

        const numericMovieId = Number(movieId);
        let favorite = await Favorite.findOne({ userId, movieId: numericMovieId });

        if (!favorite) {
            favorite = await Favorite.create({
                userId,
                movieId: numericMovieId,
                title: title ? String(title).trim() : 'Không có tiêu đề',
                poster_path: poster_path ? String(poster_path).trim() : '',
                vote_average: Number(vote_average) || 0,
                release_date: release_date ? String(release_date).trim() : '',
                overview: overview ? String(overview).trim() : ''
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
 * 6. Xóa phim khỏi yêu thích bằng movieId
 * DELETE /api/favorites/:movieId (Được bảo vệ bởi requireAuth)
 */
exports.removeFavorite = async (req, res) => {
    try {
        const userId = req.user._id;
        const movieId = Number(req.params.movieId);

        if (!movieId || isNaN(movieId)) {
            return res.status(400).json({ success: false, message: 'movieId không hợp lệ.' });
        }

        const deleted = await Favorite.findOneAndDelete({ userId, movieId });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phim này trong danh sách yêu thích của bạn.'
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
