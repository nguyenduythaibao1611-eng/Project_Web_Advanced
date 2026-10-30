/**
 * Script Cào 200 Phim Có Điểm Đánh Giá Cao Nhất (Top Rated) Từ TMDB
 * Tự động tìm nguồn phát 2 Server (HLS + StreamC), upload ảnh Supabase CDN và lưu vào MongoDB Atlas.
 * Chạy bằng lệnh:
 *   node scripts/crawlTopRatedTMDB.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const connectDB = require('../config/db');
const Movie = require('../models/movieModel');
const ophimService = require('../services/ophimService');
const nguoncService = require('../services/nguoncService');
const { uploadImageFromUrl } = require('../services/supabaseService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GENRE_MAP = {
    28: 'Hành động', 12: 'Phiêu lưu', 16: 'Hoạt hình', 35: 'Hài hước', 80: 'Tội phạm',
    99: 'Tài liệu', 18: 'Chính kịch', 10751: 'Gia đình', 14: 'Giả tưởng', 36: 'Lịch sử',
    27: 'Kinh dị', 10402: 'Âm nhạc', 9648: 'Bí ẩn', 10749: 'Lãng mạn', 878: 'Viễn tưởng',
    10770: 'Phim truyền hình', 53: 'Giật gân', 10752: 'Chiến tranh', 37: 'Miền Tây'
};

const slugify = (text) => {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Tìm nguồn Server 2 từ NguonC
 */
const resolveNguonCServer = async (title, originTitle) => {
    try {
        const queryTerms = [title, originTitle].filter(Boolean);
        for (const q of queryTerms) {
            const matches = await nguoncService.searchFilm(q);
            if (Array.isArray(matches) && matches.length > 0) {
                const detail = await nguoncService.getFilmDetail(matches[0].slug);
                if (detail && Array.isArray(detail.episodes) && detail.episodes.length > 0) {
                    const epList = detail.episodes[0]?.items || [];
                    if (epList.length > 0) {
                        return {
                            server_name: 'NguonC Dự Phòng (StreamC)',
                            server_type: 'iframe',
                            server_data: epList.map((ep, idx) => ({
                                name: ep.name ? (ep.name.startsWith('Tập') ? ep.name : `Tập ${ep.name}`) : `Tập ${idx + 1}`,
                                slug: ep.slug || `tap-${idx + 1}`,
                                filename: `StreamC - ${title} - Tập ${ep.name || idx + 1}`,
                                link_m3u8: '',
                                link_embed: ep.embed || ''
                            }))
                        };
                    }
                }
            }
        }
    } catch {
        // Bỏ qua lỗi tìm kiếm NguonC
    }
    return null;
};

/**
 * Hàm chính thực thi cào 200 phim Top Rated TMDB
 */
