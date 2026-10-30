const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const SESSION_REPLACED_MESSAGE = 'Tài khoản của bạn đã được đăng nhập trên một thiết bị khác. Vui lòng đăng nhập lại.';
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

const ONBOARDING_GENRES = [
    { id: 'hanh-dong', name: 'Hành động', emoji: '💥', icon: 'fa-solid fa-gun', desc: 'Kịch tính, đấu súng & nghẹt thở' },
    { id: 'tinh-cam', name: 'Tình cảm', emoji: '💖', icon: 'fa-solid fa-heart', desc: 'Lãng mạn, sâu lắng & cảm xúc' },
    { id: 'hoat-hinh', name: 'Hoạt hình', emoji: '🎨', icon: 'fa-solid fa-wand-magic-sparkles', desc: 'Sáng tạo, rực rỡ & anime' },
    { id: 'vien-tuong', name: 'Viễn tưởng', emoji: '🚀', icon: 'fa-solid fa-rocket', desc: 'Vũ trụ, tương lai & công nghệ' },
    { id: 'hai-huoc', name: 'Hài hước', emoji: '😂', icon: 'fa-solid fa-face-laugh-beam', desc: 'Vui vẻ, hóm hỉnh & thư giãn' },
    { id: 'kinh-di', name: 'Kinh dị', emoji: '👻', icon: 'fa-solid fa-ghost', desc: 'Rùng rợn, giật gân & ma mị' },
    { id: 'phieu-luu', name: 'Phiêu lưu', emoji: '🏹', icon: 'fa-solid fa-compass', desc: 'Khám phá bí ẩn & thám hiểm' },
    { id: 'bi-an', name: 'Bí ẩn', emoji: '🕵️', icon: 'fa-solid fa-user-secret', desc: 'Trinh thám, phá án & đấu trí' },
    { id: 'gia-dinh', name: 'Gia đình', emoji: '👨‍👩‍👧‍👦', icon: 'fa-solid fa-people-roof', desc: 'Gắn kết, bài học & ấm áp' },
    { id: 'toi-pham', name: 'Tội phạm', emoji: '🔍', icon: 'fa-solid fa-handcuffs', desc: 'Hành động hình sự & thế giới ngầm' },
    { id: 'gia-tuong', name: 'Giả tưởng', emoji: '🧙', icon: 'fa-solid fa-dragon', desc: 'Ma thuật, sử thi & thần thoại' },
    { id: 'chien-tranh', name: 'Chiến tranh', emoji: '⚔️', icon: 'fa-solid fa-shield-halved', desc: 'Chiến trường hào hùng & lịch sử' }
];

/**
 * Tạo JWT token cho người dùng
 */
const generateToken = (user, sessionId) => {
    return jwt.sign(
        { id: user._id, username: user.username, sessionId },
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
    let errorMessage = null;
    if (req.query.reason === 'session_replaced') {
        errorMessage = SESSION_REPLACED_MESSAGE;
    }

    res.render('pages/login', {
        title: 'Đăng Nhập - CineVerse',
        error: errorMessage,
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
        if (!isMatch || user.isBlocked) {
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
        const sessionId = crypto.randomUUID();
        const activeUser = await User.findOneAndUpdate(
            { _id: user._id, isBlocked: { $ne: true } }, { activeSessionId: sessionId }
        );
        if (!activeUser) throw new Error('Account unavailable');

        const token = generateToken(user, sessionId);
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
        const sessionId = crypto.randomUUID();
        const newUser = await User.create({
            username: normalizedUsername,
            email: normalizedEmail,
            password,
            activeSessionId: sessionId
        });

        // Tự động đăng nhập sau khi tạo tài khoản thành công
        const token = generateToken(newUser, sessionId);
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        const onboardingUrl = redirectUrl && redirectUrl !== '/'
            ? `/onboarding?redirect=${encodeURIComponent(redirectUrl)}`
            : '/onboarding';

        if (isApi) {
            return res.status(201).json({
                success: true,
                message: 'Đăng ký tài khoản thành công.',
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    email: newUser.email,
                    preferences: newUser.preferences || [],
                    age: newUser.age ?? null
                },
                redirectTo: onboardingUrl
            });
        }

        return res.redirect(onboardingUrl);
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
exports.logout = async (req, res) => {
    try {
        if (req.user && req.sessionId) {
            await User.findOneAndUpdate(
                { _id: req.user._id, activeSessionId: req.sessionId },
                { activeSessionId: null }
            );
        }
    } catch (err) {
        console.error('Lỗi khi xóa session lúc đăng xuất:', err.message);
    }

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
    if (req.sessionReplaced) {
        return res.status(401).json({
            success: false,
            code: 'SESSION_REPLACED',
            message: SESSION_REPLACED_MESSAGE
        });
    }

    if (!req.user) {
        return res.status(401).json({ success: false, user: null });
    }
    return res.json({
        success: true,
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            isVip: Boolean(req.user.isVip),
            role: req.user.role || 'user',
            preferences: req.user.preferences || [],
            age: req.user.age ?? null
        }
    });
};

/**
 * 7. Nâng cấp tài khoản VIP
 * POST /api/auth/upgrade-vip
 */
exports.upgradeVip = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập để nâng cấp gói VIP.'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { isVip: true },
            { new: true }
        );

        return res.json({
            success: true,
            isVip: true,
            message: '🎉 Chúc mừng bạn đã nâng cấp thành công gói VIP CineVerse! Thưởng thức phim không giới hạn.',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isVip: user.isVip,
                preferences: user.preferences || [],
                age: user.age ?? null
            }
        });
    } catch (error) {
        console.error('Lỗi khi nâng cấp VIP:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi nâng cấp VIP.'
        });
    }
};

