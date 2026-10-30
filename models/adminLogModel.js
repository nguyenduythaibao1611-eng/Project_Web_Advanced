const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    summary: { type: String, required: true }
}, { timestamps: true });
adminLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AdminLog', adminLogSchema);
