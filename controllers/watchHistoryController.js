const WatchHistory = require('../models/watchHistoryModel');

/**
 * 1. Lưu hoặc cập nhật vị trí xem phim của người dùng hiện tại (Upsert)
 * POST /api/history
 */
exports.saveHistory = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập để lưu lịch sử xem.'
            });
        }

        const { movieId, movieTitle, posterUrl, episode, currentTime, duration } = req.body;

        const numericMovieId = Number(movieId);
        if (!numericMovieId || isNaN(numericMovieId)) {
            return res.status(400).json({
                success: false,
                message: 'movieId không hợp lệ.'
            });
        }

        const numCurrentTime = Math.max(0, Math.floor(Number(currentTime) || 0));
        const numDuration = Math.max(0, Math.floor(Number(duration) || 0));

        const history = await WatchHistory.findOneAndUpdate(
            { userId: req.user._id, movieId: numericMovieId },
            {
                userId: req.user._id,
                movieId: numericMovieId,
                movieTitle: movieTitle ? String(movieTitle).trim() : 'Không có tiêu đề',
                posterUrl: posterUrl ? String(posterUrl).trim() : '',
                episode: episode ? String(episode).trim() : 'Tập 1',
                currentTime: numCurrentTime,
                duration: numDuration,
                updatedAt: new Date()
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        return res.json({
            success: true,
            message: 'Đã lưu lịch sử xem thành công.',
            data: history
        });
    } catch (error) {
        console.error('Lỗi khi lưu lịch sử xem:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi lưu lịch sử xem phim.',
            error: error.message
        });
    }
};

/**
 * 2. Lấy danh sách toàn bộ phim đang xem dở của người dùng hiện tại
 * GET /api/history
 */
exports.getHistoryList = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập để xem lịch sử.'
            });
        }

        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const list = await WatchHistory.find({ userId: req.user._id })
            .sort({ updatedAt: -1 })
            .limit(limit);

        return res.json({
            success: true,
            count: list.length,
            data: list
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách lịch sử xem:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi lấy danh sách lịch sử xem.',
            error: error.message
        });
    }
};

/**
 * 3. Lấy vị trí xem dở của một bộ phim cụ thể
 * GET /api/history/:movieId
 */
exports.getMovieHistory = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập.'
            });
        }

        const numericMovieId = Number(req.params.movieId);
        if (!numericMovieId || isNaN(numericMovieId)) {
            return res.status(400).json({
                success: false,
                message: 'movieId không hợp lệ.'
            });
        }

        const history = await WatchHistory.findOne({
            userId: req.user._id,
            movieId: numericMovieId
        });

        return res.json({
            success: true,
            data: history || null
        });
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử phim:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi lấy lịch sử phim.',
            error: error.message
        });
    }
};

/**
 * 4. Xóa một mục lịch sử xem của người dùng
 * DELETE /api/history/:movieId
 */
exports.deleteHistoryItem = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập.'
            });
        }

        const numericMovieId = Number(req.params.movieId);
        if (!numericMovieId || isNaN(numericMovieId)) {
            return res.status(400).json({
                success: false,
                message: 'movieId không hợp lệ.'
            });
        }

        await WatchHistory.findOneAndDelete({
            userId: req.user._id,
            movieId: numericMovieId
        });

        return res.json({
            success: true,
            message: 'Đã xóa khỏi lịch sử xem thành công.'
        });
    } catch (error) {
        console.error('Lỗi khi xóa lịch sử xem:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi xóa lịch sử xem.',
            error: error.message
        });
    }
};
