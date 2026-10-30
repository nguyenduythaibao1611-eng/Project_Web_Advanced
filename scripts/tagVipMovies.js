require('dotenv').config();
const connectDB = require('../config/db');
const Movie = require('../models/movieModel');

(async () => {
    await connectDB();

    // 1. Reset all to false first
    await Movie.updateMany({}, { isVip: false });

    // 2. Set 'Thương Nguyên Đồ' as VIP
    await Movie.updateOne({ slug: 'thuong-nguyen-do' }, { isVip: true });

    // 3. Select 19 other high-rated / popular movies as VIP
    const topMovies = await Movie.find({ slug: { $ne: 'thuong-nguyen-do' } })
        .sort({ rating: -1, view_count: -1 })
        .limit(19);

    for (const m of topMovies) {
        m.isVip = true;
        await m.save();
    }

    const vipCount = await Movie.countDocuments({ isVip: true });
    const freeCount = await Movie.countDocuments({ isVip: false });
    console.log(`✅ Đã phân loại thành công: ${vipCount} Phim VIP và ${freeCount} Phim Thường/Miễn phí.`);

    const vips = await Movie.find({ isVip: true }).select('title slug rating isVip').lean();
    console.log('🎬 Danh sách một số phim VIP tiêu biểu:');
    vips.slice(0, 8).forEach((m, idx) => {
        console.log(`   ${idx + 1}. [VIP] ${m.title} (Rating: ${m.rating})`);
    });

    process.exit(0);
})();
