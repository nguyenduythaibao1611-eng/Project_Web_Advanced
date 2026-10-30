require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Movie = require('../models/movieModel');
const ophimService = require('../services/ophimService');
const nguoncService = require('../services/nguoncService');
const tmdbService = require('../services/tmdbService');
const { uploadImageFromUrl } = require('../services/supabaseService');

// Helper tạm dừng giữa các lượt cào để tránh bị chặn IP
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Phân tích tham số truyền từ dòng lệnh CLI
 * Hỗ trợ:
 *   --slug=<slug_phim>     : Cào duy nhất 1 phim theo slug
 *   --target=<so_phim>     : Số lượng phim mới cần cào thành công (mặc định: 100)
 *   --pages=<so_trang>     : Số trang tối đa cần quét (mỗi trang ~24 phim)
 *   --page=<trang_bat_dau> : Trang bắt đầu quét (mặc định: 1)
 *   --delay=<mili_giay>    : Thời gian nghỉ giữa mỗi phim (mặc định: 600ms)
 */
const parseArgs = () => {
    const args = process.argv.slice(2);
    const config = {
        slug: null,
        target: 100,
        pages: 15,
        page: 1,
        delay: 600
    };

    args.forEach((arg) => {
        if (arg.startsWith('--slug=')) {
            config.slug = arg.split('=')[1].trim();
        } else if (arg.startsWith('--target=')) {
            config.target = parseInt(arg.split('=')[1], 10) || 100;
        } else if (arg.startsWith('--pages=')) {
            config.pages = parseInt(arg.split('=')[1], 10) || 15;
        } else if (arg.startsWith('--page=')) {
            config.page = parseInt(arg.split('=')[1], 10) || 1;
        } else if (arg.startsWith('--delay=')) {
            config.delay = parseInt(arg.split('=')[1], 10) || 600;
        }
    });

    return config;
};

/**
 * Dò tìm và bóc tách Server 2 độc lập từ NguonC (StreamC embed)
 * @param {Object} movieInfo - Thông tin phim từ OPhim
 * @returns {Promise<Object|null>} - Server 2 theo cấu trúc serverSchema
 */
const resolveNguonCServer = async (movieInfo) => {
    try {
        const queryNames = [
            movieInfo.name,
            movieInfo.origin_name,
            movieInfo.slug
        ].filter(Boolean);

        let nguonDetail = null;

        for (const query of queryNames) {
            const matches = await nguoncService.searchFilm(query);
            if (Array.isArray(matches) && matches.length > 0) {
                // Ưu tiên khớp chính xác tên hoặc slug
                const exactMatch = matches.find(
                    (m) => m.slug === movieInfo.slug || m.name?.toLowerCase() === movieInfo.name?.toLowerCase()
                ) || matches[0];

                if (exactMatch && exactMatch.slug) {
                    nguonDetail = await nguoncService.getFilmDetail(exactMatch.slug);
                    if (nguonDetail && Array.isArray(nguonDetail.episodes) && nguonDetail.episodes.length > 0) {
                        break;
                    }
                }
            }
        }

        if (nguonDetail && Array.isArray(nguonDetail.episodes) && nguonDetail.episodes.length > 0) {
            const epList = nguonDetail.episodes[0]?.items || [];
            if (epList.length > 0) {
                return {
                    server_name: 'NguonC Dự Phòng (StreamC)',
                    server_type: 'iframe',
                    server_data: epList.map((ep, idx) => ({
                        name: ep.name ? (ep.name.startsWith('Tập') ? ep.name : `Tập ${ep.name}`) : `Tập ${idx + 1}`,
                        slug: ep.slug || `tap-${idx + 1}`,
                        filename: `StreamC - ${movieInfo.name} - Tập ${ep.name || idx + 1}`,
                        link_m3u8: '',
                        link_embed: ep.embed || ''
                    }))
                };
            }
        }
    } catch (err) {
        console.warn(`      ⚠️ Lỗi dò NguonC cho "${movieInfo.name}":`, err.message);
    }
    return null;
};

/**
 * Xử lý cào 1 bộ phim theo slug và lưu vào MongoDB + Supabase
 * @param {string} slug - Slug định danh phim
 * @param {number} current - Vị trí hiện tại
 * @param {number} targetTotal - Mục tiêu cần đạt
 */
