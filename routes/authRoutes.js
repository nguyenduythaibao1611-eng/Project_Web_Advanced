const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Trang Đăng nhập & Đăng ký
router.get('/login', authController.getLoginPage);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegisterPage);
router.post('/register', authController.postRegister);

// Onboarding người dùng (Khảo sát sở thích 3-5 thể loại phim)
router.get('/onboarding', requireAuth, authController.getOnboardingPage);
router.post('/onboarding', requireAuth, authController.postOnboarding);

// Đăng xuất (hỗ trợ cả GET link và POST form)
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

// API kiểm tra trạng thái người dùng & lưu sở thích
router.get('/api/auth/me', authController.getCurrentUser);
router.post('/api/user/preferences', requireAuth, authController.postOnboarding);
router.post('/api/onboarding', requireAuth, authController.postOnboarding);

// API Nâng cấp & Quản lý VIP
router.post('/api/auth/upgrade-vip', requireAuth, authController.upgradeVip);
router.post('/api/auth/toggle-vip', requireAuth, authController.toggleVip);

module.exports = router;
