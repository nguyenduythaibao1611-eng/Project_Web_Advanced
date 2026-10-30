const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Movie = require('../models/movieModel');
const Favorite = require('../models/favoriteModel');
const Log = require('../models/adminLogModel');
const { text, choice, movieInput } = require('../utils/adminValidation');

function httpError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function id(value) {
    if (!mongoose.isObjectIdOrHexString(value)) throw httpError('Không tìm thấy dữ liệu.', 404);
    return value;
}

function pageQuery(req) {
    const q = text(req.query.q, 100);
    const page = req.query.page === undefined ? '1' : req.query.page;
    if (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page)) throw httpError('Trang không hợp lệ.');
    return { q, page: Number(page), pattern: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
}

async function audited(req, action, target, summary, work) {
    const log = await Log.create({ actorId: req.user._id, actorName: req.user.username, action, target, summary });
    try {
        const result = await work();
        await Log.updateOne({ _id: log._id }, { status: 'success' });
        return result;
    } catch (error) {
        await Log.updateOne({ _id: log._id }, { status: 'failed' }).catch(() => {});
        throw error;
    }
}

function render(res, view, data = {}) {
    return res.render(`admin/${view}`, { layout: 'layouts/admin', title: 'CineVerse Admin', ...data });
}

exports.dashboard = async (req, res) => {
    const [users, admins, blocked, vip, movies, published, favorites, recentUsers, recentMovies] = await Promise.all([
        User.countDocuments(), User.countDocuments({ role: 'admin' }), User.countDocuments({ isBlocked: true }),
        User.countDocuments({ isVip: true }), Movie.countDocuments(), Movie.countDocuments({ isPublished: { $ne: false } }),
        Favorite.countDocuments(), User.find().select('username role createdAt').sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
        Movie.find().select('title isPublished createdAt').sort({ createdAt: -1, _id: -1 }).limit(5).lean()
    ]);
    render(res, 'dashboard', { section: 'dashboard', stats: { users, admins, blocked, vip, movies, published, favorites }, recentUsers, recentMovies });
};

exports.users = async (req, res) => {
    const query = pageQuery(req);
    const role = choice(req.query.role || '', ['', 'user', 'admin']);
    const state = choice(req.query.state || '', ['', 'active', 'blocked', 'vip']);
    const filter = {};
    if (query.q) filter.$or = [{ username: new RegExp(query.pattern, 'i') }, { email: new RegExp(query.pattern, 'i') }];
    if (role) filter.role = role;
    if (state === 'blocked') filter.isBlocked = true;
    if (state === 'active') filter.isBlocked = { $ne: true };
    if (state === 'vip') filter.isVip = true;
    const [items, total] = await Promise.all([
        User.find(filter).select('username email role isVip isBlocked createdAt __v').sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * 20).limit(20).lean(),
        User.countDocuments(filter)
    ]);
    render(res, 'users', { section: 'users', ...query, role, state, items, total, pages: Math.ceil(total / 20) });
};

exports.updateUser = async (req, res) => {
    const target = id(req.params.id);
    const role = choice(req.body.role, ['user', 'admin']);
    const isVip = choice(req.body.isVip, ['true', 'false']) === 'true';
    const isBlocked = choice(req.body.isBlocked, ['true', 'false']) === 'true';
    if (role === 'admin' && isBlocked) throw httpError('Hãy mở khóa trước khi cấp quyền admin.');
    // Không sửa tài khoản admin qua web, tránh tự khóa và mất admin cuối khi có thao tác đồng thời.
    const changes = { role, isVip, isBlocked, activeSessionId: null };
    const revision = text(req.body.revision, 12, true);
    if (!/^\d+$/.test(revision)) throw httpError('Phiên bản dữ liệu không hợp lệ.');
    await audited(req, 'user.update', target, `Quyền: ${role}; VIP: ${isVip}; khóa: ${isBlocked}`, async () => {
        const result = await User.findOneAndUpdate({ _id: target, role: { $ne: 'admin' }, __v: Number(revision) },
            { $set: changes, $inc: { __v: 1 } }, { runValidators: true });
        if (!result) throw httpError('Tài khoản admin được bảo vệ hoặc dữ liệu vừa thay đổi. Hãy tải lại danh sách.', 409);
    });
    res.redirect('/admin/users?saved=1');
};

