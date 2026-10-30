function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }

function text(value, max = 200, required = false) {
    if (value === undefined) value = '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
        throw invalid(`Thông tin không hợp lệ hoặc dài quá ${max} ký tự.`);
    }
    return value.trim();
}

function choice(value, values) {
    if (!values.includes(value)) throw invalid('Lựa chọn không hợp lệ.');
    return value;
}

function url(value) {
    const result = text(value, 2000);
    if (!result) return '';
    if (/^\/uploads\/admin\/[a-f0-9-]+\.(png|jpg|webp)$/.test(result)) return result;
    let parsed;
    try { parsed = new URL(result); } catch { throw invalid('Đường dẫn phải là URL HTTP/HTTPS hợp lệ.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw invalid('Chỉ chấp nhận URL HTTP/HTTPS không chứa tài khoản.');
    }
    return result;
}

function list(value) {
    const result = text(value, 2000);
    const items = result ? result.split(',').map(item => item.trim()).filter(Boolean) : [];
    if (items.length > 30 || items.some(item => item.length > 100)) throw invalid('Danh sách quá dài.');
    return [...new Set(items)];
}

function slug(value) {
    const result = text(value, 180, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw invalid('Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối.');
    return result;
}

function movieInput(body) {
    const year = text(body.year, 4);
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1888 || Number(year) > 2100)) throw invalid('Năm phải từ 1888 đến 2100.');
    const groups = new Map();
    const episodes = body.episodes || [];
    if (!Array.isArray(episodes) || episodes.length > 100) throw invalid('Tối đa 100 tập mỗi lần lưu.');
    for (const episode of episodes) {
        if (!episode || typeof episode !== 'object') throw invalid('Tập phim không hợp lệ.');
        const server = text(episode.server, 100, true);
        const type = choice(episode.type, ['iframe', 'm3u8']);
        const embed = url(episode.embed);
        const hls = url(episode.hls);
        if ((type === 'iframe' && !embed) || (type === 'm3u8' && !hls)) throw invalid('Tập phim phải có link đúng với loại server.');
        const key = `${type}:${server}`;
        if (!groups.has(key)) groups.set(key, { server_name: server, server_type: type, server_data: [] });
        const data = groups.get(key).server_data;
        const episodeSlug = slug(episode.slug);
        if (data.some(item => item.slug === episodeSlug)) throw invalid('Slug tập bị trùng trong cùng server.');
        data.push({ name: text(episode.name, 100, true), slug: episodeSlug, link_embed: embed, link_m3u8: hls });
    }
    const tags = value => list(value).map(name => ({ name, slug: name.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other' }));
    return {
        title: text(body.title, 200, true), slug: slug(body.slug), origin_name: text(body.origin_name),
        overview: text(body.overview, 10000), year: year ? Number(year) : null,
        type: choice(body.type, ['single', 'series', 'hoathinh', 'tvshows']),
        status: choice(body.status, ['completed', 'ongoing', 'trailer']),
        poster_url: url(body.poster_url), backdrop_url: url(body.backdrop_url), trailer_url: url(body.trailer_url),
        time: text(body.time, 60), quality: text(body.quality, 20), lang: text(body.lang, 60),
        episode_current: text(body.episode_current, 60), episode_total: text(body.episode_total, 20),
        actor: list(body.actor), director: list(body.director), genres: tags(body.genres), countries: tags(body.countries),
        isVip: choice(body.isVip, ['true', 'false']) === 'true',
        isPublished: choice(body.isPublished, ['true', 'false']) === 'true',
        danh_sach_server: [...groups.values()]
    };
}

module.exports = { text, choice, url, movieInput };
