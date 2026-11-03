const express = require('express');
const router = express.Router();

const movieRoutes = require('./movieRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const authRoutes = require('./authRoutes');
const watchHistoryRoutes = require('./watchHistoryRoutes');
const adminRoutes = require('./adminRoutes');
const paymentRoutes = require('./paymentRoutes');

router.use('/', movieRoutes);
router.use('/', favoriteRoutes);
router.use('/', authRoutes);
router.use('/', watchHistoryRoutes);
router.use('/', paymentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
