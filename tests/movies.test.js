const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const create = axios.create;
let request;
axios.create = () => ({ get: async (path, options) => {
    request = { path, options };
    return { data: { results: [], total_pages: 1 } };
} });
const service = require('../services/tmdbService');
axios.create = create;
const getMovieList = service.getMovieList;
const app = require('../app');
let server;
let base;

before(async () => {
    server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
    service.getMovieList = getMovieList;
    return new Promise(resolve => server.close(resolve));
});

test('TMDB receives page, genre, adult filter and timeout', async () => {
    await getMovieList(3, '28');
    assert.equal(request.path, '/discover/movie');
    assert.deepEqual(request.options.params, {
        language: 'vi-VN', sort_by: 'popularity.desc', include_adult: false, page: 3, with_genres: '28'
    });
    assert.equal(request.options.timeout, 8000);
    await getMovieList(1, '');
    assert.equal('with_genres' in request.options.params, false);
});

test('movie page renders cards and keeps genre in pagination', async () => {
    service.getMovieList = async (page, genre) => {
        assert.equal(page, 2);
        assert.equal(genre, '28');
        return { results: [{ id: 42, title: '<img src=x onerror=alert(1)>' }], total_pages: 800 };
    };
    const response = await fetch(`${base}/movies?page=2&genre=28`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/movies\/42"/);
    assert.match(html, /&lt;img/);
    assert.match(html, /page=3&amp;genre=28/);
    assert.match(html, /TRANG 2 \/ 500/);
    assert.match(html, /href="\/movies" class="nav-item movies-nav-item active/);
});

test('rejects invalid pages and genres without calling TMDB', async () => {
    service.getMovieList = () => { throw new Error('Must not call'); };
    for (const query of ['page=0', 'page=501', 'page=2.5', 'page=1&page=2', 'genre=abc', 'genre=28&genre=35']) {
        assert.equal((await fetch(`${base}/movies?${query}`)).status, 400);
    }
});

test('empty results and API failure show different states', async () => {
    service.getMovieList = async () => ({ results: [], total_pages: 0 });
    let response = await fetch(`${base}/movies`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Chưa có phim ở trang này/);
    service.getMovieList = async () => { throw new Error('Unavailable'); };
    response = await fetch(`${base}/movies`);
    assert.equal(response.status, 502);
    assert.match(await response.text(), /Chưa thể tải danh sách phim/);
});
