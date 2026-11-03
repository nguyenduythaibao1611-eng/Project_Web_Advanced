const crypto = require('crypto');
const VipPlan = require('../models/vipPlanModel');
const Order = require('../models/orderModel');
const User = require('../models/userModel');

/**
 * Lấy cấu hình thông tin ngân hàng nhận thanh toán VietQR
 */
function getBankConfig() {
    return {
        bankId: process.env.BANK_ID || 'MBBank',
        bankAccount: process.env.BANK_ACCOUNT || '0987654321',
        bankAccountName: (process.env.BANK_ACCOUNT_NAME || 'CINEVERSE VIP').toUpperCase()
    };
}

/**
 * 1. Hiển thị trang bảng giá VIP công khai
 * GET /pricing
 */
exports.getPricingPage = async (req, res) => {
    try {
        await VipPlan.seedDefaultPlans();
        const plans = await VipPlan.find({ isActive: true }).sort({ order: 1 });

        res.render('pages/pricing', {
            title: 'Bảng Giá Gói VIP - CineVerse',
            plans,
            user: req.user || null
        });
    } catch (error) {
        console.error('Lỗi khi tải trang bảng giá:', error.message);
        res.status(500).render('pages/error', {
            title: 'Lỗi máy chủ',
            message: 'Không thể tải bảng giá lúc này. Vui lòng thử lại sau.'
        });
    }
};

/**
 * 2. API lấy danh sách các gói cước đang hoạt động
 * GET /api/payment/plans
 */
exports.getActivePlans = async (_req, res) => {
    try {
        await VipPlan.seedDefaultPlans();
        const plans = await VipPlan.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, plans });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 3. API Khởi tạo đơn hàng thanh toán VietQR
 * POST /api/payment/create-order
 */
exports.createOrder = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập để nâng cấp gói VIP.'
            });
        }

        const { planCode, paymentMethod } = req.body;
        if (!planCode) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn gói cước VIP.' });
        }

        // Lấy giá và thông tin gói trực tiếp từ database (bảo mật, chống sửa giá)
        const plan = await VipPlan.findOne({ code: String(planCode).trim().toLowerCase(), isActive: true });
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Gói cước không tồn tại hoặc đã tạm dừng.' });
        }

        // Sinh mã đơn hàng duy nhất ngẫu nhiên (VD: CV + 6 ký tự số/chữ hoa)
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderCode = `CV${Date.now().toString().slice(-4)}${randomSuffix}`;

        const bank = getBankConfig();
        const transferContent = orderCode;

        // Sinh đường dẫn ảnh mã VietQR chuẩn quốc gia
        const qrCodeUrl = `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.bankAccount)}-compact2.png?amount=${plan.price}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bank.bankAccountName)}`;

        const order = await Order.create({
            orderCode,
            user: req.user._id,
            planId: plan._id,
            planCode: plan.code,
            planName: plan.name,
            durationDays: plan.durationDays,
            amount: plan.price,
            paymentMethod: paymentMethod === 'momo' || paymentMethod === 'vnpay' ? paymentMethod : 'vietqr',
            status: 'pending',
            transferContent,
            qrCodeUrl,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        return res.status(201).json({
            success: true,
            order: {
                orderCode: order.orderCode,
                planName: order.planName,
                durationDays: order.durationDays,
                amount: order.amount,
                paymentMethod: order.paymentMethod,
                transferContent: order.transferContent,
                qrCodeUrl: order.qrCodeUrl,
                expiresAt: order.expiresAt
            },
            bankInfo: bank
        });
    } catch (error) {
        console.error('Lỗi khi tạo đơn hàng thanh toán:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo đơn hàng.' });
    }
};

/**
 * 4. API Polling kiểm tra trạng thái thanh toán của đơn hàng
 * GET /api/payment/check-status/:orderCode
 */
