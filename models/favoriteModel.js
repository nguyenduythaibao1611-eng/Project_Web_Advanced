const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        movieId: {
            type: Number,
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        poster_path: {
            type: String,
            default: ''
        },
        vote_average: {
            type: Number,
            default: 0
        },
        release_date: {
            type: String,
            default: ''
        },
        overview: {
            type: String,
            default: ''
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        id: false, // Tắt getter id mặc định trỏ về _id của Mongoose
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index phức hợp để mỗi user chỉ thích 1 phim 1 lần và hỗ trợ tìm kiếm nhanh
favoriteSchema.index({ userId: 1, movieId: 1 }, { unique: true });

// Virtual getter để EJS truy cập movie.id như dữ liệu TMDB (trả về movieId số nguyên)
favoriteSchema.virtual('id').get(function () {
    return this.movieId;
});

module.exports = mongoose.model('Favorite', favoriteSchema);
