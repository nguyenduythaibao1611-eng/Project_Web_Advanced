# 🎬 CINEVERSE — Nền Tảng Trực Tuyến Điện Ảnh Đỉnh Cao (Full Documentation & Technical Manual)

> **CineVerse** là nền tảng streaming phim điện ảnh trực tuyến chuẩn quốc tế (lấy cảm hứng từ Disney+ và Marvel Studios). Dự án được xây dựng theo kiến trúc **MVC-Service**, tích hợp tổng hợp dữ liệu từ nhiều nguồn API (TMDB, OPhim, VidSrc), quản lý người dùng với JWT Cookie HttpOnly, bảo mật phiên 1 tài khoản/1 thiết bị, lưu trữ ảnh media trên **Supabase Cloud Storage**, cơ sở dữ liệu phân tán trên **MongoDB Atlas**, trình phát luồng **HLS.js**, cơ chế **Freemium VIP Paywall**, **Lịch sử xem dở**, và hệ thống **Admin Dashboard**.

---

## 📑 MỤC LỤC TRA CỨU NHANH
1. [Kiến trúc Hệ thống & Luồng Dữ liệu (MVC-S)](#1-kiến-trúc-hệ-thống--luồng-dữ-liệu-mvc-s)
2. [Bản đồ Cấu trúc Thư mục & Trách nhiệm Code](#2-bản-đồ-cấu-trúc-thư-mục--trách-nhiệm-code)
3. [Bản Đồ Giao Diện Trực Quan (Screen-to-Code Mapping)](#3-bản-đồ-giao-diện-trực-quan-screen-to-code-mapping)
4. [Các Phân Hệ Kỹ Thuật Trọng Tâm](#4-các-phân-hệ-kỹ-thuật-trọng-tâm)
   - [4.1. Hệ thống Streaming Đa Server HLS.js & Iframe Fallback](#41-hệ-thống-streaming-đa-server-hlsjs--iframe-fallback)
   - [4.2. Cơ chế Freemium & Giới hạn 5 phút cho User Free (VIP Paywall)](#42-cơ-chế-freemium--giới-hạn-5-phút-cho-user-free-vip-paywall)
   - [4.3. Hệ thống Lưu Lịch Sử Xem & Tiếp Tục Xem (Watch History)](#43-hệ-thống-lưu-lịch-sử-xem--tiếp-tục-xem-watch-history)
   - [4.4. Hệ thống Khảo sát Sở thích & Độ tuổi (Onboarding Profile)](#44-hệ-thống-khảo-sát-sở-thích--độ-tuổi-onboarding-profile)
   - [4.5. Phân Hệ Quản Trị Hệ Thống Toàn Diện (Admin Dashboard & CRUD)](#45-phân-hệ-quản-trị-hệ-thống-toàn-diện-admin-dashboard--crud)
   - [4.6. Hệ thống Xác thực, Phân quyền & Giới hạn 1 Thiết Bị](#46-hệ-thống-xác-thực-phân-quyền--giới-hạn-1-thiết-bị)
   - [4.7. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)](#47-hệ-thống-danh-sách-yêu-thích-favorites--optimistic-ui)
   - [4.8. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)](#48-hệ-thống-hero-banner--cơ-chế-chống-giật-anti-jitter)
   - [4.9. Hệ thống Worker Cào Dữ Liệu & Pipeline Đa Nguồn (Supabase Storage)](#49-hệ-thống-worker-cào-dữ-liệu--pipeline-đa-nguồn-supabase-storage)
5. [Cẩm Nang Bắt Bệnh & Khắc Phục Sự Cố (Troubleshooting Matrix)](#5-cẩm-nang-bắt-bệnh--khắc-phục-sự-cố-troubleshooting-matrix)
6. [Hướng dẫn Cài đặt & Khởi chạy Dự án](#6-hướng-dẫn-cài-đặt--khởi-chạy-dự-án)
7. [Quy chuẩn Kiểm thử Tự động & Linting (Testing & Code Quality)](#7-quy-chuẩn-kiểm-thử-tự-động--linting-testing--code-quality)
8. [Phân Công Nhiệm Vụ & Bảng Theo Dõi Tiến Độ (Project Roadmap)](#8-phân-công-nhiệm-vụ--bảng-theo-dõi-tiến-độ-project-roadmap)

---

## 1. KIẾN TRÚC HỆ THỐNG & LUỒNG DỮ LIỆU (MVC-S)

CineVerse vận hành theo mô hình phân lớp phân tán:
**Client (Trình duyệt) ⇄ Routes ⇄ Middlewares ⇄ Controllers ⇄ Services / Models ⇄ Views (EJS Rendering)**

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 CLIENT (Trình duyệt)                  │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTP Request (Cookie, Form, Fetch)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                  APP.JS / ROUTES                       │
                  │  (movieRoutes, favoriteRoutes, authRoutes,             │
                  │   adminRoutes, watchHistoryRoutes)                     │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                    MIDDLEWARES                         │
                  │  - checkUser (giải mã JWT, đối chiếu activeSessionId) │
                  │  - requireAuth (chặn khách, redirect login / 401 JSON) │
                  │  - requireAdmin (chặn user thường, chỉ cho role admin) │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                    CONTROLLERS                         │
                  │  (movieController, authController, favoriteController, │
                  │   adminController, watchHistoryController)             │
                  └─────────────┬───────────────────────────┬──────────────┘
                                │                           │
                 Gọi nghiệp vụ  ▼            Truy vấn DB    ▼
    ┌──────────────────────────────────────┐     ┌────────────────────────┐
    │              SERVICES                │     │         MODELS         │
    │ - tmdbService: Gọi TheMovieDB API    │     │ - movieModel: Schema   │
    │ - ophimService: Dò Vietsub & m3u8    │     │ - userModel: bcrypt    │
    │ - supabaseService: Upload Media CDN  │     │ - favoriteModel: Index │
    │ - dns/db: Public DNS bypass ISP block│     │ - watchHistoryModel    │
    └──────────────────────────────────────┘     └────────────────────────┘
                                │                           │
                                └─────────────┬─────────────┘
                                              │ res.render(view, data) / res.json()
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 VIEWS ENGINE (EJS)                     │
                  │   layouts/main.ejs / admin.ejs ➔ pages/*.ejs           │
                  │   Render HTML kết hợp CSS Design System & Client JS    │
                  └────────────────────────────────────────────────────────┘
```

---

## 2. BẢN ĐỒ CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM CODE

```
cineverse/
├── config/
│   ├── db.js                       # Kết nối MongoDB Atlas kèm Google/Cloudflare DNS bypass
│   └── supabase.js                 # Khởi tạo SDK kết nối Supabase Cloud Storage
│
├── controllers/
│   ├── movieController.js          # Trang chủ, Trang danh sách Movies, Chi tiết phim, Tìm kiếm
│   ├── authController.js           # Đăng ký, Đăng nhập, Đăng xuất, Session 1 thiết bị, Onboarding, Nâng cấp VIP
│   ├── favoriteController.js       # Quản lý Danh sách yêu thích (Render page, API CRUD, Toggle)
│   ├── adminController.js          # Quản trị Admin: Dashboard thống kê, CRUD Phim, Bật/Tắt quyền VIP
│   ├── watchHistoryController.js   # API Lưu tọa độ giây, danh sách xem tiếp, xóa lịch sử
│   └── assistantController.js      # [Khung sườn] Dự phòng cho tính năng Chatbot AI
│
├── middlewares/
│   ├── authMiddleware.js           # checkUser (Session ID), requireAuth, requireAdmin, sanitizeRedirectUrl
│   ├── errorHandler.js             # Bắt lỗi toàn cục
│   └── validateMiddleware.js       # Kiểm tra hợp lệ dữ liệu
│
├── models/
│   ├── movieModel.js               # Schema Phim chuẩn (Text Index search, đa server m3u8 & iframe, soft delete)
│   ├── userModel.js                # Schema User (bcrypt, activeSessionId, role, isVip, preferences, age)
│   ├── favoriteModel.js            # Schema Phim lưu (UserId, MovieId, Title, Poster, Index unique)
│   ├── watchHistoryModel.js        # Schema Lịch sử xem (UserId, MovieId, currentTime, duration, episode)
│   └── chatLogModel.js             # [Khung sườn] Dự phòng lưu nhật ký chat AI
│
├── routes/
│   ├── index.js                    # Tổng hợp toàn bộ các Router con vào 1 đầu mối
│   ├── movieRoutes.js              # GET /, /movies, /movies/:id, /search, /api/search
│   ├── authRoutes.js               # /login, /register, /logout, /onboarding, /api/auth/upgrade-vip
│   ├── favoriteRoutes.js           # GET /favorites, API /api/favorites/*
│   ├── adminRoutes.js              # /admin (Dashboard), /admin/users (Cấp VIP), /admin/movies (CRUD Phim)
│   ├── watchHistoryRoutes.js       # API /api/history (Lưu tọa độ, lấy danh sách xem dở)
│   └── assistantRoutes.js          # [Khung sườn] Định tuyến cho trợ lý ảo
│
├── scripts/
│   ├── crawlMovies.js              # Worker tự động cào phim từ OPhim, upload ảnh Supabase & ghép VidSrc
│   └── makeAdmin.js                # Công cụ dòng lệnh cấp quyền Admin cho tài khoản bất kỳ
│
├── services/
│   ├── tmdbService.js              # TMDB API: Phim hot, danh mục phim phân trang, search suggestions, logo PNG
│   ├── ophimService.js             # OPhim API: Tìm phim, bóc tách link m3u8, lấy danh sách phân trang
│   ├── supabaseService.js          # Upload ảnh tự động lên Supabase Storage CDN (uploadImageFromUrl)
│   └── geminiService.js            # [Khung sườn] Gọi Gemini AI gợi ý phim
│
├── tests/                          # BỘ KIỂM THỬ TỰ ĐỘNG CHUẨN NODE.JS TEST RUNNER (35 TESTS)
│   ├── admin.test.js               # 11 tests: Phân quyền admin, dashboard, CRUD phim, switch toggle VIP
│   ├── onboarding.test.js          # 10 tests: Form khảo sát sở thích 3-5 thể loại, độ tuổi, cập nhật user
│   ├── watchHistoryAndVip.test.js  # 4 tests: HLS Player render, API lưu lịch sử xem, nâng cấp VIP
│   ├── movies.test.js              # 4 tests: Trang danh sách Movies, lọc thể loại, phân trang
│   └── search.test.js              # 6 tests: Thanh tìm kiếm, live suggestions dropdown, escape ký tự
│
├── views/                          # TOÀN BỘ GIAO DIỆN (SERVER-SIDE RENDERING EJS)
│   ├── layouts/
│   │   ├── main.ejs                # Khung HTML giao diện người xem chính
│   │   └── admin.ejs               # Khung HTML Bảng điều khiển Quản trị viên
│   ├── partials/
│   │   ├── header.ejs              # Navbar: Logo, Menu, Khung Search thông minh, Chuông, Avatar
│   │   ├── footer.ejs              # Chân trang thông tin & liên kết
│   │   ├── movieCard.ejs           # Component thẻ phim chuẩn điện ảnh
│   │   ├── aiModal.ejs             # Hộp thoại popup trợ lý AI
│   │   └── trailerModal.ejs        # Popup phát trailer phim
│   └── pages/
│       ├── index.ejs               # TRANG CHỦ: Hero Slider, Hàng "Tiếp tục xem", Top 10, Thể loại
│       ├── movieDetail.ejs         # CHI TIẾT PHIM: Trình phát HLS.js, nút chọn server, popup VIP 5 phút
│       ├── movies.ejs              # DANH SÁCH PHIM: Duyệt phim theo 8 thể loại, phân trang
│       ├── search.ejs              # TÌM KIẾM: Kết quả tìm kiếm mở rộng kèm phân trang
│       ├── favorites.ejs           # MY LIST: Lưới hiển thị các phim đã lưu bookmark
│       ├── onboarding.ejs          # ONBOARDING: Khảo sát chọn 3-5 thể loại yêu thích & độ tuổi
│       ├── login.ejs               # ĐĂNG NHẬP: Form tài khoản/email, mật khẩu, báo lỗi
│       ├── register.ejs            # ĐĂNG KÝ: Tạo tài khoản mới, tự chuyển sang Onboarding
│       ├── error.ejs               # Báo lỗi 404/500
│       └── admin/
│           ├── dashboard.ejs       # BẢNG ĐIỀU KHIỂN: 3 thẻ thống kê (Phim, User, VIP), lối tắt
│           ├── users/index.ejs     # QUẢN LÝ USER: Danh sách thành viên, Switch Toggle VIP tức thì
│           └── movies/
│               ├── index.ejs       # QUẢN LÝ PHIM: Bảng phim, tìm kiếm, phân trang, nút Sửa/Xóa
│               └── form.ejs        # FORM PHIM: Thêm mới & Chỉnh sửa thông số, link m3u8, iframe
│
├── public/                         # TÀI NGUYÊN TĨNH PHÍA TRÌNH DUYỆT (CLIENT-SIDE)
│   ├── css/
│   │   ├── style.css               # Design System Streaming: Theme tối, Glassmorphism, VIP Modal, Player
│   │   └── admin.css               # Giao diện Bảng điều khiển Quản trị hiện đại
│   └── js/
│       ├── ui-interactions.js      # Điều khiển slider, live search suggestions panel
│       ├── favorite.js             # Xử lý Bookmark với Optimistic UI
│       ├── onboarding.js           # Chọn chips thể loại (3-5 mục), validate form onboarding
│       └── admin.js                # Xử lý AJAX toggle VIP, xác nhận xóa phim an toàn
│
├── local-docs/                     # Tài liệu kỹ thuật nội bộ nhóm phát triển
│   ├── Luong-API.md                # Tài liệu phân tích luồng gọi API
│   └── Kien-Truc-Worker-Crawl-Du-Lieu.md # Cẩm nang vận hành Worker cào phim, cấu trúc đa server & CDN ảnh
│
├── .env                            # Chứa biến môi trường bí mật (không commit lên GitHub)
├── .env.example                    # File mẫu hướng dẫn khai báo biến môi trường cho thành viên
├── eslint.config.mjs               # Cấu hình kiểm tra cú pháp ESLint cho cả Node.js và Client Browser
├── server.js                       # Khởi chạy server, kết nối MongoDB Atlas
├── app.js                          # Cấu hình Express, View engine, Cookie parser, nạp dotenv tự động
└── package.json                    # Khai báo thư viện và scripts (dev, start, test, lint, crawl)
```

---

## 3. BẢN ĐỒ GIAO DIỆN TRỰC QUAN (SCREEN-TO-CODE MAPPING)

| Giao diện / Chức năng | Đường dẫn URL | File View phụ trách | File CSS / JS xử lý | Controller / Middleware |
| :--- | :--- | :--- | :--- | :--- |
| **Trang chủ & Tiếp tục xem** | `/` | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs) | [`style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) / [`ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) | [`movieController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/movieController.js) + [`watchHistoryModel.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/models/watchHistoryModel.js) |
| **Danh mục Phim** | `/movies` | [`views/pages/movies.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movies.ejs) | `style.css` (`.movies-hero`, `.movies-genre`) | `movieController.getMovieList` |
| **Khung Tìm kiếm & Suggestions** | Header & `/search` | [`views/pages/search.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/search.ejs) | [`header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs) + `ui-interactions.js` | `movieController.search` & `searchSuggestions` |
| **Player HLS & Popup VIP 5 phút** | `/movies/:id` | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs) | `style.css` (`.vip-paywall-modal`, `#hlsPlayer`) | `movieController.getMovieDetail` |
| **Màn hình Onboarding** | `/onboarding` | [`views/pages/onboarding.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/onboarding.ejs) | `style.css` + [`onboarding.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/onboarding.js) | `authController.getOnboardingPage` + `postOnboarding` |
| **Dashboard Quản trị** | `/admin` | [`views/pages/admin/dashboard.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/admin/dashboard.ejs) | [`admin.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/admin.css) + [`admin.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/layouts/admin.ejs) | `adminController.getDashboard` (`requireAdmin`) |
| **Quản lý User & Cấp VIP** | `/admin/users` | [`views/pages/admin/users/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/admin/users/index.ejs) | `admin.css` + [`admin.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/admin.js) | `adminController.getUsers` + `toggleUserVip` |
| **Quản lý Phim CRUD** | `/admin/movies` | [`views/pages/admin/movies/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/admin/movies/index.ejs) & `form.ejs` | `admin.css` + `admin.js` | `adminController` (`create`, `edit`, `delete`) |
| **Danh sách Yêu thích** | `/favorites` | [`views/pages/favorites.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/favorites.ejs) | [`favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js) | `favoriteController` (`requireAuth`) |

---

## 4. CÁC PHÂN HỆ KỸ THUẬT TRỌNG TÂM

### 4.1. Hệ thống Streaming Đa Server HLS.js & Iframe Fallback
- **Trình phát HLS.js:** Nhúng thư viện `hls.js` qua CDN. Trình duyệt tự động gắn thẻ `<video id="hlsPlayer">` để phát mượt mà link stream `.m3u8` chất lượng cao với buffer thích ứng (Adaptive Bitrate).
- **Chuyển đổi Server không tải lại trang:**
  - **Server 1 · OPhim VIP (HLS):** Ưu tiên phát link m3u8 bản quyền cao cấp.
  - **Server 2 · Bản gốc (VidSrc Iframe):** Tự động chuyển đổi sang iframe khi người xem bấm nút hoặc khi nguồn m3u8 có sự cố.

### 4.2. Cơ chế Freemium & Giới hạn 5 phút cho User Free (VIP Paywall)
- **Kiểm tra quyền hạn:** Trình phát kiểm tra cờ `user.isVip` được nạp từ database.
- **Tự động ngắt phát sau 5 phút:**
  - Đối với tài khoản chưa nâng cấp VIP (`isVip: false`), trình phát lắng nghe sự kiện `timeupdate`. Khi `video.currentTime >= 300` giây (5 phút), video sẽ tự động tạm dừng (`pause()`).
  - Chặn người dùng tua thanh tiến trình qua mốc 300s.
  - Hiển thị **Popup VIP Paywall** với lời mời nâng cấp và nút bấm kích hoạt gói VIP tức thì qua API `POST /api/auth/upgrade-vip`.

### 4.3. Hệ thống Lưu Lịch Sử Xem & Tiếp Tục Xem (Watch History)
- **Tự động đồng bộ tiến độ:** Cứ mỗi 10 giây khi đang xem, hoặc khi nhấn tạm dừng/rời trang, trình duyệt tự động gửi tiến độ xem về server qua API `POST /api/history` (`movieId`, `currentTime`, `duration`, `episode`).
- **Tự động tua tiếp (Auto-Resume):** Khi người xem mở lại phim cũ, player đọc lịch sử và tự động tua tiếp tới vị trí giây đã xem dở.
- **Hàng "Tiếp tục xem" (Continue Watching):** Trang chủ tự động hiển thị hàng phim người dùng đang xem dở kèm thanh tiến độ phần trăm (`progress bar`) trực quan.

### 4.4. Hệ thống Khảo sát Sở thích & Độ tuổi (Onboarding Profile)
- **Luồng kích hoạt:** Ngay sau khi người dùng đăng ký tài khoản thành công, hệ thống tự động điều hướng sang trang `/onboarding`.
- **Ràng buộc dữ liệu:** Người dùng bắt buộc chọn từ **3 đến 5 thể loại phim yêu thích** (chips selection) và điền độ tuổi hợp lệ (6 - 120 tuổi). Dữ liệu này được lưu vào trường `preferences` và `age` trong [`models/userModel.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/models/userModel.js) làm dữ liệu nền tảng cho thuật toán AI gợi ý.

### 4.5. Phân Hệ Quản Trị Hệ Thống Toàn Diện (Admin Dashboard & CRUD)
- **Bảo mật tuyệt đối:** Toàn bộ route `/admin/*` được bảo vệ bởi middleware kép `requireAuth` + `requireAdmin`. Tài khoản không có `role: 'admin'` sẽ bị chặn với mã lỗi `403 Forbidden`.
- **Thống kê thời gian thực:** Dashboard `/admin` hiển thị 3 chỉ số then chốt: Tổng số phim, Tổng số thành viên, và Tổng số tài khoản VIP.
- **Bật/Tắt VIP theo thời gian thực:** Trang `/admin/users` cung cấp nút gạt **Switch Toggle VIP** gửi API `POST /admin/users/:id/toggle-vip`, cập nhật trạng thái người dùng trong DB tức thì mà không cần F5 trang.
- **Quản lý phim CRUD:** Bảng danh sách phim `/admin/movies` hỗ trợ tìm kiếm, phân trang; Form thêm mới `/admin/movies/create`; Form chỉnh sửa `/admin/movies/:id/edit`; và cơ chế xóa an toàn (Soft Delete `isDeleted: true`).
- **Kịch bản cấp quyền Admin nhanh:**
  ```bash
  node scripts/makeAdmin.js <username>
  ```

### 4.6. Hệ thống Xác thực, Phân quyền & Giới hạn 1 Thiết Bị
- **Mật khẩu an toàn:** Băm bằng `bcryptjs` với salt 10, tự động ẩn khi xuất JSON.
- **Token JWT HttpOnly:** Lưu trữ trong cookie `cineverse_token` với cờ `httpOnly: true` và `sameSite: 'lax'`.
- **Giới hạn 1 thiết bị/1 tài khoản:** Khi đăng nhập/đăng ký, hệ thống sinh ngẫu nhiên `sessionId = crypto.randomUUID()` lưu vào `User.activeSessionId` và nhúng vào JWT. Nếu tài khoản đăng nhập trên máy mới, `activeSessionId` bị thay thế khiến máy cũ bị đá phiên đăng nhập ngay lập tức (`SESSION_REPLACED`).

### 4.7. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)
- Cơ sở dữ liệu MongoDB lưu `userId` và `movieId` kèm Compound Unique Index.
- Trải nghiệm Optimistic UI: Đổi trạng thái biểu tượng tức thì trước khi API mạng phản hồi, tự động hoàn tác nếu mất kết nối hoặc hết phiên đăng nhập.

### 4.8. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)
- Ép GPU render bằng `will-change: transform` và `transform: scaleX(0)`.
- Chế độ Pause/Resume tính toán thời gian `remaining`, không gây nảy chữ và giật slide khi rê chuột.

### 4.9. Hệ thống Worker Cào Dữ Liệu & Pipeline Đa Nguồn (Supabase Storage)
- Tự động cào dữ liệu từ OPhim, tải ảnh binary đẩy lên bucket `cineverse-movies` của Supabase CDN để chống lỗi "chết ảnh", ghép nối iframe VidSrc và lưu vào MongoDB Atlas.

---

## 5. CẨM NANG BẮT BỆNH & KHẮC PHỤC SỰ CỐ (TROUBLESHOOTING MATRIX)

| Triệu chứng nhìn thấy (Symptom) | Nguyên nhân cốt lõi (Root Cause) | File liên quan | Cách xử lý dứt điểm |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas báo lỗi `querySrv ECONNREFUSED`** | DNS router nhà mạng Việt Nam (Viettel/VNPT/FPT) chặn bản ghi SRV của Atlas. | [`config/db.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/config/db.js) | Đã tự động tích hợp `dns.setServers(['8.8.8.8', '1.1.1.1'])` ngay trước khi kết nối MongoDB. |
| **Trang web không tải được phim, màn hình trống** | Mất file `.env` hoặc chưa nạp `dotenv` ở đầu file. | [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env) & [`app.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/app.js) | Khôi phục `.env` từ `.env.backup` và đảm bảo dòng đầu `app.js` có `require('dotenv').config()`. |
| **Không truy cập được trang `/admin` (báo 403 Forbidden)** | Tài khoản hiện tại có `role: 'user'` thay vì `'admin'`. | [`middlewares/authMiddleware.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js) | Mở terminal chạy lệnh: `node scripts/makeAdmin.js <tên_user_của_bạn>`. |
| **Video dừng sau 5 phút và hiện thông báo VIP** | Cơ chế Paywall của tính năng Freemium dành cho tài khoản chưa nâng cấp VIP. | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs) | Bấm vào nút "Nâng cấp VIP ngay" trên popup hoặc vào Admin gạt VIP cho tài khoản. |
| **Ảnh Poster hoặc Backdrop bị vỡ 403** | Bucket `cineverse-movies` trên Supabase đang ở chế độ Private. | Supabase Console | Vào **Storage -> cineverse-movies**, gạt **Public bucket** sang **ON**. |

---

## 6. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY DỰ ÁN

### Yêu cầu tiên quyết:
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị Node.js v20+ hoặc v22+).
- **MongoDB**: Kết nối MongoDB Atlas Cloud.
- **Supabase**: Bucket Storage tên `cineverse-movies` (chế độ Public).

### Các bước cài đặt:

1. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

2. **Cấu hình file biến môi trường [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env):**
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cineverse?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here
   TMDB_BASE_URL=https://api.themoviedb.org/3
   TMDB_TOKEN=your_tmdb_bearer_token_here
   OPHIM_BASE_URL=https://ophim1.com
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_supabase_secret_key
   SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   SUPABASE_BUCKET=cineverse-movies
   ```

3. **Cào dữ liệu phim mẫu (Tùy chọn):**
   ```bash
   npm run crawl -- --pages=3
   ```

4. **Cấp quyền Admin cho tài khoản của bạn (Nếu cần):**
   ```bash
   node scripts/makeAdmin.js <username>
   ```

5. **Khởi chạy ứng dụng:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt: [http://localhost:5000](http://localhost:5000)

---

## 7. QUY CHUẨN KIỂM THỬ TỰ ĐỘNG & LINTING (TESTING & CODE QUALITY)

### 1. Kiểm thử tự động (Unit & Integration Tests):
Dự án sử dụng trình chạy kiểm thử chuẩn tích hợp sẵn của Node.js (`node:test` và `node:assert/strict`):
```bash
npm test
```
* **Quy mô kiểm thử:** **35 bài test tự động** bao phủ 100% các phân hệ:
  * `tests/admin.test.js`: Phân quyền admin, dashboard, danh sách user, toggle VIP, CRUD phim.
  * `tests/onboarding.test.js`: Quy trình khảo sát sở thích, độ tuổi, validate 3-5 thể loại.
  * `tests/watchHistoryAndVip.test.js`: Render HLS player, lưu tọa độ giây, API nâng cấp VIP.
  * `tests/movies.test.js`: Trang danh mục phim, phân trang, lọc theo thể loại.
  * `tests/search.test.js`: Tìm kiếm realtime, live suggestions, chống ký tự đặc biệt.
* **Tiêu chuẩn:** Luôn đạt **35/35 PASS (100%)**.

### 2. Kiểm tra cú pháp (Linting):
```bash
npm run lint
```
* Áp dụng **ESLint v10 Flat Config** (`eslint.config.mjs`). Đảm bảo luôn đạt **0 errors, 0 warnings**.

---

## 8. PHÂN CÔNG NHIỆM VỤ & BẢNG THEO DÕI TIẾN ĐỘ (PROJECT ROADMAP)

| Phase | Phân Hệ Nhiệm Vụ | Người phụ trách | Trạng thái | Ghi chú hoàn thành |
| :---: | :--- | :---: | :---: | :--- |
| **Phase 1** | Setup MongoDB Atlas, Schema & Supabase Storage | **Bảo** | 🟢 **DONE** | Kết nối Atlas qua Public DNS, Supabase CDN ảnh |
| **Phase 2** | Worker cào phim OPhim, upload ảnh CDN & ghép VidSrc | **Bảo** | 🟢 **DONE** | Cào 48+ phim, đa server m3u8 và iframe |
| **Phase 3** | Xác thực JWT, Session 1 thiết bị & Onboarding Profile | **Nguyên** | 🟢 **DONE** | Đăng ký, đăng nhập, đá phiên cũ, chọn sở thích |
| **Phase 4** | Thanh tìm kiếm, Trang Movies, Player HLS, Lịch sử xem, Giới hạn 5p VIP | **Nam & Bảo** | 🟢 **DONE** | Live search, player HLS.js, paywall 5p, resume xem tiếp |
| **Phase 5** | Thuật toán AI Recommendation (Gemini API) | **Nguyên & Bảo** | 🟡 **TO DO** | Chuẩn bị tích hợp Gemini gợi ý phim theo sở thích |
| **Phase 6** | Bảng điều khiển Admin Dashboard, CRUD Phim, Cấp quyền VIP | **Nam, Nguyên & Bảo** | 🟢 **DONE** | Dashboard 3 thẻ số liệu, switch toggle VIP, CRUD phim |
| **Phase 7** | Testing toàn hệ thống, bắt lỗi Sentry, Báo cáo & Tổng duyệt | **Bảo** | 🟡 **TO DO** | Đã hoàn thành 35 unit tests; chuẩn bị Sentry & Slide |

---

*Tài liệu được cập nhật toàn diện và chuẩn hóa cho dự án CineVerse (Cập nhật: 31/10/2026).*
