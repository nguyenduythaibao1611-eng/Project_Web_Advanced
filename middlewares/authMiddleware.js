const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const COOKIE_NAME = 'cineverse_token';

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
};

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET chưa được cấu hình trong biến môi trường (.env).');
    }
    return secret;
};

/**
 * Middleware kiểm tra trạng thái đăng nhập của người dùng cho mọi request (không bắt buộc đăng nhập)
 * Gán req.user và res.locals.user để các view EJS (header, footer...) tự động render đúng trạng thái
 */
const checkUser = async (req, res, next) => {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

    if (!token) {
        req.user = null;
        res.locals.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        const user = await User.findById(decoded.id).select('-password');

        if (user) {
            req.user = user;
            res.locals.user = user;
        } else {
            // User đã bị xóa hoặc không còn tồn tại trong DB -> xóa cookie không hợp lệ
            res.clearCookie(COOKIE_NAME, {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
            });
            req.user = null;
            res.locals.user = null;
        }
    } catch (_err) {
        // Token hết hạn hoặc không hợp lệ -> xóa cookie
        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });
        req.user = null;
        res.locals.user = null;
    }

    next();
};

/**
 * Helper kiểm tra an toàn URL redirect để ngăn chặn lỗi Open-Redirect
 */
const sanitizeRedirectUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return '/';
    }
    const trimmed = url.trim();
    // Phải bắt đầu bằng / và không được bắt đầu bằng // hoặc chứa giao thức khác
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
        return trimmed;
    }
    return '/';
};

/**
 * Middleware bắt buộc đăng nhập (chỉ áp dụng cho các route cần bảo vệ như Favorites)
 */
const requireAuth = (req, res, next) => {
    if (req.user) {
        return next();
    }

    // Nếu là request dạng API hoặc AJAX (như /api/favorites/*)
    const isApiRequest = req.originalUrl.startsWith('/api/') ||
                         req.xhr ||
                         (req.headers.accept && req.headers.accept.includes('application/json'));

    if (isApiRequest) {
        return res.status(401).json({
            success: false,
            requireAuth: true,
            message: 'Vui lòng đăng nhập để thực hiện tính năng này.'
        });
    }

    // Nếu là truy cập trang giao diện web thông thường -> chuyển hướng đến trang /login
    const redirectUrl = sanitizeRedirectUrl(req.originalUrl);
    return res.redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
};

module.exports = {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    getJwtSecret,
    checkUser,
    requireAuth,
    sanitizeRedirectUrl
};
