const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-admin-test-secret-never-use-in-production';
const User = require('../models/userModel');
const Movie = require('../models/movieModel');
const Log = require('../models/adminLogModel');
const app = require('../app');
const database = `cineverse_admin_test_${crypto.randomBytes(8).toString('hex')}`;
let server;
let base;
let admin;
let member;
let adminCookie;
let memberCookie;
let movie;
const uploaded = [];

function cookie(user) {
    return `cineverse_token=${jwt.sign({ id: user._id, sessionId: user.activeSessionId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}
function token(user) {
    return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`admin:${user._id}:${user.activeSessionId}`).digest('hex');
}
function get(url, auth = adminCookie) {
    return fetch(base + url, { headers: { Cookie: auth }, redirect: 'manual' });
}
function post(url, body, auth = adminCookie) {
    return fetch(base + url, { method: 'POST', headers: { Cookie: auth }, body: new URLSearchParams(body), redirect: 'manual' });
}
const input = () => ({ title: 'Phim kiểm thử <script>alert(1)</script>', slug: 'phim-kiem-thu', type: 'single', status: 'completed', isVip: 'false', isPublished: 'false', year: '2026',
    'episodes[0][server]': 'Test Server', 'episodes[0][type]': 'iframe', 'episodes[0][name]': 'Full', 'episodes[0][slug]': 'full',
    'episodes[0][embed]': 'https://example.com/private-test-player', 'episodes[0][hls]': '', _csrf: token(admin) });

before(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: database, serverSelectionTimeoutMS: 5000 });
    await Promise.all([User.init(), Movie.init(), Log.init()]);
    admin = await User.create({ username: 'testadmin', email: 'admin@example.test', password: 'Admin-test-2026!', role: 'admin', activeSessionId: 'admin-test-session' });
    member = await User.create({ username: 'testmember', email: 'member@example.test', password: 'Member-test-2026!', activeSessionId: 'member-test-session' });
    adminCookie = cookie(admin);
    memberCookie = cookie(member);
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const file of uploaded) await fs.unlink(file).catch(() => {});
    if (mongoose.connection.name === database && /^cineverse_admin_test_[a-f0-9]+$/.test(database)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

test('all admin pages and writes reject guests and ordinary members', async () => {
    for (const endpoint of ['/admin', '/admin/users', '/admin/movies', '/admin/movies/new', '/admin/logs', '/admin/unknown']) {
        assert.equal((await get(endpoint, '')).status, 302);
        assert.equal((await get(endpoint, memberCookie)).status, 403);
    }
    for (const endpoint of ['/admin/movies', `/admin/users/${member._id}`, '/admin/upload', '/admin/logout']) {
        assert.equal((await post(endpoint, {}, memberCookie)).status, 403);
        assert.equal((await post(endpoint, {}, '')).status, 302);
    }
    assert.equal(await Log.countDocuments(), 0);
});

test('admin pages render real data with no cached/private auth fields', async () => {
    for (const endpoint of ['/admin', '/admin/users', '/admin/movies', '/admin/movies/new', '/admin/logs']) {
        const response = await get(endpoint);
        const html = await response.text();
        assert.equal(response.status, 200, html);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(html, /admin-test-session|member-test-session|\$2[aby]\$/);
    }
    const invalid = await get('/admin/users?page=0');
    assert.equal(invalid.status, 400);
    assert.equal((await get('/admin/movies?state=bogus')).status, 400);
});

test('mutations require a valid session-bound CSRF token', async () => {
    assert.equal((await post('/admin/movies', {})).status, 403);
    assert.equal((await post('/admin/movies', { ...input(), _csrf: token(member) })).status, 403);
    assert.equal(await Movie.countDocuments(), 0);
});

test('create movie preserves episodes, escapes titles, validates fields and retains failed input', async () => {
    let response = await post('/admin/movies', input());
    assert.equal(response.status, 302, await response.text());
    movie = await Movie.findOne({ slug: 'phim-kiem-thu' });
    assert.equal(movie.danh_sach_server[0].server_data[0].link_embed, 'https://example.com/private-test-player');
    assert.equal((await get('/library/phim-kiem-thu', '')).status, 404);
    const html = await (await get('/admin/movies')).text();
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    response = await post('/admin/movies', { ...input(), slug: 'invalid-new', year: '1000' });
    assert.equal(response.status, 400);
    const failed = await response.text();
    assert.match(failed, /Test Server/);
    assert.match(failed, /private-test-player/);
    assert.equal((await post('/admin/movies', input())).status, 400);
    assert.equal((await post('/admin/movies', { ...input(), slug: 'bad-url', poster_url: 'javascript:alert(1)' })).status, 400);
});

test('publish and hide affect public detail; stale revisions cannot overwrite', async () => {
    const values = { ...input(), revision: String(movie.__v), isPublished: 'true' };
    assert.equal((await post(`/admin/movies/${movie._id}`, values)).status, 302);
    assert.equal((await get('/library/phim-kiem-thu', '')).status, 200);
    assert.equal((await post(`/admin/movies/${movie._id}`, values)).status, 409);
    movie = await Movie.findById(movie._id);
    assert.equal((await post(`/admin/movies/${movie._id}`, { ...values, revision: String(movie.__v), isPublished: 'false' })).status, 302);
    assert.equal((await get('/library/phim-kiem-thu', '')).status, 404);
});

test('VIP sources never appear in HTML for guests or non-VIP users', async () => {
    movie = await Movie.findById(movie._id);
    assert.equal((await post(`/admin/movies/${movie._id}`, { ...input(), revision: String(movie.__v), isPublished: 'true', isVip: 'true' })).status, 302);
    const guest = await (await get('/library/phim-kiem-thu', '')).text();
    const normal = await (await get('/library/phim-kiem-thu', memberCookie)).text();
    assert.doesNotMatch(guest, /private-test-player/);
    assert.doesNotMatch(normal, /private-test-player/);
    assert.match(await (await get('/library/phim-kiem-thu')).text(), /private-test-player/);
});

test('user update is allowlisted, revokes sessions, and protects every admin account', async () => {
    const body = { _csrf: token(admin), revision: '0', role: 'user', isVip: 'true', isBlocked: 'true', username: 'hacked' };
    assert.equal((await post(`/admin/users/${member._id}`, body)).status, 302);
    const updated = await User.findById(member._id);
    assert.equal(updated.username, 'testmember');
    assert.equal(updated.isBlocked, true);
    assert.equal(updated.activeSessionId, null);
    assert.equal((await get('/admin', memberCookie)).status, 302);
    assert.equal((await post(`/admin/users/${admin._id}`, body)).status, 409);
    assert.equal((await User.findById(admin._id)).role, 'admin');
});

test('blocked accounts cannot login, activeSessionId persists on normal login', async () => {
    let response = await post('/login', { usernameOrEmail: 'testmember', password: 'Member-test-2026!' }, '');
    assert.equal(response.status, 401);
    response = await post('/login', { usernameOrEmail: 'testadmin', password: 'Admin-test-2026!', redirect: '/admin' }, '');
    assert.equal(response.status, 302);
    const freshCookie = response.headers.get('set-cookie').split(';')[0];
    assert.equal((await get('/admin', adminCookie)).status, 302);
    assert.equal((await get('/admin', freshCookie)).status, 200);
    admin = await User.findById(admin._id);
    adminCookie = freshCookie;
});

test('upload enforces CSRF, file size and file signatures and audits successful writes', async () => {
    let response = await fetch(base + '/admin/upload', { method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'image/png', 'X-CSRF-Token': token(admin) }, body: Buffer.from('<script>alert(1)</script>') });
    assert.equal(response.status, 400);
    response = await fetch(base + '/admin/upload', { method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'image/png', 'X-CSRF-Token': token(admin) }, body: Buffer.alloc(5 * 1024 * 1024 + 1) });
    assert.equal(response.status, 413);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    response = await fetch(base + '/admin/upload', { method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'image/png', 'X-CSRF-Token': token(admin) }, body: png });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.match(result.url, /^\/uploads\/admin\/[a-f0-9-]+\.png$/);
    uploaded.push(path.join(__dirname, '../public', result.url));
    const uploadedImage = await get(result.url);
    assert.equal(uploadedImage.status, 200);
    assert.equal(uploadedImage.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(await Log.countDocuments({ status: 'success' }) >= 4);
    assert.ok(await Log.countDocuments({ status: 'failed' }) >= 1);
});

test('database role is rechecked on every request, logout invalidates session', async () => {
    const other = await User.create({ username: 'otheradmin', email: 'other@example.test', password: 'Other-test-2026!', role: 'admin', activeSessionId: 'other-session' });
    const auth = cookie(other);
    assert.equal((await get('/admin', auth)).status, 200);
    await User.updateOne({ _id: other._id }, { role: 'user' });
    assert.equal((await get('/admin', auth)).status, 403);
    assert.equal((await post('/admin/logout', { _csrf: token(admin) })).status, 302);
    assert.equal((await get('/admin', adminCookie)).status, 302);
});
