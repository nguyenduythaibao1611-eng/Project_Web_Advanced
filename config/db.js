const dns = require('node:dns');
const mongoose = require('mongoose');

// Tự động dùng Public DNS (Google, Cloudflare) để phân giải bản ghi SRV của MongoDB Atlas
// Tránh lỗi querySrv ECONNREFUSED phổ biến trên Windows và các router mạng tại VN
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
    console.warn('Không thể thiết lập DNS tùy chỉnh:', err.message);
}

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cineverse';
        const conn = await mongoose.connect(uri);
        console.log(`✅ MongoDB đã kết nối thành công: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    }
};

module.exports = connectDB;
