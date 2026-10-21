const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Trang Đăng nhập & Đăng ký
router.get('/login', authController.getLoginPage);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegisterPage);
router.post('/register', authController.postRegister);

// Đăng xuất (hỗ trợ cả GET link và POST form)
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

// API kiểm tra trạng thái người dùng
router.get('/api/auth/me', authController.getCurrentUser);

module.exports = router;
