const express = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const security = require('../middlewares/adminMiddleware');
const controller = require('../controllers/adminController');
const { logout } = require('../controllers/authController');
const router = express.Router();

router.use(requireAuth, requireAdmin);
router.use('/upload', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }));
router.use(security);
router.use((req, res, next) => {
    res.locals.notice = req.query.saved === '1' ? 'Đã lưu thay đổi thành công.' : '';
    next();
});
router.get('/', controller.dashboard);
router.get('/users', controller.users);
router.post('/users/:id', controller.updateUser);
router.get('/movies', controller.movies);
router.get('/movies/new', controller.movieForm);
router.get('/movies/:id/edit', controller.movieForm);
router.post('/movies', controller.saveMovie);
router.post('/movies/:id', controller.saveMovie);
router.get('/logs', controller.logs);
router.post('/upload', controller.upload);
router.post('/logout', logout);
router.use((req, res) => res.status(404).render('admin/error', { layout: 'layouts/admin', title: 'Không tìm thấy', status: 404, message: 'Trang quản trị không tồn tại.' }));
router.use(controller.error);
module.exports = router;
