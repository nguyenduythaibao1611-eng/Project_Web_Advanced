/**
 * Script & Worker Đồng Bộ Top 10 Phim Thịnh Hành Hôm Nay Từ TMDB
 * Tự động chạy định kỳ mỗi 12 tiếng hoặc chạy thủ công bằng lệnh:
 *   npm run sync:top10
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Movie = require('../models/movieModel');
const tmdbService = require('../services/tmdbService');
const ophimService = require('../services/ophimService');
const nguoncService = require('../services/nguoncService');
const { uploadImageFromUrl } = require('../services/supabaseService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tìm kiếm luồng phát Server 2 từ NguonC
 */
const resolveNguonCServer = async (movieTitle, originTitle) => {
    try {
        const queryTerms = [movieTitle, originTitle].filter(Boolean);
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
                                filename: `StreamC - ${movieTitle} - Tập ${ep.name || idx + 1}`,
                                link_m3u8: '',
                                link_embed: ep.embed || ''
                            }))
                        };
                    }
                }
            }
        }
    } catch (err) {
        console.warn(`   ⚠️ Lỗi tìm NguonC cho "${movieTitle}":`, err.message);
    }
    return null;
};

/**
 * Hàm thực thi đồng bộ Top 10 TMDB vào MongoDB
 */
const syncTop10TMDB = async () => {
    console.log('========================================================');
    console.log('🔥 CINEVERSE TOP 10 TMDB SYNC WORKER');
    console.log('========================================================');

    await connectDB();

    console.log('📡 Đang gọi API TMDB lấy Top 10 thịnh hành hôm nay...');
    const trendingList = await tmdbService.getTrendingDay(10);

    if (!Array.isArray(trendingList) || trendingList.length === 0) {
        console.error('❌ Không lấy được dữ liệu Top 10 từ TMDB. Giữ nguyên bảng xếp hạng cũ.');
        return false;
    }

    console.log(`✅ Đã nhận ${trendingList.length} phim từ TMDB. Bắt đầu đồng bộ thứ hạng...\n`);

    // Reset toàn bộ thứ hạng top10Rank cũ
    await Movie.updateMany({ top10Rank: { $ne: null } }, { $unset: { top10Rank: 1 } });

    for (let i = 0; i < trendingList.length; i++) {
        const item = trendingList[i];
        const rank = i + 1;
        const tmdbId = String(item.id);
        const title = item.title || item.name || '';
        const originTitle = item.original_title || item.original_name || '';

        console.log(`--------------------------------------------------------`);
        console.log(`🏆 [#${rank}] TMDB: ${title} (${originTitle}) [ID: ${tmdbId}]`);

        // 1. Kiểm tra xem phim đã có trong DB chưa
        let dbMovie = await Movie.findOne({
            $or: [
                { 'tmdb.id': tmdbId },
                { title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            ]
        });

        if (dbMovie) {
            dbMovie.top10Rank = rank;
            if (!dbMovie.tmdb || !dbMovie.tmdb.id) {
                dbMovie.tmdb = {
                    id: tmdbId,
                    type: item.media_type || 'movie',
                    vote_average: item.vote_average || 8.0,
                    vote_count: item.vote_count || 100
                };
            }
            if (item.vote_average) dbMovie.rating = item.vote_average;
            await dbMovie.save();
            console.log(`   ✨ Đã gán Rank #${rank} cho phim có sẵn trong MongoDB!`);
            continue;
        }

        // 2. Nếu chưa có trong DB, tiến hành dò tìm luồng stream và nạp phim mới
        console.log(`   🔍 Chưa có trong DB -> Đang tự động dò nguồn phát...`);

        // Tìm bên OPhim
        let ophimDetail = null;
        const ophimResults = await ophimService.searchOphim(title);
        if (Array.isArray(ophimResults) && ophimResults.length > 0) {
            ophimDetail = await ophimService.getMovieDetail(ophimResults[0].slug);
        } else if (originTitle) {
            const fallbackResults = await ophimService.searchOphim(originTitle);
            if (Array.isArray(fallbackResults) && fallbackResults.length > 0) {
                ophimDetail = await ophimService.getMovieDetail(fallbackResults[0].slug);
            }
        }

        const movieInfo = ophimDetail?.movie || ophimDetail?.data?.item;
        const episodes = ophimDetail?.episodes || ophimDetail?.data?.item?.episodes || [];

        const servers = [];

        // Server 1 từ OPhim HLS
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

        // Server 2 từ NguonC StreamC
        const nguoncServer = await resolveNguonCServer(title, originTitle);
        if (nguoncServer) {
            servers.push(nguoncServer);
        }

        // Nếu chưa có server nào, tạo Server dự phòng VidSrc theo TMDB ID
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
        }

        // Tải ảnh Poster và Backdrop lên Supabase Storage CDN
        let posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : (movieInfo?.poster_url || '');
        let backdropUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : (movieInfo?.thumb_url || '');

        const slug = (item.title ? item.title : title)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `tmdb-${tmdbId}`;

        if (posterUrl && posterUrl.startsWith('http')) {
            try {
                posterUrl = await uploadImageFromUrl(posterUrl, `${slug}-poster`, 'posters');
            } catch {
                // Giữ link TMDB gốc nếu lỗi upload
            }
        }

        if (backdropUrl && backdropUrl.startsWith('http')) {
            try {
                backdropUrl = await uploadImageFromUrl(backdropUrl, `${slug}-backdrop`, 'backdrops');
            } catch {
                // Giữ link TMDB gốc nếu lỗi upload
            }
        }

        const movieDoc = {
            title: title,
            origin_name: originTitle,
            slug: slug,
            overview: item.overview || movieInfo?.content || '',
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            trailer_url: '',
            time: movieInfo?.time || '120 phút',
            episode_current: movieInfo?.episode_current || 'Full',
            episode_total: movieInfo?.episode_total || '1',
            quality: 'HD',
            lang: 'Vietsub',
            year: item.release_date ? parseInt(item.release_date.split('-')[0], 10) : new Date().getFullYear(),
            type: 'single',
            status: 'completed',
            genres: [],
            countries: [],
            view_count: Math.floor(Math.random() * 2000) + 1000,
            rating: item.vote_average || 8.5,
            vote_count: item.vote_count || 500,
            isVip: false,
            top10Rank: rank,
            danh_sach_server: servers,
            tmdb: {
                id: tmdbId,
                type: item.media_type || 'movie',
                vote_average: item.vote_average || 8.5,
                vote_count: item.vote_count || 500
            }
        };

        await Movie.create(movieDoc);
        console.log(`   🎉 Đã thêm mới vào MongoDB với Rank #${rank}! (Tổng ${servers.length} server)`);

        await sleep(400);
    }

    console.log('\n========================================================');
    console.log('🏆 HOÀN THÀNH ĐỒNG BỘ TOP 10 TMDB THỊNH HÀNH HÔM NAY!');
    console.log('========================================================\n');
    return true;
};

// Nếu chạy trực tiếp từ dòng lệnh
if (require.main === module) {
    syncTop10TMDB()
        .then(() => {
            mongoose.disconnect();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Lỗi khi chạy syncTop10TMDB:', err);
            mongoose.disconnect();
            process.exit(1);
        });
}

module.exports = syncTop10TMDB;
