require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Movie = require('../models/movieModel');
const ophimService = require('../services/ophimService');
const { uploadImageFromUrl } = require('../services/supabaseService');

// Helper tạm dừng giữa các lượt cào để tránh bị chặn IP
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Phân tích tham số truyền từ dòng lệnh CLI
 * Hỗ trợ:
 *   --slug=<slug_phim> : Cào duy nhất 1 phim theo slug
 *   --pages=<so_trang> : Số lượng trang cần cào (mỗi trang ~24 phim)
 *   --page=<trang_bat_dau> : Trang bắt đầu cào (mặc định: 1)
 *   --delay=<mili_giay> : Thời gian nghỉ giữa mỗi phim (mặc định: 800ms)
 */
const parseArgs = () => {
    const args = process.argv.slice(2);
    const config = {
        slug: null,
        pages: 1,
        page: 1,
        delay: 800
    };

    args.forEach((arg) => {
        if (arg.startsWith('--slug=')) {
            config.slug = arg.split('=')[1].trim();
        } else if (arg.startsWith('--pages=')) {
            config.pages = parseInt(arg.split('=')[1], 10) || 1;
        } else if (arg.startsWith('--page=')) {
            config.page = parseInt(arg.split('=')[1], 10) || 1;
        } else if (arg.startsWith('--delay=')) {
            config.delay = parseInt(arg.split('=')[1], 10) || 800;
        }
    });

    return config;
};

/**
 * Xử lý cào 1 bộ phim theo slug và lưu vào MongoDB + Supabase
 * @param {string} slug - Slug định danh phim
 * @param {number} current - Vị trí hiện tại
 * @param {number} total - Tổng số phim cần cào
 */
