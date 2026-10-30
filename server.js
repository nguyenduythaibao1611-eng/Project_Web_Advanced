require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const syncTop10TMDB = require('./scripts/syncTop10TMDB');

const PORT = process.env.PORT || 5000;

// Kết nối cơ sở dữ liệu MongoDB
connectDB().then(() => {
    // Tự động đồng bộ lại Top 10 TMDB định kỳ mỗi 12 tiếng
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(async () => {
        try {
            console.log('⏰ [Cron 12h] Bắt đầu tự động làm mới Top 10 TMDB...');
            await syncTop10TMDB();
        } catch (err) {
            console.error('Lỗi định kỳ đồng bộ Top 10 TMDB:', err.message);
        }
    }, TWELVE_HOURS);
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
