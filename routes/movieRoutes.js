const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');

router.get('/', movieController.getPopular);
router.get('/movies', movieController.getMovieList);
router.get('/search', movieController.search);
router.get('/api/search', movieController.searchSuggestions);
router.get('/movies/:id', movieController.getMovieDetail);


module.exports = router;
