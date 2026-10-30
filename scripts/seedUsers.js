require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/userModel');

(async () => {
    await connectDB();

    // 1. Tạo hoặc cập nhật tài khoản thường (Free User)
    let normalUser = await User.findOne({ email: 'user@cineverse.com' });
    if (!normalUser) {
        normalUser = new User({
            username: 'cineuser',
            email: 'user@cineverse.com',
            password: 'Password123!',
            role: 'user',
            isVip: false
        });
        await normalUser.save();
        console.log('✅ Đã tạo tài khoản thường: user@cineverse.com / Password123!');
    } else {
        normalUser.password = 'Password123!';
        normalUser.isVip = false;
        normalUser.role = 'user';
        await normalUser.save();
        console.log('✅ Đã cập nhật tài khoản thường: user@cineverse.com / Password123!');
    }

    // 2. Tạo hoặc cập nhật tài khoản Admin & VIP
    let adminUser = await User.findOne({ email: 'admin@cineverse.com' });
    if (!adminUser) {
        adminUser = new User({
            username: 'cineadmin',
            email: 'admin@cineverse.com',
            password: 'Password123!',
            role: 'admin',
            isVip: true
        });
        await adminUser.save();
        console.log('✅ Đã tạo tài khoản VIP & Admin: admin@cineverse.com / Password123!');
    } else {
        adminUser.password = 'Password123!';
        adminUser.isVip = true;
        adminUser.role = 'admin';
        await adminUser.save();
        console.log('✅ Đã cập nhật tài khoản VIP & Admin: admin@cineverse.com / Password123!');
    }

    const count = await User.countDocuments();
    console.log(`\n🎉 Tổng số user trong hệ thống: ${count} tài khoản.`);
    process.exit(0);
})();
