const crypto = require('node:crypto');
const { getJwtSecret } = require('./authMiddleware');

module.exports = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('X-Frame-Options', 'DENY');
    const token = crypto.createHmac('sha256', getJwtSecret())
        .update(`admin:${req.user._id}:${req.sessionId}`).digest('hex');
    res.locals.csrf = token;
    if (!['GET', 'HEAD'].includes(req.method)) {
        const supplied = req.get('X-CSRF-Token') || req.body?._csrf;
        if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
            !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
            return res.status(403).send('Yêu cầu không hợp lệ. Hãy tải lại trang và thử lại.');
        }
    }
    res.locals.section = '';
    res.locals.notice = '';
    next();
};
