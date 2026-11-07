/**
 * paymentModal.js - Điều khiển Popup Thanh Toán VietQR & Tự Động Kích Hoạt VIP
 */

let currentOrderCode = null;
let paymentPollingTimer = null;
let paymentCountdownTimer = null;
let successRedirectTimer = null;
let pendingCountdownTimer = null;

/**
 * Mở Modal thanh toán VietQR
 * @param {string} [planCode] - Mã gói VIP đã chọn (VD: 'vip_1m')
 */
window.openPaymentModal = async function (planCode) {
    const overlay = document.getElementById('paymentModalOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');

    // Dọn dẹp các timer cũ nếu có
    clearInterval(paymentPollingTimer);
    clearInterval(paymentCountdownTimer);

    if (planCode) {
        await initiateOrder(planCode);
    } else {
        await loadPlansSelection();
    }
};

/**
 * Đóng Modal thanh toán
 */
window.dismissPendingAlert = function () {
    clearInterval(pendingCountdownTimer);
    const alertBox = document.getElementById('paymentPendingAlert');
    if (alertBox) alertBox.style.display = 'none';
};

window.closePaymentModal = function (isCompleted) {
    const overlay = document.getElementById('paymentModalOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
    }

    clearInterval(paymentPollingTimer);
    clearInterval(paymentCountdownTimer);
    clearInterval(successRedirectTimer);
    window.dismissPendingAlert();

    if (isCompleted) {
        // Bắn sự kiện thông báo toàn trang rằng VIP đã được kích hoạt
        window.dispatchEvent(new CustomEvent('vipUpgraded', { detail: { isVip: true } }));
        // Cập nhật giao diện nếu có player đang mở
        if (typeof window.onVipUpgradeSuccess === 'function') {
            window.onVipUpgradeSuccess();
        }
    }
};

/**
 * Sao chép văn bản vào Clipboard
 */
window.copyText = function (elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text.trim()).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #34d399;"></i>';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 1500);
    }).catch(() => {
        // Fallback
    });
};

/**
 * Tải danh sách gói nếu người dùng chưa chọn gói trước
 */
async function loadPlansSelection() {
    showStep('paymentStepSelect');
    const container = document.getElementById('paymentPlansList');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải gói cước...</div>';

    try {
        const res = await fetch('/api/payment/plans');
        const data = await res.json();
        if (data.success && data.plans && data.plans.length > 0) {
            container.innerHTML = data.plans.map(p => `
                <div class="payment-plan-choice ${p.isPopular ? 'popular' : ''}" onclick="window.openPaymentModal('${p.code}')">
                    <div class="choice-left">
                        <strong>${p.name}</strong>
                        <small>${p.durationDays} ngày · ${p.description || ''}</small>
                    </div>
                    <div class="choice-right">
                        <strong class="text-gold">${Number(p.price).toLocaleString('vi-VN')} đ</strong>
                        ${p.badge ? `<span class="choice-badge">${p.badge}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
    } catch (_err) {
        container.innerHTML = '<div style="color: #ef4444; padding: 10px;">Không thể tải gói cước. Vui lòng thử lại.</div>';
    }
}

/**
 * Gọi API khởi tạo đơn hàng và hiển thị mã VietQR
 */
async function initiateOrder(planCode) {
    showStep('paymentStepQR');
    window.dismissPendingAlert();
    const btnCheck = document.getElementById('btnCheckPayment');
    if (btnCheck) {
        btnCheck.disabled = false;
        btnCheck.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Kiểm tra thanh toán';
    }

    const spinner = document.getElementById('qrLoadingSpinner');
    const qrImg = document.getElementById('qrCodeImg');
    if (spinner) spinner.style.display = 'flex';
    if (qrImg) qrImg.style.display = 'none';

    try {
        const res = await fetch('/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planCode })
        });

        if (res.status === 401) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            return;
        }

        const data = await res.json();
        if (!data.success) {
            alert(data.message || 'Không thể tạo đơn hàng.');
            window.closePaymentModal();
            return;
        }

        const order = data.order;
        const bank = data.bankInfo;
        currentOrderCode = order.orderCode;

        // Cập nhật thông tin lên màn hình
        document.getElementById('modalPlanName').textContent = `${order.planName} (${order.durationDays} ngày)`;
        document.getElementById('modalAmountDisplay').textContent = `${Number(order.amount).toLocaleString('vi-VN')} đ`;
        document.getElementById('modalBankId').textContent = bank.bankId;
        document.getElementById('modalBankAccount').textContent = bank.bankAccount;
        document.getElementById('modalAccountName').textContent = bank.bankAccountName;
        document.getElementById('modalTransferContent').textContent = order.transferContent;

        // Tải ảnh QR Code
        if (qrImg) {
            qrImg.src = order.qrCodeUrl;
            qrImg.onload = function () {
                if (spinner) spinner.style.display = 'none';
                qrImg.style.display = 'block';
            };
        }

        // Bắt đầu đếm ngược 15 phút
        startCountdown(new Date(order.expiresAt));

        // Bắt đầu Polling tự động kiểm tra trạng thái mỗi 2 giây
        startPolling(order.orderCode);
    } catch (err) {
        console.error('Lỗi khi tạo đơn hàng:', err);
        alert('Đã có lỗi xảy ra. Vui lòng thử lại.');
        window.closePaymentModal();
    }
}

