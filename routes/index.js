const express = require('express');
const router = express.Router();

const movieRoutes = require('./movieRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/', movieRoutes);
router.use('/', favoriteRoutes);
router.use('/', authRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
