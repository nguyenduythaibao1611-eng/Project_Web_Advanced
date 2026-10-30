const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');
const libraryController = require('../controllers/libraryController');

router.get('/', movieController.getPopular);
router.get('/library', libraryController.list);
router.get('/library/:slug', libraryController.detail);
router.get('/movies/:id', movieController.getMovieDetail);


module.exports = router;