/**
 * 8. Toggle VIP (cho mục đích demo/kiểm thử)
 * POST /api/auth/toggle-vip
 */
exports.toggleVip = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập.'
            });
        }

        const currentStatus = Boolean(req.user.isVip);
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { isVip: !currentStatus },
            { new: true }
        );

        return res.json({
            success: true,
            isVip: user.isVip,
            message: user.isVip ? 'Đã kích hoạt VIP.' : 'Đã chuyển về tài khoản Thường.'
        });
    } catch (error) {
        console.error('Lỗi toggle VIP:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

/**
 * 9. Hiển thị trang Onboarding (chọn thể loại phim yêu thích)
 * GET /onboarding
 */
exports.getOnboardingPage = (req, res) => {
    if (!req.user) {
        const redirectUrl = sanitizeRedirectUrl(req.originalUrl);
        return res.redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }

    const redirectUrl = sanitizeRedirectUrl(req.query.redirect || '/');
    res.render('pages/onboarding', {
        title: 'Khảo Sát Sở Thích - CineVerse',
        user: req.user,
        genres: ONBOARDING_GENRES,
        currentPreferences: req.user.preferences || [],
        currentAge: req.user.age ?? '',
        redirect: redirectUrl,
        error: null
    });
};

/**
 * 10. Xử lý lưu sở thích (preferences) và độ tuổi (age) sau onboarding
 * POST /onboarding
 */
exports.postOnboarding = async (req, res) => {
    const isApi = req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.user) {
        if (isApi) {
            return res.status(401).json({
                success: false,
                requireAuth: true,
                message: 'Vui lòng đăng nhập để lưu sở thích phim.'
            });
        }
        return res.redirect('/login?redirect=%2Fonboarding');
    }

    const redirectUrl = sanitizeRedirectUrl(req.body.redirect || req.query.redirect || '/');

    try {
        let { preferences, genres, age } = req.body;
        let selectedPreferences = preferences !== undefined ? preferences : genres;

        if (typeof selectedPreferences === 'string') {
            try {
                const parsed = JSON.parse(selectedPreferences);
                if (Array.isArray(parsed)) {
                    selectedPreferences = parsed;
                } else {
                    selectedPreferences = [selectedPreferences];
                }
            } catch (_err) {
                if (selectedPreferences.includes(',')) {
                    selectedPreferences = selectedPreferences.split(',').map((g) => g.trim());
                } else if (selectedPreferences.trim().length > 0) {
                    selectedPreferences = [selectedPreferences.trim()];
                } else {
                    selectedPreferences = [];
                }
            }
        }

        if (!Array.isArray(selectedPreferences)) {
            selectedPreferences = [];
        }

        // Chuẩn hóa và làm sạch mảng sở thích
        selectedPreferences = selectedPreferences
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0);

        // Loại bỏ trùng lặp nếu có
        selectedPreferences = [...new Set(selectedPreferences)];

        // Kiểm tra số lượng: 3 - 5 thể loại
        if (selectedPreferences.length < 3 || selectedPreferences.length > 5) {
            const errorMsg = 'Vui lòng chọn từ 3 đến 5 thể loại phim yêu thích.';
            if (isApi) {
                return res.status(400).json({ success: false, message: errorMsg });
            }
            return res.status(400).render('pages/onboarding', {
                title: 'Khảo Sát Sở Thích - CineVerse',
                user: req.user,
                genres: ONBOARDING_GENRES,
                currentPreferences: selectedPreferences,
                currentAge: age || req.user.age || '',
                redirect: redirectUrl,
                error: errorMsg
            });
        }

        const updateData = {
            preferences: selectedPreferences
        };

        if (age !== undefined && age !== null && String(age).trim() !== '') {
            const parsedAge = Number(age);
            if (Number.isInteger(parsedAge) && parsedAge >= 1 && parsedAge <= 120) {
                updateData.age = parsedAge;
            } else {
                const ageError = 'Độ tuổi không hợp lệ (từ 1 đến 120 tuổi).';
                if (isApi) {
                    return res.status(400).json({ success: false, message: ageError });
                }
                return res.status(400).render('pages/onboarding', {
                    title: 'Khảo Sát Sở Thích - CineVerse',
                    user: req.user,
                    genres: ONBOARDING_GENRES,
                    currentPreferences: selectedPreferences,
                    currentAge: age,
                    redirect: redirectUrl,
                    error: ageError
                });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        );

        if (req.user && updatedUser) {
            req.user.preferences = updatedUser.preferences;
            if (updatedUser.age !== undefined) {
                req.user.age = updatedUser.age;
            }
        }

        if (isApi) {
            return res.json({
                success: true,
                message: 'Đã lưu sở thích thành công!',
                preferences: updatedUser ? updatedUser.preferences : selectedPreferences,
                age: updatedUser ? (updatedUser.age ?? null) : (updateData.age ?? null),
                redirectTo: redirectUrl
            });
        }

        return res.redirect(redirectUrl);
    } catch (error) {
        console.error('Lỗi khi lưu preferences onboarding:', error.message);
        const serverError = 'Đã có lỗi xảy ra khi lưu sở thích. Vui lòng thử lại.';
        if (isApi) {
            return res.status(500).json({ success: false, message: serverError });
        }
        return res.status(500).render('pages/onboarding', {
            title: 'Khảo Sát Sở Thích - CineVerse',
            user: req.user,
            genres: ONBOARDING_GENRES,
            currentPreferences: [],
            currentAge: '',
            redirect: redirectUrl,
            error: serverError
        });
    }
};

exports.ONBOARDING_GENRES = ONBOARDING_GENRES;
