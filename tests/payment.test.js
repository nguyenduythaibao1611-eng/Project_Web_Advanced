const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/userModel');
const VipPlan = require('../models/vipPlanModel');
const Order = require('../models/orderModel');

let server;
let base;
let testUserToken;
let testUserId = '507f1f77bcf86cd799439077';
let testSessionId = 'test-session-payment-uuid';

const origUserFindById = User.findById;
const origPlanFind = VipPlan.find;
const origPlanFindOne = VipPlan.findOne;
const origPlanCount = VipPlan.countDocuments;
const origPlanInsertMany = VipPlan.insertMany;
const origPlanCreate = VipPlan.create;
const origOrderCreate = Order.create;
const origOrderFindOne = Order.findOne;
const origOrderFind = Order.find;
const origOrderCount = Order.countDocuments;

let mockUser;
let mockOrders = [];
let mockPlans = [];

before(async () => {
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_cineverse';
    process.env.JWT_SECRET = secret;

    testUserToken = jwt.sign(
        { id: testUserId, username: 'payinguser', sessionId: testSessionId },
        secret,
        { expiresIn: '1d' }
    );

    mockUser = {
        _id: testUserId,
        username: 'payinguser',
        email: 'payinguser@cineverse.test',
        role: 'user',
        isVip: false,
        vipExpiresAt: null,
        vipPlan: null,
        activeSessionId: testSessionId,
        save: async function () { return this; }
    };

    mockPlans = [
        {
            _id: '507f1f77bcf86cd799439001',
            code: 'vip_1m',
            name: 'VIP 1 Tháng',
            durationDays: 30,
            price: 49000,
            originalPrice: 69000,
            badge: 'Gói Trải Nghiệm',
            features: ['Xem phim 4K', 'Không quảng cáo'],
            isPopular: false,
            isActive: true,
            order: 1
        },
        {
            _id: '507f1f77bcf86cd799439002',
            code: 'vip_1y',
            name: 'VIP 1 Năm',
            durationDays: 365,
            price: 499000,
            originalPrice: 828000,
            badge: '👑 Phổ Biến Nhất',
            features: ['Trọn vẹn 365 ngày'],
            isPopular: true,
            isActive: true,
            order: 2
        }
    ];

    User.findById = (_id) => ({
        select: async () => ({ ...mockUser }),
        then: function(resolve) { resolve(mockUser); }
    });

    VipPlan.find = () => ({
        sort: () => ({
            lean: async () => mockPlans,
            then: (resolve) => resolve(mockPlans)
        }),
        then: (resolve) => resolve(mockPlans)
    });

    VipPlan.findOne = async (query) => {
        if (query && query.code) {
            return mockPlans.find(p => p.code === query.code) || null;
        }
        return mockPlans[0] || null;
    };

    VipPlan.countDocuments = async () => mockPlans.length;
    VipPlan.insertMany = async (items) => items;

    Order.create = async (data) => {
        const order = {
            ...data,
            _id: '507f1f77bcf86cd799439099',
            save: async function () { return this; }
        };
        mockOrders.push(order);
        return order;
    };

    Order.findOne = async (query) => {
        if (query && query.orderCode) {
            return mockOrders.find(o => o.orderCode === query.orderCode) || null;
        }
        return mockOrders[0] || null;
    };

    server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    User.findById = origUserFindById;
    VipPlan.find = origPlanFind;
    VipPlan.findOne = origPlanFindOne;
    VipPlan.countDocuments = origPlanCount;
    VipPlan.insertMany = origPlanInsertMany;
    VipPlan.create = origPlanCreate;
    Order.create = origOrderCreate;
    Order.findOne = origOrderFindOne;
    Order.find = origOrderFind;
    Order.countDocuments = origOrderCount;

    return new Promise((resolve) => server.close(resolve));
});

test('1. VipPlan and Order models have correct schema definitions', () => {
    const planCodePath = VipPlan.schema.path('code');
    const planPricePath = VipPlan.schema.path('price');
    const orderCodePath = Order.schema.path('orderCode');
    const orderAmountPath = Order.schema.path('amount');
    const userExpiresPath = User.schema.path('vipExpiresAt');

    assert.ok(planCodePath, 'VipPlan phải có trường code');
    assert.ok(planPricePath, 'VipPlan phải có trường price');
    assert.ok(orderCodePath, 'Order phải có trường orderCode');
    assert.ok(orderAmountPath, 'Order phải có trường amount');
    assert.ok(userExpiresPath, 'User phải có trường vipExpiresAt');
});

