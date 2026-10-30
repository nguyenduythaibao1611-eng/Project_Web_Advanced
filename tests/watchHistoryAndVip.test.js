const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const tmdbService = require('../services/tmdbService');
const ophimService = require('../services/ophimService');
const WatchHistory = require('../models/watchHistoryModel');
const User = require('../models/userModel');

let server;
let base;
let testUserToken;
let testUserId = '507f1f77bcf86cd799439011';
let testSessionId = 'test-session-uuid-123';

const origGetMovieDetail = tmdbService.getMovieDetail;
const origSearchOphim = ophimService.searchOphim;
const origGetFirstEpisode = ophimService.getFirstEpisode;
const origFindById = User.findById;
const origFindByIdAndUpdate = User.findByIdAndUpdate;
const origFindOne = WatchHistory.findOne;
const origFind = WatchHistory.find;
const origFindOneAndUpdate = WatchHistory.findOneAndUpdate;

before(async () => {
    // Tạo token xác thực giả lập cho test user
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_cineverse';
    process.env.JWT_SECRET = secret;

    testUserToken = jwt.sign(
        { id: testUserId, username: 'testuser', sessionId: testSessionId },
        secret,
        { expiresIn: '1d' }
    );

    // Mock User.findById để authMiddleware nhận diện user
    User.findById = (_id) => ({
        select: async () => ({
            _id: testUserId,
            username: 'testuser',
            email: 'test@cineverse.com',
            role: 'user',
            isVip: false,
            activeSessionId: testSessionId
        })
    });

    server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    tmdbService.getMovieDetail = origGetMovieDetail;
    ophimService.searchOphim = origSearchOphim;
    ophimService.getFirstEpisode = origGetFirstEpisode;
    User.findById = origFindById;
    User.findByIdAndUpdate = origFindByIdAndUpdate;
    WatchHistory.findOne = origFindOne;
    WatchHistory.find = origFind;
    WatchHistory.findOneAndUpdate = origFindOneAndUpdate;

    return new Promise((resolve) => server.close(resolve));
});

test('movieDetail page renders HLS player, CDN and Multi-Server buttons', async () => {
    tmdbService.getMovieDetail = async (id) => ({
        id: Number(id),
        title: 'Deadpool & Wolverine',
        original_title: 'Deadpool & Wolverine',
        overview: 'Marvel superhero film',
        poster_path: '/deadpool.jpg',
        backdrop_path: '/deadpool_bg.jpg',
        runtime: 128,
        release_date: '2024-07-26',
        vote_average: 8.2,
        genres: [{ id: 28, name: 'Hành động' }]
    });

    ophimService.searchOphim = async () => [{ slug: 'deadpool-va-wolverine' }];
    ophimService.getFirstEpisode = async () => ({
        serverName: 'Vietsub #1',
        episodeName: 'Full',
        m3u8Url: 'https://cdn.cineverse.test/stream/deadpool/index.m3u8',
        embedUrl: 'https://player.phimapi.com/player/?url=deadpool'
    });

    WatchHistory.findOne = async () => ({
        movieId: 533535,
        currentTime: 145,
        duration: 7680
    });

    const response = await fetch(`${base}/movies/533535`, {
        headers: {
            Cookie: `cineverse_token=${testUserToken}`
        }
    });

    assert.equal(response.status, 200);
    const html = await response.text();

    // Kiểm tra nhúng HLS.js CDN
    assert.match(html, /hls\.js/);
    assert.match(html, /id="cineversePlayer"/);
    assert.match(html, /id="fallbackPlayer"/);
    assert.match(html, /Server 1/);
    assert.match(html, /Server 2/);
    assert.match(html, /vipPaywallOverlay/);
    assert.match(html, /resumeBanner/);
});

test('POST /api/history validates input and upserts watch position', async () => {
    let upsertCalled = false;
    let savedDoc = null;

    WatchHistory.findOneAndUpdate = async (filter, update) => {
        upsertCalled = true;
        savedDoc = {
            ...update,
            _id: 'history_id_123',
            progressPercent: 35
        };
        return savedDoc;
    };

    // 1. Thử gửi không có movieId hợp lệ
    const invalidRes = await fetch(`${base}/api/history`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        },
        body: JSON.stringify({ movieId: 'abc' })
    });
    assert.equal(invalidRes.status, 400);

    // 2. Gửi hợp lệ
    const validRes = await fetch(`${base}/api/history`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        },
        body: JSON.stringify({
            movieId: 533535,
            movieTitle: 'Deadpool & Wolverine',
            posterUrl: 'https://image.tmdb.org/t/p/w500/deadpool.jpg',
            episode: 'Tập 1',
            currentTime: 240,
            duration: 7200
        })
    });

    assert.equal(validRes.status, 200);
    const data = await validRes.json();
    assert.equal(data.success, true);
    assert.equal(upsertCalled, true);
    assert.equal(savedDoc.currentTime, 240);
    assert.equal(savedDoc.duration, 7200);
});

test('GET /api/history returns user watch list', async () => {
    WatchHistory.find = () => ({
        sort: () => ({
            limit: async () => [
                {
                    movieId: 533535,
                    movieTitle: 'Deadpool & Wolverine',
                    currentTime: 240,
                    duration: 7200,
                    updatedAt: new Date()
                }
            ]
        })
    });

    const res = await fetch(`${base}/api/history`, {
        headers: {
            Cookie: `cineverse_token=${testUserToken}`
        }
    });

    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.success, true);
    assert.equal(result.count, 1);
    assert.equal(result.data[0].movieId, 533535);
});

test('POST /api/auth/upgrade-vip successfully upgrades user account', async () => {
    User.findByIdAndUpdate = async (id, update) => ({
        _id: id,
        username: 'testuser',
        email: 'test@cineverse.com',
        isVip: update.isVip
    });

    const res = await fetch(`${base}/api/auth/upgrade-vip`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `cineverse_token=${testUserToken}`
        }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isVip, true);
});
