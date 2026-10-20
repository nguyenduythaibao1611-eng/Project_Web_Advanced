const express = require('express');
const router = express.Router();

const movieRoutes = require('./movieRoutes');
const favoriteRoutes = require('./favoriteRoutes');

router.use('/', movieRoutes);
router.use('/', favoriteRoutes);

module.exports = router;
