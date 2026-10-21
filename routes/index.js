const express = require('express');
const router = express.Router();

const movieRoutes = require('./movieRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const authRoutes = require('./authRoutes');

router.use('/', movieRoutes);
router.use('/', favoriteRoutes);
router.use('/', authRoutes);

module.exports = router;
