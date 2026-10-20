const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

// 1. Giao diện trang web xem danh sách phim yêu thích
router.get('/favorites', favoriteController.getFavoritesPage);

// 2. Các API tương tác dữ liệu
router.get('/api/favorites', favoriteController.getAllFavoritesApi);
router.get('/api/favorites/ids', favoriteController.getFavoriteIds);
router.post('/api/favorites/toggle', favoriteController.toggleFavorite);
router.post('/api/favorites', favoriteController.addFavorite);
router.delete('/api/favorites/:movieId', favoriteController.removeFavorite);

module.exports = router;
