// Chỉ tạo dữ liệu giả trong database riêng, server chỉ lắng nghe trên loopback.
const crypto = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const assert = require('node:assert/strict');
const User = require('../models/userModel');
const Movie = require('../models/movieModel');
const app = require('../app');
const database = `cineverse_admin_preview_${crypto.randomBytes(8).toString('hex')}`;
let server;
let closing = false;

async function close() {
    if (closing) return;
    closing = true;
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database && /^cineverse_admin_preview_[a-f0-9]+$/.test(database)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}
async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: database, serverSelectionTimeoutMS: 5000 });
    const sessionId = crypto.randomUUID();
    const [admin] = await User.create([
        { username: 'adminpreview', email: 'admin@preview.test', password: 'Preview-local-2026!', role: 'admin', activeSessionId: sessionId },
        { username: 'memberpreview', email: 'member@preview.test', password: 'Preview-local-2026!', isVip: true }
    ]);
    await Movie.create([
        { title: 'Hành trình điện ảnh — phim demo', slug: 'hanh-trinh-demo', year: 2026, quality: 'FHD', isPublished: true, overview: 'Dữ liệu giả để thử giao diện quản trị. Không phải phim công khai của hệ thống.' },
        { title: 'Thành phố ngày mai — phim demo', slug: 'thanh-pho-demo', year: 2025, isVip: true, isPublished: true },
        { title: 'Câu chuyện chưa kể — bản nháp', slug: 'cau-chuyen-demo', year: 2026, isPublished: false }
    ]);
    const preview = express();
    const token = jwt.sign({ id: admin._id, sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    app.locals.isAdminPreview = true;
    preview.all('/admin/logout', (_req, res) => res.redirect('/admin'));
    preview.use((req, _res, next) => {
        req.headers.cookie = `cineverse_token=${token}`;
        next();
    });
    preview.use(app);
    server = preview.listen(5010, '127.0.0.1', async () => {
        try {
            const response = await fetch('http://127.0.0.1:5010/admin', { redirect: 'manual' });
            assert.equal(response.status, 200, 'Demo phải vào được mà không cần cookie đăng nhập.');
            console.log('Admin preview: http://127.0.0.1:5010/admin · Vào trực tiếp, không cần đăng nhập · Database demo riêng.');
        } catch (error) {
            console.error(error.message);
            await close();
            process.exitCode = 1;
        }
    });
    server.on('error', async error => { console.error(error.message); await close(); process.exitCode = 1; });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close().then(() => process.exit(0)));
run().catch(async error => { console.error(error.message); await close(); process.exitCode = 1; });