exports.movies = async (req, res) => {
    const query = pageQuery(req);
    const type = choice(req.query.type || '', ['', 'single', 'series', 'hoathinh', 'tvshows']);
    const state = choice(req.query.state || '', ['', 'published', 'hidden', 'vip']);
    const filter = {};
    if (query.q) filter.$or = [{ title: new RegExp(query.pattern, 'i') }, { slug: new RegExp(query.pattern, 'i') }];
    if (type) filter.type = type;
    if (state === 'published') filter.isPublished = { $ne: false };
    if (state === 'hidden') filter.isPublished = false;
    if (state === 'vip') filter.isVip = true;
    const [items, total] = await Promise.all([
        Movie.find(filter).select('title slug year type isVip isPublished poster_url').sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * 20).limit(20).lean(),
        Movie.countDocuments(filter)
    ]);
    render(res, 'movies', { section: 'movies', ...query, type, state, items, total, pages: Math.ceil(total / 20) });
};

exports.movieForm = async (req, res) => {
    const movie = req.params.id ? await Movie.findById(id(req.params.id)).lean() : {
        type: 'single', status: 'completed', isPublished: false, isVip: false, quality: 'HD', lang: 'Vietsub', danh_sach_server: []
    };
    if (!movie) throw httpError('Không tìm thấy phim.', 404);
    render(res, 'movieForm', { section: 'movies', movie, error: '' });
};

exports.saveMovie = async (req, res) => {
    const target = req.params.id ? id(req.params.id) : null;
    let data;
    try {
        data = movieInput(req.body);
        const revision = text(req.body.revision, 12);
        if (target && !/^\d+$/.test(revision)) throw httpError('Phiên bản dữ liệu không hợp lệ.');
        const saved = await audited(req, target ? 'movie.update' : 'movie.create', target || data.slug,
            `${data.title} · ${data.isPublished ? 'Hiển thị' : 'Ẩn'} · ${data.isVip ? 'VIP' : 'Miễn phí'}`, async () => {
                if (!target) return Movie.create(data);
                const updated = await Movie.findOneAndUpdate({ _id: target, __v: Number(revision) },
                    { $set: data, $inc: { __v: 1 } }, { returnDocument: 'after', runValidators: true });
                if (!updated) throw httpError('Phim vừa bị thay đổi. Hãy mở lại trang để tránh ghi đè.', 409);
                return updated;
            });
        res.redirect(`/admin/movies/${saved._id}/edit?saved=1`);
    } catch (error) {
        if (error.status === 409) throw error;
        const isValidation = error.code === 11000 || error.name === 'ValidationError' || !data;
        if (!isValidation) throw error;
        const body = req.body;
        const fields = ['title', 'slug', 'origin_name', 'overview', 'year', 'type', 'status', 'poster_url', 'backdrop_url', 'trailer_url',
            'time', 'quality', 'lang', 'episode_current', 'episode_total', 'actor', 'director', 'genres', 'countries'];
        const movie = { _id: target, __v: /^\d+$/.test(body.revision || '') ? Number(body.revision) : 0,
            isVip: body.isVip === 'true', isPublished: body.isPublished === 'true', danh_sach_server: [] };
        for (const key of fields) movie[key] = typeof body[key] === 'string' ? body[key] : '';
        const submittedEpisodes = Array.isArray(body.episodes) ? body.episodes.filter(item => item && typeof item === 'object').slice(0, 200) : [];
        res.status(400);
        render(res, 'movieForm', { section: 'movies', movie, submittedEpisodes,
            error: error.code === 11000 ? 'Slug này đã tồn tại. Hãy chọn slug khác.' : error.message });
    }
};

exports.logs = async (req, res) => {
    const query = pageQuery(req);
    const filter = query.q ? { $or: ['actorName', 'action', 'target'].map(key => ({ [key]: new RegExp(query.pattern, 'i') })) } : {};
    const [items, total] = await Promise.all([
        Log.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * 20).limit(20).lean(), Log.countDocuments(filter)
    ]);
    render(res, 'logs', { section: 'logs', ...query, items, total, pages: Math.ceil(total / 20) });
};

exports.upload = async (req, res) => {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > 5 * 1024 * 1024) throw httpError('Ảnh tối đa 5 MB.');
    let ext;
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ext = 'png';
    else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ext = 'jpg';
    else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
    else throw httpError('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
    const name = `${crypto.randomUUID()}.${ext}`;
    const directory = path.join(__dirname, '../public/uploads/admin');
    await audited(req, 'image.upload', name, 'Tải ảnh lên thư viện phim', async () => {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, name), buffer, { flag: 'wx' });
    });
    res.json({ url: `/uploads/admin/${name}` });
};

exports.error = (error, req, res, _next) => {
    console.error('Admin:', error.message);
    const status = error.status || 500;
    const message = status < 500 ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại; kiểm tra nhật ký nếu bạn vừa lưu dữ liệu.';
    if (req.path === '/upload') return res.status(status).json({ error: message });
    res.status(status);
    render(res, 'error', { message, status });
};