test('2.1 GET /pricing renders pricing page with plans and comparison table', async () => {
    const res = await fetch(`${base}/pricing`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Bảng Giá Gói VIP') || html.includes('Trải Nghiệm Điện Ảnh Đỉnh Cao'));
    assert.ok(html.includes('VIP 1 Tháng'));
    assert.ok(html.includes('49.000'));
});

test('2.2 GET /api/payment/plans returns active plans in JSON', async () => {
    const res = await fetch(`${base}/api/payment/plans`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.plans));
    assert.strictEqual(data.plans.length, 2);
    assert.strictEqual(data.plans[0].code, 'vip_1m');
});

test('3.1 POST /api/payment/create-order rejects unauthenticated user with 401', async () => {
    const res = await fetch(`${base}/api/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: 'vip_1m' })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
});

test('3.2 POST /api/payment/create-order rejects invalid planCode with 404', async () => {
    const res = await fetch(`${base}/api/payment/create-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        },
        body: JSON.stringify({ planCode: 'non_existent_plan' })
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
});

let createdOrderCode;

test('3.3 POST /api/payment/create-order successfully creates order and VietQR link', async () => {
    const res = await fetch(`${base}/api/payment/create-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        },
        body: JSON.stringify({ planCode: 'vip_1m' })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.order.orderCode.startsWith('CV'));
    assert.strictEqual(data.order.amount, 49000); // Lấy giá từ DB
    assert.ok(data.order.qrCodeUrl.includes('vietqr.io'));
    assert.ok(data.order.qrCodeUrl.includes('49000'));
    createdOrderCode = data.order.orderCode;
});

test('4. GET /api/payment/check-status/:orderCode returns pending status', async () => {
    const res = await fetch(`${base}/api/payment/check-status/${createdOrderCode}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.status, 'pending');
    assert.strictEqual(data.isCompleted, false);
});

test('5. POST /api/payment/simulate-success completes order and upgrades user to VIP', async () => {
    const res = await fetch(`${base}/api/payment/simulate-success`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        },
        body: JSON.stringify({ orderCode: createdOrderCode })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Kiểm tra order được đổi sang completed
    const orderInDb = mockOrders.find(o => o.orderCode === createdOrderCode);
    assert.strictEqual(orderInDb.status, 'completed');

    // Kiểm tra user được cấp VIP
    assert.strictEqual(mockUser.isVip, true);
    assert.ok(mockUser.vipExpiresAt instanceof Date);
});

test('6.1 POST /api/payment/sepay-webhook verifies amount and completes order', async () => {
    // Tạo đơn mới để test webhook
    const newOrderCode = 'CV998877AABB';
    mockOrders.push({
        orderCode: newOrderCode,
        user: testUserId,
        planCode: 'vip_1m',
        planName: 'VIP 1 Tháng',
        durationDays: 30,
        amount: 49000,
        status: 'pending',
        transferContent: newOrderCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        save: async function () { return this; }
    });

    const webhookPayload = {
        id: 99999,
        gateway: 'MBBank',
        transactionDate: '2026-11-02 11:00:00',
        accountNumber: '0987654321',
        content: `Thanh toan don hang ${newOrderCode} thanh cong`,
        transferType: 'in',
        transferAmount: 49000,
        referenceCode: 'FT26110299999'
    };

    const res = await fetch(`${base}/api/payment/sepay-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const updatedOrder = mockOrders.find(o => o.orderCode === newOrderCode);
    assert.strictEqual(updatedOrder.status, 'completed');
});

test('6.2 POST /api/payment/sepay-webhook rejects if transferAmount is insufficient', async () => {
    const underpaidOrderCode = 'CV112233CCDD';
    mockOrders.push({
        orderCode: underpaidOrderCode,
        user: testUserId,
        planCode: 'vip_1m',
        planName: 'VIP 1 Tháng',
        durationDays: 30,
        amount: 49000,
        status: 'pending',
        transferContent: underpaidOrderCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        save: async function () { return this; }
    });

    const underpaidPayload = {
        id: 99998,
        content: `Thanh toan ${underpaidOrderCode}`,
        transferAmount: 20000 // Thiếu tiền (20k < 49k)
    };

    const res = await fetch(`${base}/api/payment/sepay-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(underpaidPayload)
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
});
