document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-confirm]').forEach(form => {
        form.addEventListener('submit', event => {
            if (!window.confirm(form.dataset.confirm)) event.preventDefault();
        });
    });
    const form = document.getElementById('movie-form');
    if (!form) return;
    let uploads = 0;
    const submit = form.querySelector('button[type="submit"]');
    document.querySelectorAll('[data-upload]').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files[0];
            const status = input.closest('.image-field').querySelector('.upload-status');
            if (!file) return;
            if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                status.textContent = 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 5 MB.';
                input.value = '';
                return;
            }
            uploads++;
            input.disabled = true;
            submit.disabled = true;
            status.textContent = 'Đang tải ảnh…';
            try {
                const response = await fetch('/admin/upload', {
                    method: 'POST', headers: { 'Content-Type': file.type, 'X-CSRF-Token': form.elements._csrf.value }, body: file
                });
                if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Không tải được ảnh. Kiểm tra phiên đăng nhập và thử lại.');
                const result = await response.json();
                document.getElementById(input.dataset.upload).value = result.url;
                status.textContent = 'Đã tải ảnh. Lưu phim để áp dụng.';
            } catch (error) {
                status.textContent = error.message;
            } finally {
                uploads--;
                input.disabled = false;
                submit.disabled = uploads > 0;
                input.value = '';
            }
        });
    });
    const episodes = document.getElementById('episodes');
    const renumber = () => episodes.querySelectorAll('.episode').forEach((row, index) => {
        row.querySelector('legend').textContent = `Tập phim ${index + 1}`;
        row.querySelectorAll('[data-key]').forEach(field => { field.name = `episodes[${index}][${field.dataset.key}]`; });
    });
    document.getElementById('add-episode').addEventListener('click', () => {
        if (episodes.children.length >= 100) {
            document.getElementById('episode-status').textContent = 'Đã đạt giới hạn 100 tập.';
            return;
        }
        episodes.appendChild(document.getElementById('episode-template').content.cloneNode(true));
        renumber();
        episodes.lastElementChild.querySelector('input').focus();
    });
    episodes.addEventListener('click', event => {
        const button = event.target.closest('.remove-episode');
        if (!button || !window.confirm('Bỏ tập khỏi form? Thay đổi chỉ áp dụng sau khi lưu phim.')) return;
        button.closest('.episode').remove();
        renumber();
        document.getElementById('add-episode').focus();
    });
    renumber();
});
