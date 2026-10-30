const express = require('express');
const router = express.Router();

const movieRoutes = require('./movieRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const authRoutes = require('./authRoutes');
const watchHistoryRoutes = require('./watchHistoryRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/', movieRoutes);
router.use('/', favoriteRoutes);
router.use('/', authRoutes);
router.use('/', watchHistoryRoutes);
router.use('/', adminRoutes);

module.exports = router;