const runCrawlTopRated = async () => {
    console.log('========================================================');
    console.log('🌟 CINEVERSE TMDB TOP RATED WORKER (TARGET: 200 PHIM)');
    console.log('========================================================');

    await connectDB();

    const initialCount = await Movie.countDocuments();
    console.log(`📦 Số lượng phim hiện có trong DB: ${initialCount} phim.`);
    console.log('🎯 Mục tiêu: Cào thêm 200 phim có điểm đánh giá cao nhất từ TMDB.\n');

    const TARGET = 200;
    let crawledCount = 0;
    let skippedCount = 0;
    let page = 1;

    const tmdbApi = axios.create({
        baseURL: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
        headers: {
            Authorization: `Bearer ${process.env.TMDB_TOKEN}`
        },
        timeout: 8000
    });

    while (crawledCount < TARGET && page <= 25) {
        console.log(`\n================== QUÉT TRANG TMDB ${page} ==================`);
        let results;
        try {
            const res = await tmdbApi.get('/movie/top_rated', {
                params: {
                    language: 'vi-VN',
                    page: page
                }
            });
            results = res.data?.results || [];
        } catch (apiErr) {
            console.error(`❌ Lỗi gọi TMDB trang ${page}:`, apiErr.message);
            page++;
            await sleep(1000);
            continue;
        }

        if (results.length === 0) {
            console.log(`⚠️ Hết phim ở trang ${page}.`);
            break;
        }

        console.log(`📋 Nhận được ${results.length} phim từ TMDB trang ${page}. Bắt đầu xử lý...`);

        for (let i = 0; i < results.length; i++) {
            if (crawledCount >= TARGET) break;

            const m = results[i];
            const tmdbId = String(m.id);
            const title = m.title || m.original_title || '';
            const originTitle = m.original_title || title;
            const currentNumber = crawledCount + 1;

            // 1. Kiểm tra phim đã tồn tại chưa
            const existing = await Movie.findOne({
                $or: [
                    { 'tmdb.id': tmdbId },
                    { title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                ]
            });

            if (existing) {
                console.log(`⏩ [${currentNumber}/${TARGET}] Bỏ qua (Đã có): ${existing.title} (Rating: ${existing.rating})`);
                skippedCount++;
                continue;
            }

            console.log(`🎬 [${currentNumber}/${TARGET}] Đang xử lý: ${title} (Rating TMDB: ${m.vote_average})`);

            // 2. Dò tìm nguồn phát Server 1 (OPhim HLS) và Server 2 (NguonC StreamC)
            const servers = [];

            // 2.1 Dò OPhim
            let ophimDetail = null;
            try {
                const searchNames = [originTitle, title].filter(Boolean);
                for (const query of searchNames) {
                    const ophimRes = await ophimService.searchOphim(query);
                    if (Array.isArray(ophimRes) && ophimRes.length > 0) {
                        ophimDetail = await ophimService.getMovieDetail(ophimRes[0].slug);
                        if (ophimDetail && (ophimDetail.movie || ophimDetail.data?.item)) {
                            break;
                        }
                    }
                }
            } catch {
                // Tiếp tục
            }

            const movieInfo = ophimDetail?.movie || ophimDetail?.data?.item;
            const episodes = ophimDetail?.episodes || ophimDetail?.data?.item?.episodes || [];

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

            // 2.2 Dò NguonC
            const nguoncServer = await resolveNguonCServer(title, originTitle);
            if (nguoncServer) {
                servers.push(nguoncServer);
            }

            // 2.3 Dự phòng VidSrc nếu thiếu server
            if (servers.length === 0) {
                servers.push({
                    server_name: 'Dự Phòng #1 (VidSrc Iframe)',
                    server_type: 'iframe',
                    server_data: [
                        {
                            name: 'Full',
                            slug: 'full',
                            filename: `VidSrc - ${title} - Full`,
                            link_m3u8: '',
                            link_embed: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
                        }
                    ]
                });
                servers.push({
                    server_name: 'Dự Phòng #2 (VidSrc Backup)',
                    server_type: 'iframe',
                    server_data: [
                        {
                            name: 'Full',
                            slug: 'full',
                            filename: `VidSrc Backup - ${title} - Full`,
                            link_m3u8: '',
                            link_embed: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
                        }
                    ]
                });
            } else if (servers.length === 1) {
                servers.push({
                    server_name: 'Dự Phòng #2 (VidSrc Iframe)',
                    server_type: 'iframe',
                    server_data: [
                        {
                            name: 'Full',
                            slug: 'full',
                            filename: `VidSrc - ${title} - Full`,
                            link_m3u8: '',
                            link_embed: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
                        }
                    ]
                });
            }

            // 3. Tải và đẩy ảnh Poster & Backdrop lên Supabase Storage CDN
            let posterUrl = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : (movieInfo?.poster_url || '');
            let backdropUrl = m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : (movieInfo?.thumb_url || '');

            const baseSlug = slugify(title) || `tmdb-${tmdbId}`;
            let finalSlug = baseSlug;

            // Kiểm tra trùng slug
            const slugExist = await Movie.findOne({ slug: finalSlug });
            if (slugExist) {
                finalSlug = `${baseSlug}-${tmdbId}`;
            }

            if (posterUrl && posterUrl.startsWith('http')) {
                try {
                    posterUrl = await uploadImageFromUrl(posterUrl, `${finalSlug}-poster`, 'posters');
                } catch {
                    // Dùng link TMDB gốc nếu lỗi upload
                }
            }

            if (backdropUrl && backdropUrl.startsWith('http')) {
                try {
                    backdropUrl = await uploadImageFromUrl(backdropUrl, `${finalSlug}-backdrop`, 'backdrops');
                } catch {
                    // Dùng link TMDB gốc nếu lỗi upload
                }
            }

            // 4. Map thể loại từ TMDB
            const genresList = (m.genre_ids || []).map((gid) => ({
                id: String(gid),
                name: GENRE_MAP[gid] || 'Điện ảnh',
                slug: slugify(GENRE_MAP[gid] || 'dien-anh')
            }));

            // 5. Chuẩn hóa document theo Movie schema
            const movieDoc = {
                title: title,
                origin_name: originTitle,
                slug: finalSlug,
                overview: m.overview || movieInfo?.content || '',
                poster_url: posterUrl,
                backdrop_url: backdropUrl,
                trailer_url: '',
                time: movieInfo?.time || '120 phút',
                episode_current: movieInfo?.episode_current || 'Full',
                episode_total: movieInfo?.episode_total || '1',
                quality: 'HD',
                lang: 'Vietsub',
                year: m.release_date ? parseInt(m.release_date.split('-')[0], 10) : new Date().getFullYear(),
                type: 'single',
                status: 'completed',
                genres: genresList,
                countries: [],
                actor: [],
                director: [],
                view_count: Math.floor(Math.random() * 3000) + 1500,
                rating: m.vote_average || 8.8,
                vote_count: m.vote_count || 1000,
                isVip: (m.vote_average >= 8.8), // Tự động gắn tag VIP cho những kiệt tác siêu kinh điển (>= 8.8)
                danh_sach_server: servers,
                tmdb: {
                    id: tmdbId,
                    type: 'movie',
                    vote_average: m.vote_average || 8.8,
                    vote_count: m.vote_count || 1000
                }
            };

            await Movie.create(movieDoc);
            crawledCount++;
            console.log(`   ✅ [${crawledCount}/${TARGET}] Đã lưu: ${title} (Rating: ${m.vote_average}, Servers: ${servers.length})`);

            // Nghỉ nhẹ 300ms giữa các phim
            await sleep(300);
        }

        page++;
    }

    const finalCount = await Movie.countDocuments();
    console.log('\n========================================================');
    console.log('🎉 TỔNG KẾT QUÁ TRÌNH CÀO 200 PHIM TOP RATED:');
    console.log(`   - 📦 Số phim ban đầu trong DB : ${initialCount} phim`);
    console.log(`   - ✅ Đã thêm mới thành công    : ${crawledCount} phim`);
    console.log(`   - ⏩ Đã bỏ qua (Đã có trong DB): ${skippedCount} phim`);
    console.log(`   - 🏆 Tổng số phim hiện có trong DB: ${finalCount} phim`);
    console.log('========================================================\n');
};

if (require.main === module) {
    runCrawlTopRated()
        .then(() => {
            mongoose.disconnect();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Lỗi khi chạy crawler:', err);
            mongoose.disconnect();
            process.exit(1);
        });
}

module.exports = runCrawlTopRated;