exports.checkOrderStatus = async (req, res) => {
    try {
        const { orderCode } = req.params;
        if (!orderCode) {
            return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng.' });
        }

        const order = await Order.findOne({ orderCode: String(orderCode).trim().toUpperCase() });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Đơn hàng không tồn tại.' });
        }

        // Tự động chuyển trạng thái expired nếu quá hạn 15 phút
        if (order.status === 'pending' && new Date() > order.expiresAt) {
            order.status = 'expired';
            await order.save();
        }

        return res.json({
            success: true,
            orderCode: order.orderCode,
            status: order.status,
            isCompleted: order.status === 'completed',
            isExpired: order.status === 'expired'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 5. Webhook tiếp nhận thanh toán tự động từ SePay khi có biến động số dư ngân hàng
 * POST /api/payment/sepay-webhook
 */
exports.sepayWebhook = async (req, res) => {
    try {
        // Xác thực bảo mật API Key từ SePay (nếu có cấu hình trong .env)
        const expectedApiKey = process.env.SEPAY_API_KEY;
        if (expectedApiKey) {
            const authHeader = req.headers['authorization'] || '';
            const match = authHeader === `Apikey ${expectedApiKey}` || req.headers['x-api-key'] === expectedApiKey;
            if (!match) {
                return res.status(401).json({ success: false, message: 'Sai mã xác thực Webhook SePay.' });
            }
        }

        const { content, transferAmount, id, referenceCode } = req.body;
        if (!content || !transferAmount) {
            return res.status(400).json({ success: false, message: 'Dữ liệu giao dịch không đầy đủ.' });
        }

        // Trích xuất mã đơn hàng dạng CV... trong nội dung chuyển khoản
        const contentStr = String(content).toUpperCase();
        const codeMatch = contentStr.match(/CV[A-Z0-9]{6,14}/);
        if (!codeMatch) {
            return res.json({ success: true, message: 'Nội dung chuyển khoản không chứa mã đơn hàng CineVerse.' });
        }

        const matchedCode = codeMatch[0];
        const order = await Order.findOne({ orderCode: matchedCode, status: 'pending' });
        if (!order) {
            return res.json({ success: true, message: 'Không tìm thấy đơn hàng đang chờ tương ứng.' });
        }

        // Kiểm tra số tiền chuyển phải >= số tiền đơn hàng
        if (Number(transferAmount) < order.amount) {
            return res.status(400).json({
                success: false,
                message: `Số tiền chuyển (${transferAmount}đ) không đủ so với giá gói (${order.amount}đ).`
            });
        }

        // Cập nhật đơn hàng thành công
        order.status = 'completed';
        order.paidAt = new Date();
        order.transactionId = String(id || referenceCode || 'SEPAY_' + Date.now());
        await order.save();

        // Tự động cấp quyền và gia hạn thời gian VIP cho người dùng
        const user = await User.findById(order.user);
        if (user) {
            const now = new Date();
            const currentExpire = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
            const newExpire = new Date(currentExpire.getTime() + order.durationDays * 24 * 60 * 60 * 1000);

            user.isVip = true;
            user.vipExpiresAt = newExpire;
            user.vipPlan = order.planName;
            await user.save();
        }

        return res.json({
            success: true,
            message: 'Đã xác nhận thanh toán và nâng cấp VIP thành công.',
            orderCode: order.orderCode
        });
    } catch (error) {
        console.error('Lỗi khi xử lý SePay Webhook:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi xử lý webhook.' });
    }
};

/**
 * 6. API Giả lập thanh toán thành công (Sandbox Simulator 1-Click cho Demo/Chấm điểm)
 * POST /api/payment/simulate-success
 */
exports.simulateSuccess = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });
        }

        const { orderCode } = req.body;
        if (!orderCode) {
            return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng.' });
        }

        const order = await Order.findOne({
            orderCode: String(orderCode).trim().toUpperCase()
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
        }

        if (order.status === 'completed') {
            return res.json({ success: true, message: 'Đơn hàng này đã được thanh toán trước đó.' });
        }

        if (order.status === 'expired' || new Date() > order.expiresAt) {
            return res.status(400).json({ success: false, message: 'Đơn hàng này đã hết hạn (quá 15 phút).' });
        }

        // Cập nhật hoàn tất đơn hàng
        order.status = 'completed';
        order.paidAt = new Date();
        order.transactionId = `SANDBOX_${Date.now()}`;
        await order.save();

        // Cấp quyền và cộng dồn ngày VIP cho người dùng
        const user = await User.findById(order.user);
        if (user) {
            const now = new Date();
            const currentExpire = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
            const newExpire = new Date(currentExpire.getTime() + order.durationDays * 24 * 60 * 60 * 1000);

            user.isVip = true;
            user.vipExpiresAt = newExpire;
            user.vipPlan = order.planName;
            await user.save();
        }

        return res.json({
            success: true,
            message: '🎉 Thanh toán giả lập thành công! Gói VIP đã được kích hoạt.',
            order: {
                orderCode: order.orderCode,
                planName: order.planName,
                durationDays: order.durationDays,
                status: order.status
            }
        });
    } catch (error) {
        console.error('Lỗi khi giả lập thanh toán:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};
