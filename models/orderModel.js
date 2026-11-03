const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        orderCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VipPlan'
        },
        planCode: {
            type: String,
            required: true
        },
        planName: {
            type: String,
            required: true
        },
        durationDays: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ['vietqr', 'momo', 'vnpay'],
            default: 'vietqr'
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'expired'],
            default: 'pending',
            index: true
        },
        transferContent: {
            type: String,
            required: true
        },
        qrCodeUrl: {
            type: String,
            default: ''
        },
        transactionId: {
            type: String,
            default: null
        },
        paidAt: {
            type: Date,
            default: null
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 phút
            index: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
