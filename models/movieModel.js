const mongoose = require('mongoose');

// Schema cho từng tập phim
const episodeItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true // VD: "Tập 1", "Full"
        },
        slug: {
            type: String,
            required: true,
            trim: true // VD: "tap-1"
        },
        filename: {
            type: String,
            default: ''
        },
        link_m3u8: {
            type: String,
            default: '' // Nguồn OPhim phát qua HLS.js
        },
        link_embed: {
            type: String,
            default: '' // Nguồn VidSrc hoặc OPhim nhúng qua iframe
        }
    },
    { _id: false }
);

// Schema cho danh sách server (Hỗ trợ đa server: OPhim HLS, VidSrc Iframe...)
const serverSchema = new mongoose.Schema(
    {
        server_name: {
            type: String,
            required: true,
            trim: true // VD: "OPhim VIP (HLS)", "VidSrc Dự Phòng (Iframe)"
        },
        server_type: {
            type: String,
            enum: ['m3u8', 'iframe'],
            default: 'm3u8'
        },
        server_data: [episodeItemSchema]
    },
    { _id: false }
);

// Schema chính cho Bộ phim
const movieSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Vui lòng nhập tên phim'],
            trim: true,
            index: true
        },
        isPublished: { type: Boolean, default: true, index: true },
        origin_name: {
            type: String,
            trim: true,
            default: ''
        },
        slug: {
            type: String,
            required: [true, 'Slug định danh phim là bắt buộc'],
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },
        overview: {
            type: String,
            default: ''
        },
        poster_url: {
            type: String,
            default: '' // Đường link ảnh lưu trữ trên Supabase Storage
        },
        backdrop_url: {
            type: String,
            default: '' // Đường link ảnh nền banner lưu trên Supabase Storage
        },
        trailer_url: {
            type: String,
            default: ''
        },
        time: {
            type: String,
            default: '' // Thời lượng (VD: "120 phút", "45 phút/tập")
        },
        episode_current: {
            type: String,
            default: 'Full' // VD: "Tập 12/12", "Full"
        },
        episode_total: {
            type: String,
            default: '1'
        },
        quality: {
            type: String,
            default: 'HD' // HD, FHD, 2K, 4K, CAM
        },
        lang: {
            type: String,
            default: 'Vietsub' // Vietsub, Thuyết minh, Lồng tiếng
        },
        year: {
            type: Number,
            index: true
        },
        type: {
            type: String,
            enum: ['single', 'series', 'hoathinh', 'tvshows'],
            default: 'single',
            index: true
        },
        status: {
            type: String,
            enum: ['completed', 'ongoing', 'trailer'],
            default: 'completed'
        },
        genres: [
            {
                id: { type: String, default: '' },
                name: { type: String, required: true },
                slug: { type: String, required: true }
            }
        ],
        countries: [
            {
                id: { type: String, default: '' },
                name: { type: String, required: true },
                slug: { type: String, required: true }
            }
        ],
        actor: {
            type: [String],
            default: []
        },
        director: {
            type: [String],
            default: []
        },
        view_count: {
            type: Number,
            default: 0,
            index: true
        },
        rating: {
            type: Number,
            default: 0
        },
        vote_count: {
            type: Number,
            default: 0
        },
        isVip: {
            type: Boolean,
            default: false,
            index: true // Phân quyền xem Free (5 phút/5 tập đầu) vs VIP trọn vẹn (Nguyên phụ trách)
        },
        isFeatured: {
            type: Boolean,
            default: false,
            index: true
        },
        top10Rank: {
            type: Number,
            default: null,
            index: true // 1 -> 10 nếu nằm trong Top 10 thịnh hành TMDB hôm nay
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        },
        // Mảng server đa nguồn (OPhim m3u8 + VidSrc iframe) chuẩn theo Phase 2
        danh_sach_server: [serverSchema],
        tmdb: {
            id: { type: String, default: '' },
            type: { type: String, default: 'movie' },
            vote_average: { type: Number, default: 0 },
            vote_count: { type: Number, default: 0 }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// 1. Text Index để phục vụ thanh Tìm kiếm realtime (Task của Nam ở Phase 4)
movieSchema.index(
    { title: 'text', origin_name: 'text' },
    { default_language: 'none', weights: { title: 10, origin_name: 5 } }
);

// 2. Compound Index để lọc danh sách phim theo thể loại, năm và loại phim siêu tốc
movieSchema.index({ 'genres.slug': 1, year: -1 });
movieSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Movie', movieSchema);
