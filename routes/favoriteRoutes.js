const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { requireAuth } = require('../middlewares/authMiddleware');

// 1. Giao diện trang web xem danh sách phim yêu thích (chuyển hướng sang /login nếu là khách)
router.get('/favorites', requireAuth, favoriteController.getFavoritesPage);

// 2. Các API tương tác dữ liệu (trả về 401 JSON nếu là khách)
router.get('/api/favorites', requireAuth, favoriteController.getAllFavoritesApi);
router.get('/api/favorites/ids', requireAuth, favoriteController.getFavoriteIds);
router.post('/api/favorites/toggle', requireAuth, favoriteController.toggleFavorite);
router.post('/api/favorites', requireAuth, favoriteController.addFavorite);
router.delete('/api/favorites/:movieId', requireAuth, favoriteController.removeFavorite);

module.exports = router;
