require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/userModel');

async function run() {
    const email = process.argv[2];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Cách dùng: node scripts/grantAdmin.js email-tai-khoan-da-dang-ky');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cineverse', { serverSelectionTimeoutMS: 5000 });
    const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase(), isBlocked: { $ne: true } },
        { role: 'admin', activeSessionId: null }, { returnDocument: 'after' });
    if (!user) throw new Error('Không tìm thấy tài khoản hoạt động có email này. Hãy đăng ký trước.');
    console.log(`Đã cấp quyền admin cho ${user.username}. Đăng nhập lại rồi mở /admin.`);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
