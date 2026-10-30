/**
 * Script phân quyền Admin cho một tài khoản
 * Sử dụng:
 *   node scripts/makeAdmin.js <username_hoac_email>
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/userModel');

const run = async () => {
    const target = process.argv[2];
    if (!target) {
        console.log('⚠️ Vui lòng cung cấp username hoặc email:');
        console.log('   node scripts/makeAdmin.js <username_hoac_email>');
        process.exit(1);
    }

    try {
        await connectDB();
        const user = await User.findOne({
            $or: [{ username: target.toLowerCase() }, { email: target.toLowerCase() }]
        });

        if (!user) {
            console.error(`❌ Không tìm thấy người dùng với định danh: "${target}"`);
            process.exit(1);
        }

        user.role = 'admin';
        user.isVip = true;
        await user.save();

        console.log(`✅ Thành công! Người dùng "${user.username}" (${user.email}) hiện đã được cấp quyền:`);
        console.log(`   - role: "${user.role}"`);
        console.log(`   - isVip: ${user.isVip}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Lỗi khi phân quyền admin:', err.message);
        process.exit(1);
    }
};

run();
