const express = require('express');
const router = express.Router();
const watchHistoryController = require('../controllers/watchHistoryController');
const { requireAuth } = require('../middlewares/authMiddleware');

// API Quản lý Lịch sử xem phim (Cần đăng nhập)
router.post('/api/history', requireAuth, watchHistoryController.saveHistory);
router.get('/api/history', requireAuth, watchHistoryController.getHistoryList);
router.get('/api/history/:movieId', requireAuth, watchHistoryController.getMovieHistory);
router.delete('/api/history/:movieId', requireAuth, watchHistoryController.deleteHistoryItem);

module.exports = router;
