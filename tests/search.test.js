const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const create = axios.create;
let apiRequest;
axios.create = () => ({ get: async (path, options) => {
    apiRequest = { path, options };
    return { data: { results: [], total_pages: 0, total_results: 0 } };
} });
const service = require('../services/tmdbService');
axios.create = create;
const searchMovies = service.searchMovies;
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
    service.searchMovies = searchMovies;
    return new Promise(resolve => server.close(resolve));
});

test('TMDB search passes encoded params, pagination, adult filter and timeout', async () => {
    await searchMovies('A & B', 3);
    assert.equal(apiRequest.path, '/search/movie');
    assert.deepEqual(apiRequest.options.params, {
        query: 'A & B', language: 'vi-VN', page: 3, include_adult: false
    });
    assert.equal(apiRequest.options.timeout, 8000);
});

test('empty search renders guidance without calling TMDB', async () => {
    service.searchMovies = () => { throw new Error('Must not call'); };
    const response = await fetch(`${base}/search?q=%20%20`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Bạn muốn xem phim gì/);
    const suggestions = await fetch(`${base}/api/search?q=a`);
    assert.deepEqual(await suggestions.json(), { movies: [] });
});

test('rejects malformed, excessive queries and invalid pages', async () => {
    for (const query of ['q=a&q=b', `q=${'a'.repeat(201)}`, 'q=a&page=0', 'q=a&page=501', 'q=a&page=2.5']) {
        for (const path of ['/search', '/api/search']) {
            assert.equal((await fetch(`${base}${path}?${query}`)).status, 400);
        }
    }
});

test('results reuse movie cards, escape text and preserve pagination query', async () => {
    service.searchMovies = async (keyword, page) => {
        assert.equal(keyword, '<script>alert(1)</script>');
        assert.equal(page, 2);
        return { results: [{ id: 42, title: '<img src=x onerror=alert(1)>' }], total_pages: 3, total_results: 41 };
    };
    const response = await fetch(`${base}/search?q=${encodeURIComponent(' <script>alert(1)</script> ')}&page=2`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/movies\/42"/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /%3Cscript%3Ealert/);
    assert.match(html, /&amp;page=3/);
});

test('suggestions return at most five movies and only needed fields', async () => {
    service.searchMovies = async () => ({ results: Array.from({ length: 8 }, (_, id) => ({
        id, title: 'Phim', release_date: '2026-01-01', overview: 'not needed'
    })) });
    const response = await fetch(`${base}/api/search?q=phim`);
    const { movies } = await response.json();
    assert.equal(movies.length, 5);
    assert.deepEqual(Object.keys(movies[0]), ['id', 'title', 'release_date']);
});

test('no results and upstream failure have distinct states', async () => {
    service.searchMovies = async () => ({ results: [], total_pages: 0, total_results: 0 });
    const empty = await fetch(`${base}/search?q=missing`);
    assert.equal(empty.status, 200);
    assert.match(await empty.text(), /Không tìm thấy phim phù hợp/);
    service.searchMovies = async () => { throw new Error('Upstream unavailable'); };
    const failed = await fetch(`${base}/search?q=phim`);
    assert.equal(failed.status, 502);
    assert.match(await failed.text(), /Chưa thể tải kết quả/);
    assert.equal((await fetch(`${base}/api/search?q=phim`)).status, 502);
});
