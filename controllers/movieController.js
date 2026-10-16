const tmdbService = require('../services/tmdbService');

exports.getPopular = async (req, res) => {
    try {
        const movies = await tmdbService.getPopularMovies();

        res.render('pages/index', {
            title: 'Trang chủ CineVerse',
            movies: movies
        });
    } catch (error) {
        res.status(500).send('Lỗi Server');
    }
};