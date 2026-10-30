/**
 * onboarding.js - Quản lý tương tác chọn thể loại phim (Phase 3 Onboarding)
 */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('onboardingForm');
    const checkboxes = document.querySelectorAll('.genre-checkbox');
    const counterEl = document.getElementById('selectedCounter');
    const hintEl = document.getElementById('onboardingHint');
    const submitBtn = document.getElementById('btnStartDiscover');

    if (!form || !checkboxes.length) {
        return;
    }

    const MIN_REQUIRED = 3;
    const MAX_ALLOWED = 5;

    /**
     * Hiển thị thông báo nhanh (Toast) nếu có toastContainer từ main layout
     */
    function showNotification(message, type) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast-item ${type === 'error' ? 'toast-error' : 'toast-info'}`;
        toast.style.cssText = 'padding: 12px 18px; margin-top: 8px; border-radius: 8px; background: #1e1e2d; border: 1px solid #ffb547; color: #fff; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; animation: fadeIn 0.3s ease;';
        toast.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'triangle-exclamation' : 'circle-check'}"></i> <span>${message}</span>`;

        toastContainer.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s ease';
            setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400);
        }, 3000);
    }

    /**
     * Đếm số lượng thể loại đang được tích chọn
     */
    function getCheckedBoxes() {
        return Array.from(checkboxes).filter(function (cb) {
            return cb.checked;
        });
    }

    /**
     * Cập nhật giao diện trạng thái, bộ đếm và nút bấm
     */
    function updateUIState() {
        const checkedList = getCheckedBoxes();
        const count = checkedList.length;

        if (counterEl) {
            counterEl.textContent = count;
        }

        if (hintEl) {
            if (count < MIN_REQUIRED) {
                const remaining = MIN_REQUIRED - count;
                hintEl.className = 'onboarding-hint warning';
                hintEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Hãy chọn thêm ít nhất <strong>${remaining}</strong> thể loại nữa`;
            } else if (count === MAX_ALLOWED) {
                hintEl.className = 'onboarding-hint maxed';
                hintEl.innerHTML = '<i class="fa-solid fa-star"></i> Đã chọn tối đa 5 thể loại. Sẵn sàng bắt đầu!';
            } else {
                hintEl.className = 'onboarding-hint ready';
                hintEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Tuyệt vời! Bạn có thể chọn thêm hoặc bắt đầu ngay';
            }
        }

        if (submitBtn) {
            const isValid = count >= MIN_REQUIRED && count <= MAX_ALLOWED;
            submitBtn.disabled = !isValid;
            if (isValid) {
                submitBtn.classList.add('is-ready');
            } else {
                submitBtn.classList.remove('is-ready');
            }
        }
    }

    // Gắn sự kiện thay đổi cho từng checkbox & click thẻ card
    checkboxes.forEach(function (checkbox) {
        const card = checkbox.closest('.onboarding-genre-card');

        checkbox.addEventListener('change', function () {
            const currentChecked = getCheckedBoxes();

            if (checkbox.checked && currentChecked.length > MAX_ALLOWED) {
                checkbox.checked = false;
                if (card) {
                    card.classList.remove('is-selected');
                }
                showNotification(`Bạn chỉ có thể chọn tối đa ${MAX_ALLOWED} thể loại phim.`, 'error');
                updateUIState();
                return;
            }

            if (card) {
                if (checkbox.checked) {
                    card.classList.add('is-selected');
                } else {
                    card.classList.remove('is-selected');
                }
            }

            updateUIState();
        });
    });

    // Kiểm tra tính hợp lệ trước khi submit form
    form.addEventListener('submit', function (event) {
        const checkedCount = getCheckedBoxes().length;
        if (checkedCount < MIN_REQUIRED || checkedCount > MAX_ALLOWED) {
            event.preventDefault();
            showNotification(`Vui lòng chọn từ ${MIN_REQUIRED} đến ${MAX_ALLOWED} thể loại phim yêu thích.`, 'error');
        }
    });

    // Khởi tạo trạng thái ban đầu
    updateUIState();
});
