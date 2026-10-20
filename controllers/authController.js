const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const {
    COOKIE_NAME,
    getJwtSecret,
    sanitizeRedirectUrl
} = require('../middlewares/authMiddleware');

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
};

/**
 * Tạo JWT token cho người dùng
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username },
        getJwtSecret(),
        { expiresIn: '7d' }
    );
};

/**
 * 1. Hiển thị trang đăng nhập
 * GET /login
 */
exports.getLoginPage = (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    const redirectUrl = sanitizeRedirectUrl(req.query.redirect || '/');
    res.render('pages/login', {
        title: 'Đăng Nhập - CineVerse',
        error: null,
        redirect: redirectUrl,
        usernameOrEmail: ''
    });
};

/**
 * 2. Xử lý đăng nhập
 * POST /login
 */
exports.postLogin = async (req, res) => {
    const { usernameOrEmail, password, redirect } = req.body;
    const redirectUrl = sanitizeRedirectUrl(redirect || req.query.redirect || '/');
    const isApi = req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));

    try {
        if (!usernameOrEmail || !password) {
            const errorMsg = 'Vui lòng điền đầy đủ tên đăng nhập/email và mật khẩu.';
            if (isApi) {
                return res.status(400).json({ success: false, message: errorMsg });
            }
            return res.status(400).render('pages/login', {
                title: 'Đăng Nhập - CineVerse',
                error: errorMsg,
                redirect: redirectUrl,
                usernameOrEmail: usernameOrEmail || ''
            });
        }

        const normalizedIdentifier = usernameOrEmail.trim().toLowerCase();
        const user = await User.findOne({
            $or: [
                { email: normalizedIdentifier },
                { username: normalizedIdentifier }
            ]
        });

        // Phản hồi lỗi chung để bảo mật, tránh dò quét tài khoản
        const invalidCredsMsg = 'Tên đăng nhập hoặc mật khẩu không chính xác.';

        if (!user) {
            if (isApi) {
                return res.status(401).json({ success: false, message: invalidCredsMsg });
            }
            return res.status(401).render('pages/login', {
                title: 'Đăng Nhập - CineVerse',
                error: invalidCredsMsg,
                redirect: redirectUrl,
                usernameOrEmail
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            if (isApi) {
                return res.status(401).json({ success: false, message: invalidCredsMsg });
            }
            return res.status(401).render('pages/login', {
                title: 'Đăng Nhập - CineVerse',
                error: invalidCredsMsg,
                redirect: redirectUrl,
                usernameOrEmail
            });
        }

        // Đăng nhập thành công -> Tạo token & gắn HTTP-only cookie
        const token = generateToken(user);
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        if (isApi) {
            return res.json({
                success: true,
                message: 'Đăng nhập thành công.',
                user: { id: user._id, username: user.username, email: user.email }
            });
        }

        return res.redirect(redirectUrl);
    } catch (error) {
        console.error('Lỗi khi xử lý đăng nhập:', error.message);
        const serverErrorMsg = 'Đã có lỗi xảy ra trong quá trình đăng nhập. Vui lòng thử lại sau.';
        if (isApi) {
            return res.status(500).json({ success: false, message: serverErrorMsg });
        }
        return res.status(500).render('pages/login', {
            title: 'Đăng Nhập - CineVerse',
            error: serverErrorMsg,
            redirect: redirectUrl,
            usernameOrEmail: usernameOrEmail || ''
        });
    }
};

/**
 * 3. Hiển thị trang đăng ký
 * GET /register
 */
exports.getRegisterPage = (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    const redirectUrl = sanitizeRedirectUrl(req.query.redirect || '/');
    res.render('pages/register', {
        title: 'Đăng Ký Tài Khoản - CineVerse',
        error: null,
        redirect: redirectUrl,
        formData: {}
    });
};

/**
 * 4. Xử lý đăng ký tài khoản mới
 * POST /register
 */
exports.postRegister = async (req, res) => {
    const { username, email, password, confirmPassword, redirect } = req.body;
    const redirectUrl = sanitizeRedirectUrl(redirect || req.query.redirect || '/');
    const isApi = req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));

    const formData = {
        username: username || '',
        email: email || ''
    };

    try {
        if (!username || !email || !password || !confirmPassword) {
            throw new Error('Vui lòng điền đầy đủ tất cả các trường.');
        }

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
            throw new Error('Tên người dùng phải có từ 3 đến 30 ký tự.');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            throw new Error('Định dạng email không hợp lệ.');
        }

        if (password.length < 6) {
            throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự.');
        }

        if (password !== confirmPassword) {
            throw new Error('Mật khẩu xác nhận không khớp.');
        }

        // Kiểm tra trùng lặp tài khoản
        const existingUsername = await User.findOne({ username: normalizedUsername });
        if (existingUsername) {
            throw new Error('Tên người dùng này đã có người sử dụng.');
        }

        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
            throw new Error('Địa chỉ email này đã được đăng ký tài khoản.');
        }

        // Tạo người dùng mới
        const newUser = await User.create({
            username: normalizedUsername,
            email: normalizedEmail,
            password
        });

        // Tự động đăng nhập sau khi tạo tài khoản thành công
        const token = generateToken(newUser);
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        if (isApi) {
            return res.status(201).json({
                success: true,
                message: 'Đăng ký tài khoản thành công.',
                user: { id: newUser._id, username: newUser.username, email: newUser.email }
            });
        }

        return res.redirect(redirectUrl);
    } catch (error) {
        if (isApi) {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(400).render('pages/register', {
            title: 'Đăng Ký Tài Khoản - CineVerse',
            error: error.message,
            redirect: redirectUrl,
            formData
        });
    }
};

/**
 * 5. Xử lý đăng xuất
 * GET/POST /logout
 */
exports.logout = (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });

    const isApi = req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isApi) {
        return res.json({ success: true, message: 'Đã đăng xuất thành công.' });
    }

    return res.redirect('/');
};

/**
 * 6. API lấy thông tin người dùng hiện tại
 * GET /api/auth/me
 */
exports.getCurrentUser = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, user: null });
    }
    return res.json({
        success: true,
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
        }
    });
};