/**
 * Đếm ngược thời gian thanh toán
 */
function startCountdown(expiresAt) {
    const timerEl = document.getElementById('qrTimer');
    clearInterval(paymentCountdownTimer);

    paymentCountdownTimer = setInterval(function () {
        const now = new Date().getTime();
        const distance = expiresAt.getTime() - now;

        if (distance <= 0) {
            clearInterval(paymentCountdownTimer);
            clearInterval(paymentPollingTimer);
            if (timerEl) timerEl.textContent = '00:00 (Hết hạn)';
            alert('Mã thanh toán này đã hết hạn. Vui lòng tạo lại đơn hàng mới.');
            window.closePaymentModal();
            return;
        }

        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        if (timerEl) {
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

/**
 * Thăm dò (Polling) trạng thái thanh toán từ Server
 */
function startPolling(orderCode) {
    clearInterval(paymentPollingTimer);

    paymentPollingTimer = setInterval(async function () {
        try {
            const res = await fetch(`/api/payment/check-status/${orderCode}`);
            const data = await res.json();

            if (data.success && data.isCompleted) {
                // ĐÃ THANH TOÁN THÀNH CÔNG!
                clearInterval(paymentPollingTimer);
                clearInterval(paymentCountdownTimer);
                onPaymentSuccess();
            }
        } catch (_err) {
            // Lỗi mạng tạm thời, tiếp tục thử lại
        }
    }, 2000);
}

function showPendingAlert() {
    const alertBox = document.getElementById('paymentPendingAlert');
    const timerText = document.getElementById('pendingTimerText');
    if (!alertBox) return;

    alertBox.style.display = 'block';
    let timeLeft = 5;
    if (timerText) timerText.textContent = `${timeLeft}s`;

    clearInterval(pendingCountdownTimer);
    pendingCountdownTimer = setInterval(() => {
        timeLeft -= 1;
        if (timerText) timerText.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
            window.dismissPendingAlert();
        }
    }, 1000);
}

/**
 * Xử lý khi thanh toán thành công
 */
function onPaymentSuccess() {
    showStep('paymentStepSuccess');

    clearInterval(paymentPollingTimer);
    clearInterval(paymentCountdownTimer);
    window.dismissPendingAlert();

    // Thêm huy hiệu VIP vào thanh Header ngay lập tức
    const avatarRing = document.getElementById('userAvatarBtn');
    if (avatarRing && !document.getElementById('headerVipBadge')) {
        const crown = document.createElement('span');
        crown.id = 'headerVipBadge';
        crown.className = 'header-vip-badge';
        crown.innerHTML = '<i class="fa-solid fa-crown"></i> VIP';
        avatarRing.parentNode.insertBefore(crown, avatarRing);
    }

    // Bắn sự kiện thông báo VIP đã kích hoạt
    window.dispatchEvent(new CustomEvent('vipUpgraded', { detail: { isVip: true } }));

    // Bắn thông báo Toast
    if (typeof window.showToast === 'function') {
        window.showToast('Chúc mừng! Gói VIP của bạn đã được kích hoạt thành công.', 'success');
    }

    // Tự động đếm lùi 5 giây rồi về trang chính
    let redirectSeconds = 5;
    const timerEl = document.getElementById('successRedirectTimer');
    if (timerEl) timerEl.textContent = redirectSeconds;

    clearInterval(successRedirectTimer);
    successRedirectTimer = setInterval(() => {
        redirectSeconds -= 1;
        if (timerEl) timerEl.textContent = redirectSeconds;
        if (redirectSeconds <= 0) {
            clearInterval(successRedirectTimer);
            window.location.href = '/';
        }
    }, 1000);
}

/**
 * Chuyển đổi hiển thị giữa các bước trong Modal
 */
function showStep(stepId) {
    ['paymentStepSelect', 'paymentStepQR', 'paymentStepSuccess'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === stepId) ? 'block' : 'none';
    });
}

// Xử lý nút Kiểm tra thanh toán
document.addEventListener('DOMContentLoaded', function () {
    const btnCheck = document.getElementById('btnCheckPayment');
    if (btnCheck) {
        btnCheck.addEventListener('click', async function () {
            if (!currentOrderCode) return;

            btnCheck.disabled = true;
            btnCheck.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra...';

            try {
                const res = await fetch(`/api/payment/check-status/${currentOrderCode}`);
                const data = await res.json();

                if (data.success && data.isCompleted) {
                    onPaymentSuccess();
                } else {
                    // Chưa nhận được thanh toán
                    showPendingAlert();
                    btnCheck.disabled = false;
                    btnCheck.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Kiểm tra thanh toán';
                }
            } catch (err) {
                console.error('Lỗi khi kiểm tra thanh toán:', err);
                showPendingAlert();
                btnCheck.disabled = false;
                btnCheck.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Kiểm tra thanh toán';
            }
        });
    }
});