const processSingleMovie = async (slug, current = 1, total = 1) => {
    try {
        // 1. Kiểm tra phim đã tồn tại trong MongoDB chưa
        const existing = await Movie.findOne({ slug });
        if (existing) {
            console.log(`⏩ [${current}/${total}] Bỏ qua (Đã có trong DB): ${existing.title} (${slug})`);
            return { success: false, skipped: true, slug };
        }

        // 2. Lấy dữ liệu chi tiết từ OPhim API
        const detailData = await ophimService.getMovieDetail(slug);
        const movieInfo = detailData.movie || detailData.data?.item;
        const episodes = detailData.episodes || detailData.data?.item?.episodes || [];

        if (!movieInfo || !movieInfo.name) {
            console.warn(`⚠️ [${current}/${total}] Không tìm thấy chi tiết phim: ${slug}`);
            return { success: false, skipped: false, slug, error: 'Không tìm thấy data' };
        }

        console.log(`🎬 [${current}/${total}] Bắt đầu xử lý: ${movieInfo.name} (${slug})`);

        // 3. Pipeline xử lý và upload ảnh lên Supabase Storage
        let posterUrl = movieInfo.poster_url || movieInfo.thumb_url || '';
        let backdropUrl = movieInfo.thumb_url || movieInfo.poster_url || '';

        // Tải và đẩy ảnh Poster
        if (posterUrl && posterUrl.startsWith('http')) {
            try {
                process.stdout.write('   ├── 🖼️ Đang tải & up Poster lên Supabase...');
                posterUrl = await uploadImageFromUrl(posterUrl, `${slug}-poster`, 'posters');
                console.log(' Xong!');
            } catch (imgErr) {
                console.log(` Bỏ qua (Dùng link gốc: ${imgErr.message})`);
            }
        }

        // Tải và đẩy ảnh Backdrop
        if (backdropUrl && backdropUrl.startsWith('http')) {
            try {
                process.stdout.write('   ├── 🖼️ Đang tải & up Backdrop lên Supabase...');
                backdropUrl = await uploadImageFromUrl(backdropUrl, `${slug}-backdrop`, 'backdrops');
                console.log(' Xong!');
            } catch (imgErr) {
                console.log(` Bỏ qua (Dùng link gốc: ${imgErr.message})`);
            }
        }

        // 4. Bóc tách danh sách Server phát video (OPhim HLS + VidSrc Iframe)
        const servers = [];

        // 4.1 Server từ OPhim
        if (Array.isArray(episodes) && episodes.length > 0) {
            episodes.forEach((epServer) => {
                const epData = Array.isArray(epServer.server_data) ? epServer.server_data : [];
                servers.push({
                    server_name: epServer.server_name || 'OPhim VIP (HLS)',
                    server_type: 'm3u8',
                    server_data: epData.map((ep) => ({
                        name: ep.name || 'Full',
                        slug: ep.slug || 'full',
                        filename: ep.filename || '',
                        link_m3u8: ep.link_m3u8 || '',
                        link_embed: ep.link_embed || ''
                    }))
                });
            });
        }

        // 4.2 Tự động ghép thêm Server VidSrc Dự Phòng (Iframe) nếu có TMDB ID
        const tmdbId = movieInfo.tmdb?.id || movieInfo.imdb?.id;
        if (tmdbId) {
            const isSeries = movieInfo.type === 'series';
            const vidSrcEpisodes = isSeries && servers[0]?.server_data?.length > 0
                ? servers[0].server_data.map((ep, idx) => ({
                      name: ep.name || `Tập ${idx + 1}`,
                      slug: ep.slug || `tap-${idx + 1}`,
                      filename: `VidSrc - ${movieInfo.name} - Tập ${idx + 1}`,
                      link_m3u8: '',
                      link_embed: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=1&episode=${idx + 1}`
                  }))
                : [
                      {
                          name: 'Full',
                          slug: 'full',
                          filename: `VidSrc - ${movieInfo.name} - Full`,
                          link_m3u8: '',
                          link_embed: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
                      }
                  ];

            servers.push({
                server_name: 'VidSrc Dự Phòng (Iframe)',
                server_type: 'iframe',
                server_data: vidSrcEpisodes
            });
        }

        // 5. Chuẩn hóa dữ liệu theo movieModel.js
        const cleanOverview = movieInfo.content
            ? movieInfo.content.replace(/<[^>]*>?/gm, '').trim()
            : '';

        const movieDoc = {
            title: movieInfo.name,
            origin_name: movieInfo.origin_name || '',
            slug: movieInfo.slug || slug,
            overview: cleanOverview,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            trailer_url: movieInfo.trailer_url || '',
            time: movieInfo.time || '',
            episode_current: movieInfo.episode_current || 'Full',
            episode_total: movieInfo.episode_total || '1',
            quality: movieInfo.quality || 'HD',
            lang: movieInfo.lang || 'Vietsub',
            year: parseInt(movieInfo.year, 10) || new Date().getFullYear(),
            type: movieInfo.type || 'single',
            status: movieInfo.status || 'completed',
            genres: Array.isArray(movieInfo.category)
                ? movieInfo.category.map((c) => ({
                      id: c.id || '',
                      name: c.name || '',
                      slug: c.slug || ''
                  }))
                : [],
            countries: Array.isArray(movieInfo.country)
                ? movieInfo.country.map((c) => ({
                      id: c.id || '',
                      name: c.name || '',
                      slug: c.slug || ''
                  }))
                : [],
            actor: Array.isArray(movieInfo.actor) ? movieInfo.actor : [],
            director: Array.isArray(movieInfo.director) ? movieInfo.director : [],
            view_count: movieInfo.view || Math.floor(Math.random() * 800) + 150,
            rating: movieInfo.tmdb?.vote_average || 0,
            vote_count: movieInfo.tmdb?.vote_count || 0,
            isVip: false, // Mặc định để false theo phương án chốt
            danh_sach_server: servers,
            tmdb: {
                id: String(movieInfo.tmdb?.id || ''),
                type: movieInfo.tmdb?.type || 'movie',
                vote_average: movieInfo.tmdb?.vote_average || 0,
                vote_count: movieInfo.tmdb?.vote_count || 0
            }
        };

        // 6. Lưu vào MongoDB Atlas
        await Movie.create(movieDoc);
        console.log(`   └── 💾 Đã lưu thành công vào MongoDB Atlas! (Tổng ${servers.length} server)`);

        return { success: true, slug, title: movieInfo.name };
    } catch (err) {
        console.error(`❌ [${current}/${total}] Lỗi xử lý phim "${slug}":`, err.message);
        return { success: false, slug, error: err.message };
    }
};

/**
 * Hàm điều phối chính (Runner)
 */
const runCrawler = async () => {
    console.log('========================================================');
    console.log('🚀 CINEVERSE MOVIE CRAWLER WORKER');
    console.log('========================================================');

    // Kết nối MongoDB Atlas
    await connectDB();

    const config = parseArgs();

    // Trường hợp 1: Cào đúng 1 phim duy nhất theo slug
    if (config.slug) {
        console.log(`🎯 Chế độ cào 1 phim duy nhất: "${config.slug}"`);
        const result = await processSingleMovie(config.slug, 1, 1);
        console.log('\n📊 KẾT QUẢ:');
        console.log(result.success ? `✅ Cào thành công phim: ${result.title}` : `⚠️ Không thành công: ${result.error || 'Bị bỏ qua'}`);
        await mongoose.disconnect();
        process.exit(0);
    }

    // Trường hợp 2: Cào theo danh sách trang
    console.log(`📑 Bắt đầu cào ${config.pages} trang danh sách (Từ trang ${config.page})`);
    let totalCrawled = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (let p = config.page; p < config.page + config.pages; p++) {
        console.log(`\n================== TRANG ${p} ==================`);
        const { items } = await ophimService.getLatestMovies(p);

        if (!Array.isArray(items) || items.length === 0) {
            console.warn(`⚠️ Không lấy được danh sách phim ở trang ${p}`);
            continue;
        }

        console.log(`📋 Tìm thấy ${items.length} phim ở trang ${p}. Bắt đầu cào...`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const currentIndex = (p - config.page) * items.length + (i + 1);
            const totalItems = config.pages * items.length;

            const res = await processSingleMovie(item.slug, currentIndex, totalItems);

            if (res.success) totalCrawled++;
            else if (res.skipped) totalSkipped++;
            else totalFailed++;

            // Nghỉ nhẹ giữa các phim để bảo vệ IP
            await sleep(config.delay);
        }
    }

    console.log('\n========================================================');
    console.log('🎉 TỔNG KẾT QUÁ TRÌNH CÀO PHIM:');
    console.log(`   - ✅ Đã thêm mới thành công : ${totalCrawled} phim`);
    console.log(`   - ⏩ Bỏ qua do đã có trong DB : ${totalSkipped} phim`);
    console.log(`   - ❌ Thất bại               : ${totalFailed} phim`);
    console.log('========================================================\n');

    await mongoose.disconnect();
    process.exit(0);
};

runCrawler();