const processSingleMovie = async (slug, current = 1, targetTotal = 100) => {
    try {
        // 1. Kiểm tra phim đã tồn tại trong MongoDB chưa (theo slug)
        const existingSlug = await Movie.findOne({ slug });
        if (existingSlug) {
            console.log(`⏩ [${current}] Bỏ qua (Đã có theo slug): ${existingSlug.title} (${slug})`);
            return { success: false, skipped: true, slug, reason: 'exists' };
        }

        // 2. Lấy dữ liệu chi tiết từ OPhim API
        const detailData = await ophimService.getMovieDetail(slug);
        const movieInfo = detailData.movie || detailData.data?.item;
        const episodes = detailData.episodes || detailData.data?.item?.episodes || [];

        if (!movieInfo || !movieInfo.name) {
            console.warn(`⚠️ [${current}] Không tìm thấy chi tiết phim: ${slug}`);
            return { success: false, skipped: false, slug, error: 'Không tìm thấy data' };
        }

        // 3. ƯU TIÊN TMDB: Xác định TMDB ID hợp lệ
        let finalTmdbId = String(movieInfo.tmdb?.id || movieInfo.imdb?.id || '').trim();
        let tmdbVoteAverage = Number(movieInfo.tmdb?.vote_average || 0);
        let tmdbVoteCount = Number(movieInfo.tmdb?.vote_count || 0);

        if (!finalTmdbId || finalTmdbId === '0' || finalTmdbId === 'undefined') {
            // Thử tìm trên TMDB bằng tên gốc hoặc tên tiếng Việt
            const searchTerms = [movieInfo.origin_name, movieInfo.name].filter(Boolean);
            for (const term of searchTerms) {
                try {
                    const tmdbRes = await tmdbService.searchMovies(term);
                    if (tmdbRes && Array.isArray(tmdbRes.results) && tmdbRes.results.length > 0) {
                        const topHit = tmdbRes.results[0];
                        finalTmdbId = String(topHit.id);
                        tmdbVoteAverage = Number(topHit.vote_average || 0);
                        tmdbVoteCount = Number(topHit.vote_count || 0);
                        break;
                    }
                } catch {
                    // Tiếp tục thử
                }
            }
        }

        // Nếu vẫn không có TMDB ID -> Bỏ qua để đảm bảo chất lượng kho phim TMDB
        if (!finalTmdbId) {
            console.log(`⏩ [${current}] Bỏ qua (Không có TMDB ID): ${movieInfo.name} (${slug})`);
            return { success: false, skipped: true, slug, reason: 'no-tmdb' };
        }

        // Kiểm tra xem TMDB ID này đã có trong MongoDB chưa
        const existingTmdb = await Movie.findOne({ 'tmdb.id': finalTmdbId });
        if (existingTmdb) {
            console.log(`⏩ [${current}] Bỏ qua (Đã có TMDB ID ${finalTmdbId}): ${existingTmdb.title}`);
            return { success: false, skipped: true, slug, reason: 'tmdb-exists' };
        }

        console.log(`🎬 [${current}/${targetTotal}] Đang xử lý: ${movieInfo.name} (TMDB: ${finalTmdbId})`);

        // 4. Pipeline xử lý và upload ảnh lên Supabase Storage CDN
        let posterUrl = movieInfo.poster_url || movieInfo.thumb_url || '';
        let backdropUrl = movieInfo.thumb_url || movieInfo.poster_url || '';

        // Tải và đẩy ảnh Poster
        if (posterUrl && posterUrl.startsWith('http')) {
            try {
                process.stdout.write('   ├── 🖼️ Đang tải & up Poster lên Supabase...');
                posterUrl = await uploadImageFromUrl(posterUrl, `${slug}-poster`, 'posters');
                console.log(' Xong!');
            } catch (imgErr) {
                console.log(` Dùng link gốc: ${imgErr.message}`);
            }
        }

        // Tải và đẩy ảnh Backdrop
        if (backdropUrl && backdropUrl.startsWith('http')) {
            try {
                process.stdout.write('   ├── 🖼️ Đang tải & up Backdrop lên Supabase...');
                backdropUrl = await uploadImageFromUrl(backdropUrl, `${slug}-backdrop`, 'backdrops');
                console.log(' Xong!');
            } catch (imgErr) {
                console.log(` Dùng link gốc: ${imgErr.message}`);
            }
        }

        // 5. Bóc tách danh sách Server phát video (Server 1: OPhim HLS, Server 2: NguonC StreamC)
        const servers = [];

        // 5.1 Server 1: OPhim HLS
        if (Array.isArray(episodes) && episodes.length > 0) {
            episodes.forEach((epServer) => {
                const epData = Array.isArray(epServer.server_data) ? epServer.server_data : [];
                servers.push({
                    server_name: epServer.server_name || 'Vietsub #1 (HLS)',
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

        // 5.2 Server 2: Dò tìm NguonC StreamC embed (Máy chủ thứ 2 độc lập)
        process.stdout.write('   ├── 🔍 Đang dò nguồn Server 2 (NguonC StreamC)...');
        const nguoncServer = await resolveNguonCServer(movieInfo);
        if (nguoncServer) {
            servers.push(nguoncServer);
            console.log(` Tìm thấy NguonC (${nguoncServer.server_data.length} tập)!`);
        } else {
            // Dự phòng 2.2: VidSrc Embed qua TMDB ID nếu NguonC chưa có
            const isSeries = movieInfo.type === 'series';
            const vidSrcEpisodes = isSeries && servers[0]?.server_data?.length > 0
                ? servers[0].server_data.map((ep, idx) => ({
                      name: ep.name || `Tập ${idx + 1}`,
                      slug: ep.slug || `tap-${idx + 1}`,
                      filename: `VidSrc - ${movieInfo.name} - Tập ${idx + 1}`,
                      link_m3u8: '',
                      link_embed: `https://vidsrc.xyz/embed/tv?tmdb=${finalTmdbId}&season=1&episode=${idx + 1}`
                  }))
                : [
                      {
                          name: 'Full',
                          slug: 'full',
                          filename: `VidSrc - ${movieInfo.name} - Full`,
                          link_m3u8: '',
                          link_embed: `https://vidsrc.xyz/embed/movie?tmdb=${finalTmdbId}`
                      }
                  ];

            servers.push({
                server_name: 'Dự Phòng #2 (Iframe)',
                server_type: 'iframe',
                server_data: vidSrcEpisodes
            });
            console.log(' Sử dụng VidSrc Iframe.');
        }

        // 6. Chuẩn hóa dữ liệu theo movieModel
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
            rating: tmdbVoteAverage || 8.0,
            vote_count: tmdbVoteCount || 100,
            isVip: false,
            danh_sach_server: servers,
            tmdb: {
                id: finalTmdbId,
                type: movieInfo.tmdb?.type || (movieInfo.type === 'series' ? 'tv' : 'movie'),
                vote_average: tmdbVoteAverage,
                vote_count: tmdbVoteCount
            }
        };

        // 7. Lưu vào MongoDB Atlas
        await Movie.create(movieDoc);
        console.log(`   └── 💾 Đã lưu vào MongoDB Atlas! (Tổng ${servers.length} server)`);

        return { success: true, slug, title: movieInfo.name, tmdbId: finalTmdbId };
    } catch (err) {
        console.error(`❌ [${current}] Lỗi xử lý phim "${slug}":`, err.message);
        return { success: false, slug, error: err.message };
    }
};

/**
 * Hàm điều phối chính (Runner)
 */
const runCrawler = async () => {
    console.log('========================================================');
    console.log('🚀 CINEVERSE MOVIE CRAWLER WORKER (TMDB + MULTI-SERVER)');
    console.log('========================================================');

    // Kết nối MongoDB Atlas
    await connectDB();

    const config = parseArgs();

    // Trường hợp 1: Cào đúng 1 phim duy nhất theo slug
    if (config.slug) {
        console.log(`🎯 Chế độ cào 1 phim duy nhất: "${config.slug}"`);
        const result = await processSingleMovie(config.slug, 1, 1);
        console.log('\n📊 KẾT QUẢ:');
        console.log(result.success ? `✅ Cào thành công: ${result.title}` : `⚠️ Không thành công: ${result.error || result.reason}`);
        await mongoose.disconnect();
        process.exit(0);
    }

    // Trường hợp 2: Cào cho đến khi đủ chỉ tiêu target (mặc định 100 phim)
    const initialCount = await Movie.countDocuments();
    console.log(`📦 Số lượng phim hiện có trong MongoDB: ${initialCount} phim`);
    console.log(`🎯 Mục tiêu cào thêm: +${config.target} phim mới (Ưu tiên TMDB, 2 Server độc lập)`);

    let totalCrawled = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let page = config.page;

    while (totalCrawled < config.target && page < (config.page + config.pages)) {
        console.log(`\n================== QUÉT TRANG ${page} ==================`);
        const { items } = await ophimService.getLatestMovies(page);

        if (!Array.isArray(items) || items.length === 0) {
            console.warn(`⚠️ Không lấy được danh sách phim ở trang ${page}`);
            page++;
            continue;
        }

        console.log(`📋 Tìm thấy ${items.length} phim ở trang ${page}.`);

        for (let i = 0; i < items.length; i++) {
            if (totalCrawled >= config.target) {
                console.log(`\n🎯 ĐÃ ĐẠT CHỈ TIÊU ${config.target} PHIM MỚI! Dừng cào.`);
                break;
            }

            const item = items[i];
            const currentItemNumber = totalCrawled + 1;

            const res = await processSingleMovie(item.slug, currentItemNumber, config.target);

            if (res.success) {
                totalCrawled++;
                console.log(`   ✨ Tiến độ: [${totalCrawled}/${config.target}] phim mới đã thêm.`);
            } else if (res.skipped) {
                totalSkipped++;
            } else {
                totalFailed++;
            }

            // Nghỉ nhẹ giữa các phim để bảo vệ IP & tránh rate limit
            await sleep(config.delay);
        }

        page++;
    }

    const finalCount = await Movie.countDocuments();
    console.log('\n========================================================');
    console.log('🎉 TỔNG KẾT QUÁ TRÌNH CÀO PHIM:');
    console.log(`   - 📦 Tổng phim ban đầu        : ${initialCount} phim`);
    console.log(`   - ✅ Đã thêm mới thành công   : ${totalCrawled} phim`);
    console.log(`   - ⏩ Bỏ qua (Đã có / Thiếu TMDB): ${totalSkipped} phim`);
    console.log(`   - ❌ Thất bại                 : ${totalFailed} phim`);
    console.log(`   - 🏆 Tổng phim hiện có trong DB: ${finalCount} phim`);
    console.log('========================================================\n');

    await mongoose.disconnect();
    process.exit(0);
};

runCrawler();
