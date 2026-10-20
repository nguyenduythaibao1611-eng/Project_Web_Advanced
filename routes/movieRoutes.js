const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');

router.get('/', movieController.getPopular);
router.get('/movies/:id', movieController.getMovieDetail);


module.exports = router;