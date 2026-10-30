const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/userModel');

let server;
let base;
let testUserToken;
let testUserId = '507f1f77bcf86cd799439055';
let testSessionId = 'test-session-onboarding-uuid';

const origFindById = User.findById;
const origFindByIdAndUpdate = User.findByIdAndUpdate;
const origFindOne = User.findOne;
const origCreate = User.create;

let mockUserData;

before(async () => {
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_cineverse';
    process.env.JWT_SECRET = secret;

    testUserToken = jwt.sign(
        { id: testUserId, username: 'onboardinguser', sessionId: testSessionId },
        secret,
        { expiresIn: '1d' }
    );

    mockUserData = {
        _id: testUserId,
        username: 'onboardinguser',
        email: 'onboarding@cineverse.test',
        role: 'user',
        isVip: false,
        activeSessionId: testSessionId,
        preferences: [],
        age: null
    };

    User.findById = (_id) => ({
        select: async () => ({ ...mockUserData })
    });

    User.findByIdAndUpdate = async (_id, update, _options) => {
        if (update.preferences !== undefined) {
            mockUserData.preferences = update.preferences;
        }
        if (update.age !== undefined) {
            mockUserData.age = update.age;
        }
        return { ...mockUserData };
    };

    server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    User.findById = origFindById;
    User.findByIdAndUpdate = origFindByIdAndUpdate;
    User.findOne = origFindOne;
    User.create = origCreate;

    return new Promise((resolve) => server.close(resolve));
});

test('1. userModel has preferences and age schema fields with correct defaults', () => {
    const preferencesPath = User.schema.path('preferences');
    const agePath = User.schema.path('age');

    assert.ok(preferencesPath, 'Trường preferences phải tồn tại trong User schema');
    assert.strictEqual(preferencesPath.instance, 'Array', 'preferences phải là mảng');
    const elemInstance = preferencesPath.caster?.instance || preferencesPath.embeddedSchemaType?.instance;
    assert.strictEqual(elemInstance, 'String', 'preferences phải là mảng String');

    assert.ok(agePath, 'Trường age phải tồn tại trong User schema');
    assert.strictEqual(agePath.instance, 'Number', 'age phải là kiểu Number');
});

test('2.1 Unauthenticated request to /onboarding redirects to login page', async () => {
    const response = await fetch(`${base}/onboarding`, {
        redirect: 'manual'
    });

    assert.strictEqual(response.status, 302);
    const location = response.headers.get('location');
    assert.ok(location.includes('/login'), 'Phải chuyển hướng về trang /login');
    assert.ok(location.includes('onboarding'), 'Phải lưu lại redirect URL');
});

test('2.2 Authenticated user successfully accesses /onboarding view', async () => {
    const response = await fetch(`${base}/onboarding`, {
        headers: {
            Cookie: `cineverse_token=${testUserToken}`
        }
    });

    assert.strictEqual(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('Khảo Sát Sở Thích'), 'Trang phải có tiêu đề khảo sát');
    assert.ok(html.includes('Hành động'), 'Trang phải có thể loại Hành động');
    assert.ok(html.includes('Tình cảm'), 'Trang phải có thể loại Tình cảm');
    assert.ok(html.includes('Hoạt hình'), 'Trang phải có thể loại Hoạt hình');
    assert.ok(html.includes('Bắt đầu khám phá'), 'Phải có nút Bắt đầu khám phá');
});

test('3.1 Successful registration redirects to /onboarding (form submission)', async () => {
    User.findOne = async () => null; // Không trùng username / email
    User.create = async (data) => ({
        _id: '507f1f77bcf86cd799439099',
        username: data.username,
        email: data.email,
        preferences: [],
        age: null
    });

    const body = new URLSearchParams({
        username: 'newregisteruser',
        email: 'newuser@cineverse.test',
        password: 'password123',
        confirmPassword: 'password123'
    });

    const response = await fetch(`${base}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        redirect: 'manual'
    });

    assert.strictEqual(response.status, 302);
    const location = response.headers.get('location');
    assert.strictEqual(location, '/onboarding', 'Sau khi đăng ký thành công phải chuyển hướng đến /onboarding');
});

test('3.2 Successful registration via API returns 201 and redirectTo /onboarding', async () => {
    User.findOne = async () => null;
    User.create = async (data) => ({
        _id: '507f1f77bcf86cd799439098',
        username: data.username,
        email: data.email,
        preferences: [],
        age: null
    });

    const response = await fetch(`${base}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            username: 'apiuser',
            email: 'apiuser@cineverse.test',
            password: 'password123',
            confirmPassword: 'password123'
        })
    });

    assert.strictEqual(response.status, 201);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.redirectTo, '/onboarding');
});

test('4.1 POST /onboarding rejects when less than 3 genres are chosen', async () => {
    const response = await fetch(`${base}/onboarding`, {
        method: 'POST',
        headers: {
            Cookie: `cineverse_token=${testUserToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            preferences: ['Hành động', 'Hoạt hình'] // chỉ có 2 thể loại
        })
    });

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('3 đến 5 thể loại'));
});

test('4.2 POST /onboarding rejects when more than 5 genres are chosen', async () => {
    const response = await fetch(`${base}/onboarding`, {
        method: 'POST',
        headers: {
            Cookie: `cineverse_token=${testUserToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            preferences: ['Hành động', 'Tình cảm', 'Hoạt hình', 'Kinh dị', 'Hài hước', 'Viễn tưởng'] // 6 thể loại
        })
    });

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('3 đến 5 thể loại'));
});

test('4.3 POST /onboarding accepts 3-5 genres and age, saving to user preferences', async () => {
    const chosenGenres = ['Hành động', 'Tình cảm', 'Hoạt hình'];

    const response = await fetch(`${base}/onboarding`, {
        method: 'POST',
        headers: {
            Cookie: `cineverse_token=${testUserToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            preferences: chosenGenres,
            age: 22
        })
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.deepEqual(data.preferences, chosenGenres);
    assert.strictEqual(data.age, 22);

    assert.deepEqual(mockUserData.preferences, chosenGenres);
    assert.strictEqual(mockUserData.age, 22);
});

test('4.4 POST /onboarding via web form redirects to destination after saving preferences', async () => {
    const body = new URLSearchParams();
    body.append('preferences', 'Hành động');
    body.append('preferences', 'Tình cảm');
    body.append('preferences', 'Hoạt hình');
    body.append('preferences', 'Viễn tưởng');
    body.append('age', '25');
    body.append('redirect', '/movies');

    const response = await fetch(`${base}/onboarding`, {
        method: 'POST',
        headers: {
            Cookie: `cineverse_token=${testUserToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        redirect: 'manual'
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.get('location'), '/movies');
    assert.strictEqual(mockUserData.preferences.length, 4);
    assert.strictEqual(mockUserData.age, 25);
});

test('5. GET /api/auth/me returns updated preferences and age', async () => {
    const response = await fetch(`${base}/api/auth/me`, {
        headers: {
            Cookie: `cineverse_token=${testUserToken}`
        }
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.user.preferences));
    assert.ok(data.user.preferences.includes('Hành động'));
    assert.strictEqual(data.user.age, 25);
});
