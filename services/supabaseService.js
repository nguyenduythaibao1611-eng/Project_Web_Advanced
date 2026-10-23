const axios = require('axios');
const path = require('path');
const supabase = require('../config/supabase');

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'cineverse-movies';

/**
 * 1. Kiểm tra kết nối Supabase Storage và danh sách Bucket
 */
const checkStorageHealth = async () => {
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
            throw error;
        }
        const exists = data.some((b) => b.name === BUCKET_NAME);
        return {
            connected: true,
            bucketExists: exists,
            buckets: data.map((b) => b.name)
        };
    } catch (err) {
        return {
            connected: false,
            bucketExists: false,
            error: err.message
        };
    }
};

/**
 * 2. Lấy URL Public của một file trong Bucket
 * @param {string} filePath - Đường dẫn file trong bucket (VD: 'posters/avatar.jpg')
 * @returns {string} - Link public CDN của ảnh
 */
const getPublicUrl = (filePath) => {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
};

/**
 * 3. Tải ảnh từ URL bên ngoài (OPhim / TMDB) và upload thẳng lên Supabase Storage
 * @param {string} imageUrl - URL ảnh gốc (VD: link ảnh từ OPhim)
 * @param {string} destinationFileName - Tên file muốn lưu (VD: 'iron-man-poster.jpg')
 * @param {string} folder - Thư mục trên storage ('posters' | 'backdrops')
 * @returns {Promise<string>} - Đường link public mới trên Supabase Storage
 */
const uploadImageFromUrl = async (imageUrl, destinationFileName, folder = 'posters') => {
    if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Đường dẫn ảnh nguồn (imageUrl) không hợp lệ');
    }

    try {
        // Tải ảnh về dạng binary Buffer
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const ext = path.extname(destinationFileName) || (contentType.includes('png') ? '.png' : '.jpg');
        const cleanName = destinationFileName.replace(/\.[^/.]+$/, '') + ext;
        const filePath = `${folder}/${cleanName}`;

        // Đẩy lên Supabase Storage
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType,
                upsert: true
            });

        if (error) {
            throw error;
        }

        return getPublicUrl(filePath);
    } catch (err) {
        console.error(`[Supabase Storage] Lỗi tải & upload ảnh từ "${imageUrl}":`, err.message);
        throw err;
    }
};

/**
 * 4. Upload ảnh trực tiếp từ Buffer (dùng cho upload từ trang Admin)
 * @param {Buffer} buffer - Dữ liệu nhị phân của file
 * @param {string} fileName - Tên file
 * @param {string} mimeType - Định dạng mime (image/jpeg, image/png...)
 * @param {string} folder - Thư mục ('posters' | 'backdrops')
 * @returns {Promise<string>} - Đường link public mới
 */
const uploadImageBuffer = async (buffer, fileName, mimeType, folder = 'posters') => {
    try {
        const filePath = `${folder}/${fileName}`;
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: mimeType || 'image/jpeg',
                upsert: true
            });

        if (error) {
            throw error;
        }

        return getPublicUrl(filePath);
    } catch (err) {
        console.error(`[Supabase Storage] Lỗi upload buffer "${fileName}":`, err.message);
        throw err;
    }
};

module.exports = {
    checkStorageHealth,
    getPublicUrl,
    uploadImageFromUrl,
    uploadImageBuffer,
    BUCKET_NAME
};
