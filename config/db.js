const mongoose = require('mongoose');

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
