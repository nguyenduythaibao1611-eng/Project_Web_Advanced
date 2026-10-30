const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId là bắt buộc'],
            index: true
        },
        movieId: {
            type: Number,
            required: [true, 'movieId là bắt buộc'],
            index: true
        },
        movieTitle: {
            type: String,
            required: [true, 'movieTitle là bắt buộc'],
            trim: true
        },
        posterUrl: {
            type: String,
            default: '',
            trim: true
        },
        episode: {
            type: String,
            default: 'Tập 1',
            trim: true
        },
        currentTime: {
            type: Number,
            default: 0,
            min: 0
        },
        duration: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index phức hợp để mỗi user chỉ có 1 bản ghi lịch sử cho 1 bộ phim (hỗ trợ upsert không trùng lặp)
watchHistorySchema.index({ userId: 1, movieId: 1 }, { unique: true });

// Index hỗ trợ truy vấn danh sách phim xem gần nhất theo thời gian giảm dần
watchHistorySchema.index({ userId: 1, updatedAt: -1 });

// Virtual tính phần trăm tiến độ đã xem (0 - 100%)
watchHistorySchema.virtual('progressPercent').get(function () {
    if (!this.duration || this.duration <= 0) return 0;
    const percent = Math.round((this.currentTime / this.duration) * 100);
    return Math.min(100, Math.max(0, percent));
});

module.exports = mongoose.model('WatchHistory', watchHistorySchema);
