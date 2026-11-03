const mongoose = require('mongoose');

const vipPlanSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'Vui lòng nhập mã định danh gói'],
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },
        name: {
            type: String,
            required: [true, 'Vui lòng nhập tên gói'],
            trim: true
        },
        durationDays: {
            type: Number,
            required: [true, 'Vui lòng nhập số ngày sử dụng'],
            min: [1, 'Thời hạn tối thiểu là 1 ngày']
        },
        price: {
            type: Number,
            required: [true, 'Vui lòng nhập giá bán'],
            min: [0, 'Giá không được âm']
        },
        originalPrice: {
            type: Number,
            default: 0
        },
        badge: {
            type: String,
            default: '',
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        features: {
            type: [String],
            default: [
                'Xem toàn bộ kho phim VIP không giới hạn 5 phút',
                'Trải nghiệm 2 máy chủ phát Full HD / 4K',
                'Không quảng cáo ngắt quãng'
            ]
        },
        isPopular: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        order: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

/**
 * Tự động tạo dữ liệu các gói VIP mặc định nếu database chưa có
 */
vipPlanSchema.statics.seedDefaultPlans = async function () {
    try {
        const count = await this.countDocuments();
        if (count > 0) return;

        const defaultPlans = [
            {
                code: 'vip_1m',
                name: 'VIP 1 Tháng',
                durationDays: 30,
                price: 49000,
                originalPrice: 69000,
                badge: 'Gói Trải Nghiệm',
                description: 'Trải nghiệm toàn bộ kho phim đỉnh cao không giới hạn',
                features: [
                    'Xem phim không giới hạn 5 phút',
                    'Mở khóa Server 1 & Server 2',
                    'Chất lượng Full HD / 4K sắc nét',
                    'Không quảng cáo ngắt quãng'
                ],
                isPopular: false,
                isActive: true,
                order: 1
            },
            {
                code: 'vip_3m',
                name: 'VIP 3 Tháng',
                durationDays: 90,
                price: 129000,
                originalPrice: 207000,
                badge: 'Tiết kiệm 37%',
                description: 'Gói xem phim tiêu chuẩn dài hạn được yêu thích nhất',
                features: [
                    'Xem phim không giới hạn 5 phút',
                    'Tốc độ tải phim ưu tiên băng thông cao',
                    'Chất lượng Full HD / 4K sắc nét',
                    'Tiết kiệm 37% so với gia hạn từng tháng'
                ],
                isPopular: false,
                isActive: true,
                order: 2
            },
            {
                code: 'vip_1y',
                name: 'VIP 1 Năm',
                durationDays: 365,
                price: 499000,
                originalPrice: 828000,
                badge: '👑 Phổ Biến Nhất',
                description: 'Thưởng thức điện ảnh trọn vẹn 365 ngày với mức giá ưu đãi nhất',
                features: [
                    'Quyền lợi VIP trọn vẹn 365 ngày',
                    'Tận hưởng kho phim VIP độc quyền',
                    'Ưu tiên băng thông máy chủ cao nhất',
                    'Tiết kiệm tới 40% chi phí cả năm'
                ],
                isPopular: true,
                isActive: true,
                order: 3
            }
        ];

        await this.insertMany(defaultPlans);
    } catch (_err) {
        // Tránh làm crash server nếu có xung đột seed đồng thời
    }
};

module.exports = mongoose.model('VipPlan', vipPlanSchema);
