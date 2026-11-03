const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middlewares/authMiddleware');

// 1. Trang Bảng giá gói VIP
router.get('/pricing', paymentController.getPricingPage);

// 2. API lấy danh sách gói cước hoạt động
router.get('/api/payment/plans', paymentController.getActivePlans);

// 3. API tạo đơn hàng thanh toán VietQR
router.post('/api/payment/create-order', requireAuth, paymentController.createOrder);

// 4. API Polling kiểm tra trạng thái đơn hàng
router.get('/api/payment/check-status/:orderCode', paymentController.checkOrderStatus);

// 5. Webhook nhận thông báo biến động số dư tự động từ SePay
router.post('/api/payment/sepay-webhook', paymentController.sepayWebhook);

// 6. API Giả lập thanh toán thành công (Sandbox Simulator)
router.post('/api/payment/simulate-success', requireAuth, paymentController.simulateSuccess);

module.exports = router;
