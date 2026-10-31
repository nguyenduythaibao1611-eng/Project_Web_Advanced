# 🎬 CINEVERSE — Nền Tảng Trực Tuyến Điện Ảnh Đỉnh Cao (Full Documentation & Technical Manual)

> **CineVerse** là nền tảng streaming phim điện ảnh trực tuyến chuẩn quốc tế (lấy cảm hứng từ Disney+ và Marvel Studios). Dự án được xây dựng theo kiến trúc **MVC-Service**, vận hành kho nội dung độc lập **355+ bộ phim chất lượng cao** trên **MongoDB Atlas**, hạ tầng phát **Đa Máy Chủ độc lập (Server 1: HLS.js m3u8 + Server 2: Iframe/CDN)** kèm **Hệ thống Chọn Tập Phim Thông Minh (Interactive Episode Selector)**, lưu trữ ảnh CDN trên **Supabase Cloud Storage**, quản lý người dùng với JWT Cookie HttpOnly, bảo mật phiên 1 tài khoản/1 thiết bị, khảo sát sở thích **Onboarding Profile**, cơ chế **Freemium VIP Paywall (khóa 5 phút tích lũy cho phim VIP)**, **Lịch sử xem & Tiếp tục xem**, **Hệ thống Quản trị Admin thuần MongoDB**, và **Worker tự động đồng bộ Top 10 TMDB mỗi 12 tiếng**.

---

## 📑 MỤC LỤC TRA CỨU NHANH
1. [Kiến trúc Hệ thống & Luồng Dữ liệu (MVC-S)](#1-kiến-trúc-hệ-thống--luồng-dữ-liệu-mvc-s)
2. [Bản đồ Cấu trúc Thư mục & Trách nhiệm Code](#2-bản-đồ-cấu-trúc-thư-mục--trách-nhiệm-code)
3. [Bản Đồ Giao Diện Trực Quan (Screen-to-Code Mapping)](#3-bản-đồ-giao-diện-trực-quan-screen-to-code-mapping)
4. [Các Phân Hệ Kỹ Thuật Trọng Tâm](#4-các-phân-hệ-kỹ-thuật-trọng-tâm)
   - [4.1. Hệ thống Streaming Đa Server HLS.js & Chọn Tập Phim Bộ](#41-hệ-thống-streaming-đa-server-hlsjs--chọn-tập-phim-bộ)
   - [4.2. Cơ chế Freemium & Giới hạn 5 phút Tích lũy (VIP Paywall)](#42-cơ-chế-freemium--giới-hạn-5-phút-tích-lũy-vip-paywall)
   - [4.3. Hệ thống Lưu Lịch Sử Xem & Tiếp Tục Xem (Watch History)](#43-hệ-thống-lưu-lịch-sử-xem--tiếp-tục-xem-watch-history)
   - [4.4. Hệ thống Khảo sát Sở thích & Độ tuổi (Onboarding Profile)](#44-hệ-thống-khảo-sát-sở-thích--độ-tuổi-onboarding-profile)
   - [4.5. Phân Hệ Quản Trị Hệ Thống Thuần MongoDB (Admin Workspace & Audit Logs)](#45-phân-hệ-quản-trị-hệ-thống-thuần-mongodb-admin-workspace--audit-logs)
   - [4.6. Hệ thống Xác thực, Phân quyền & Giới hạn 1 Thiết Bị](#46-hệ-thống-xác-thực-phân-quyền--giới-hạn-1-thiết-bị)
   - [4.7. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)](#47-hệ-thống-danh-sách-yêu-thích-favorites--optimistic-ui)
   - [4.8. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)](#48-hệ-thống-hero-banner--cơ-chế-chống-giật-anti-jitter)
   - [4.9. Hệ thống Worker Tự Động Hóa & Pipeline Đa Nguồn](#49-hệ-thống-worker-tự-động-hóa--pipeline-đa-nguồn)
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
                  │  - adminMiddleware (CSRF HMAC-SHA256, Cache-Control)  │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                    CONTROLLERS                         │
                  │  (movieController, authController, favoriteController, │
                  │   adminController, libraryController, watchHistory)    │
                  └─────────────┬───────────────────────────┬──────────────┘
                                │                           │
                 Gọi nghiệp vụ  ▼            Truy vấn DB    ▼
                  ┌───────────────────────────┐ ┌──────────────────────────┐
                  │         SERVICES          │ │          MODELS          │
                  │ - tmdbService             │ │ - User (roles, sessions) │
                  │ - ophimService            │ │ - Movie (servers, eps)   │
                  │ - supabaseService         │ │ - Favorite               │
                  │                           │ │ - WatchHistory           │
                  │                           │ │ - AdminLog (Audit trails)│
                  └───────────────────────────┘ └──────────────────────────┘
```

---

## 2. BẢN ĐỒ CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM CODE

```text
cineverse/
├── config/
│   └── db.js                       # Kết nối MongoDB Atlas Cloud, cấu hình DNS dự phòng
│
├── controllers/
│   ├── movieController.js          # Trang chủ, danh mục phim, chi tiết phim, live search, tích hợp tập
│   ├── authController.js           # Đăng ký, đăng nhập, khảo sát Onboarding, nâng cấp VIP, đổi phiên
│   ├── favoriteController.js       # Thêm/Xóa phim yêu thích (Favorites API & Web View)
│   ├── adminController.js          # Quản trị Admin: Dashboard thống kê, User CRUD, Movie CRUD, Upload, Logs
│   ├── libraryController.js        # Thư viện phim nội bộ MongoDB (/library, /library/:slug)
│   └── watchHistoryController.js   # API lưu vị trí xem dở và danh sách xem tiếp
│
├── middlewares/
│   ├── authMiddleware.js           # checkUser, requireAuth, requireAdmin, sanitizeRedirectUrl
│   └── adminMiddleware.js          # CSRF protection (HMAC-SHA256 theo session), chặn clickjacking, no-store
│
├── models/
│   ├── userModel.js                # Schema User: username, email, password, role, isVip, isBlocked, preferences, age
│   ├── movieModel.js               # Schema Movie: metadata, slug, danh_sach_server (m3u8, embed), isPublished, isVip
│   ├── favoriteModel.js            # Schema Favorites: userId, movieId (Unique compound index)
│   ├── watchHistoryModel.js        # Schema Lịch sử xem: userId, movieId, episode, currentTime, duration
│   └── adminLogModel.js            # Schema Nhật ký kiểm toán: actorId, actorName, action, target, summary, status
│
├── routes/
│   ├── index.js                    # Tổng hợp toàn bộ các Router con vào 1 đầu mối
│   ├── movieRoutes.js              # GET /, /movies, /movies/:id, /search, /api/search, /library, /library/:slug
│   ├── authRoutes.js               # /login, /register, /logout, /onboarding, /api/auth/upgrade-vip
│   ├── favoriteRoutes.js           # GET /favorites, API /api/favorites/*
│   ├── adminRoutes.js              # /admin (Dashboard, Users, Movies, Logs, Upload, Logout)
│   └── watchHistoryRoutes.js       # API /api/history (Lưu tọa độ, lấy danh sách xem dở)
│
├── scripts/
│   ├── crawlMovies.js              # Worker cào phim từ OPhim & NguonC, upload ảnh Supabase & ghép server
│   ├── crawlTopRatedTMDB.js        # Cào 200 phim Top Rated điểm cao nhất từ TMDB
│   ├── syncTop10TMDB.js            # Đồng bộ tự động Top 10 phim thịnh hành hôm nay vào Database
│   ├── grantAdmin.js               # Phân quyền Admin an toàn bằng lệnh: npm run admin:grant -- <email>
│   └── makeAdmin.js                # Tiện ích cấp quyền admin theo username hoặc email
│
├── services/
│   ├── tmdbService.js              # TMDB API: Phim hot, danh mục phim phân trang, search suggestions, logo PNG
│   ├── ophimService.js             # OPhim API: Tìm phim, bóc tách link m3u8, lấy danh sách phân trang
│   └── supabaseService.js          # Upload ảnh tự động lên Supabase Storage CDN (uploadImageFromUrl)
│
├── tests/                          # BỘ KIỂM THỬ TỰ ĐỘNG CHUẨN NODE.JS TEST RUNNER (34 TESTS PASS 100%)
│   ├── admin.test.js               # 10 tests: Bảo mật admin, CSRF, validation, revision __v, upload, logs
│   ├── onboarding.test.js          # 10 tests: Form khảo sát sở thích 3-5 thể loại, độ tuổi, cập nhật user
│   ├── watchHistoryAndVip.test.js  # 4 tests: HLS Player render, API lưu lịch sử xem, nâng cấp VIP
│   ├── movies.test.js              # 4 tests: Trang danh sách Movies, lọc thể loại, phân trang
│   ├── search.test.js              # 6 tests: Thanh tìm kiếm, live suggestions dropdown, escape ký tự
│   └── previewAdmin.js             # Script tạo server demo Admin độc lập cổng 5010 (npm run admin:preview)
│
├── views/                          # TOÀN BỘ GIAO DIỆN (SERVER-SIDE RENDERING EJS)
│   ├── layouts/
│   │   ├── main.ejs                # Khung HTML giao diện người xem chính
│   │   └── admin.ejs               # Khung HTML Bảng điều khiển Quản trị viên
│   ├── partials/
│   │   ├── header.ejs              # Navbar: Logo, Menu, Khung Search thông minh, Chuông, Avatar, Dropdown
│   │   ├── footer.ejs              # Chân trang thông tin & liên kết (/movies, /library)
│   │   └── movieCard.ejs           # Component thẻ phim chuẩn điện ảnh
│   ├── pages/
│   │   ├── index.ejs               # TRANG CHỦ: Hero Slider, Hàng "Tiếp tục xem", Top 10, Thể loại
│   │   ├── movieDetail.ejs         # CHI TIẾT PHIM: Trình phát HLS.js, Chọn Server, Lưới chọn tập, Popup VIP
│   │   ├── movies.ejs              # DANH SÁCH PHIM: Duyệt phim theo thể loại, phân trang
│   │   ├── search.ejs              # TÌM KIẾM: Kết quả tìm kiếm mở rộng kèm phân trang
│   │   ├── favorites.ejs           # MY LIST: Lưới hiển thị các phim đã lưu bookmark
│   │   ├── onboarding.ejs          # ONBOARDING: Khảo sát chọn 3-5 thể loại yêu thích & độ tuổi
│   │   ├── library.ejs             # THƯ VIỆN: Kho phim nội bộ MongoDB đã xuất bản
│   │   ├── libraryDetail.ejs       # CHI TIẾT THƯ VIỆN: Nguồn phát nội bộ có kiểm soát VIP
│   │   ├── login.ejs               # ĐĂNG NHẬP: Form tài khoản/email, mật khẩu, báo lỗi
│   │   └── register.ejs            # ĐĂNG KÝ: Tạo tài khoản mới, tự chuyển sang Onboarding
│   └── admin/
│       ├── dashboard.ejs           # BẢNG ĐIỀU KHIỂN: Thống kê thành viên, VIP, phim, yêu thích
│       ├── users.ejs               # QUẢN LÝ USER: Phân trang, tìm kiếm, cấp VIP, khóa/mở khóa
│       ├── movies.ejs              # QUẢN LÝ PHIM: Danh sách, lọc trạng thái xuất bản, tìm kiếm
│       ├── movieForm.ejs           # FORM PHIM: Thêm & sửa metadata, 100 tập phim, iframe/m3u8, ảnh upload
│       ├── logs.ejs                # NHẬT KÝ KIỂM TOÁN: Lịch sử thao tác admin chi tiết
│       ├── pagination.ejs          # Component phân trang Admin
│       └── error.ejs               # Trang báo lỗi quản trị
│
├── public/                         # TÀI NGUYÊN TĨNH PHÍA TRÌNH DUYỆT (CLIENT-SIDE)
│   ├── css/
│   │   ├── style.css               # Design System Streaming: Theme tối, Glassmorphism, VIP Modal, Player, Tabs tập
│   │   └── admin.css               # Giao diện Bảng điều khiển Quản trị hiện đại
│   └── js/
│       ├── playerEngine.js         # Engine trình phát đa server, chọn tập phân trang 50 tập, đếm VIP tích lũy
│       ├── onboarding.js           # Chọn chips thể loại (3-5 mục), validate form onboarding
│       └── admin.js                # Xử lý upload ảnh kéo thả, quản lý động danh sách tập phim trong admin
│
├── .env                            # Chứa biến môi trường bí mật (không commit lên Git)
├── .env.example                    # File mẫu hướng dẫn khai báo biến môi trường cho thành viên
├── eslint.config.mjs               # Cấu hình kiểm tra cú pháp ESLint v10
├── server.js                       # Khởi chạy server, kết nối MongoDB Atlas
├── app.js                          # Cấu hình Express, View engine, Cookie parser, nạp dotenv tự động
└── package.json                    # Khai báo thư viện và scripts (dev, start, test, lint, crawl, sync:top10, admin:*)
```

---

## 3. BẢN ĐỒ GIAO DIỆN TRỰC QUAN (SCREEN-TO-CODE MAPPING)

| Giao diện / Chức năng | Đường dẫn URL | File View phụ trách | File CSS / JS xử lý | Controller / Middleware |
| :--- | :--- | :--- | :--- | :--- |
| **Trang chủ & Tiếp tục xem** | `/` | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs) | [`style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) | `movieController.getPopular` |
| **Danh mục Phim** | `/movies` | [`views/pages/movies.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movies.ejs) | `style.css` (`.movies-hero`, `.movies-genre`) | `movieController.getMovieList` |
| **Thanh Tìm kiếm & Suggestions** | Header & `/search` | [`views/pages/search.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/search.ejs) | [`header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs) | `movieController.search` & `searchSuggestions` |
| **Player HLS & Chọn Tập Phim** | `/movies/:id` | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs) | [`playerEngine.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/playerEngine.js) | `movieController.getMovieDetail` |
| **Thư viện Phim Nội Bộ** | `/library` & `/:slug` | [`views/pages/library.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/library.ejs) | `style.css` (`.library-grid`) | `libraryController.list` & `detail` |
| **Màn hình Onboarding** | `/onboarding` | [`views/pages/onboarding.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/onboarding.ejs) | [`onboarding.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/onboarding.js) | `authController.getOnboardingPage` + `postOnboarding` |
| **Dashboard Quản trị** | `/admin` | [`views/admin/dashboard.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/admin/dashboard.ejs) | [`admin.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/admin.css) + [`admin.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/layouts/admin.ejs) | `adminController.dashboard` (`requireAdmin`) |
| **Quản lý User & Cấp VIP** | `/admin/users` | [`views/admin/users.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/admin/users.ejs) | `admin.css` + `admin.js` | `adminController.users` + `updateUser` |
| **Quản lý Phim CRUD** | `/admin/movies` | [`views/admin/movies.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/admin/movies.ejs) & `movieForm.ejs` | `admin.css` + `admin.js` | `adminController.movies` + `saveMovie` |
| **Nhật ký Kiểm toán** | `/admin/logs` | [`views/admin/logs.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/admin/logs.ejs) | `admin.css` | `adminController.logs` |
| **Danh sách Yêu thích** | `/favorites` | [`views/pages/favorites.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/favorites.ejs) | `favoriteController` (`requireAuth`) |

---

## 4. CÁC PHÂN HỆ KỸ THUẬT TRỌNG TÂM

### 4.1. Hệ thống Streaming Đa Server HLS.js & Chọn Tập Phim Bộ
- **Module Trình phát Thông minh ([public/js/playerEngine.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/playerEngine.js)):**
  - Tách biệt hoàn toàn khỏi template EJS, loại bỏ 100% lỗi cú pháp và nguy cơ XSS nhờ cơ chế escape `\u003c` trong thẻ JSON script.
- **Hệ thống Chọn Tập Phân Trang 50 tập/tab (Episode Selector):**
  - Ẩn hoàn toàn đối với phim lẻ (1 tập). Đối với phim bộ nhiều tập (từ 10 đến 555 tập), hệ thống hiển thị lưới tập phim kèm các tab phân đoạn: `1 - 50`, `51 - 100`, v.v.
  - **Tối ưu DOM:** Chỉ render đúng 50 nút tập của tab đang kích hoạt, giúp trang web giữ dung lượng cực nhẹ (< 100 KB) kể cả với phim hơn 500 tập.
- **Chuyển đổi Server & Tập phim mượt mà (Zero Reload):**
  - Bấm chọn tập: Trình phát lập tức chuyển luồng phát HLS / Iframe tương ứng mà không phải tải lại toàn bộ trang web.
  - Chuyển đổi giữa Server 1 và Server 2: Hệ thống tự động so khớp tên tập phim tương ứng (hoặc fallback theo index gần nhất) và hiển thị thông báo nếu server đó chưa có tập.

### 4.2. Cơ chế Freemium & Giới hạn 5 phút Tích lũy (VIP Paywall)
- **Kiểm soát thông minh theo phim VIP:**
  - **Phim Thường / Miễn phí:** Người xem được xem trọn vẹn 100% thời lượng, tua tùy ý, không bao giờ bị khóa 5 phút.
  - **Phim Gắn Tag VIP:** Người dùng chưa có VIP được xem thử tối đa 5 phút (300 giây).
- **Bộ đếm thời gian tích lũy (Accumulative Free Timer):**
  - Không dựa vào `video.currentTime` đơn thuần để tránh việc người dùng đổi tập hoặc tua lại từ đầu để lách luật.
  - Thời gian xem thực tế được cộng dồn (`totalVipWatchSeconds`). Khi tổng thời gian đạt 300s, video lập tức dừng và hiển thị **VIP Paywall Modal**.
  - Tích hợp nút **Nâng cấp VIP nhanh** qua `POST /api/auth/upgrade-vip`, tự động mở khóa ngay tại chỗ mà không làm gián đoạn luồng xem.

### 4.3. Hệ thống Lưu Lịch Sử Xem & Tiếp Tục Xem (Watch History)
- **Tự động đồng bộ tiến độ:** Cứ mỗi 12 giây khi đang xem hoặc khi thoát trang (`sendBeacon`), trình duyệt tự động gửi tọa độ giây và tên tập cụ thể về server qua `POST /api/history`.
- **Tua tiếp thông minh theo từng tập:** Khi người dùng mở lại phim bộ, hệ thống tự động tìm đúng tập phim đang xem dở, kích hoạt tab tập tương ứng và hỏi người xem có muốn tiếp tục xem từ giây `mm:ss` hay không.
- **Hàng "Tiếp tục xem" (Continue Watching):** Trang chủ hiển thị trực quan các phim đang xem dở kèm thanh tiến độ phần trăm (`progress bar`) và thời gian còn lại.

### 4.4. Hệ thống Khảo sát Sở thích & Độ tuổi (Onboarding Profile)
- **Luồng kích hoạt:** Ngay sau khi đăng ký tài khoản thành công, người dùng được tự động chuyển hướng sang `/onboarding`.
- **Ràng buộc dữ liệu:** Người dùng bắt buộc chọn từ **3 đến 5 thể loại phim yêu thích** (chips selection) và điền độ tuổi hợp lệ (1 - 120 tuổi). Dữ liệu được lưu vào `userModel` làm nền tảng cho thuật toán AI gợi ý nội dung.

### 4.5. Phân Hệ Quản Trị Hệ Thống Thuần MongoDB (Admin Workspace & Audit Logs)
- **Kiến trúc bảo mật cao cấp:**
  - Middleware bảo vệ kép `requireAuth` + `requireAdmin`.
  - Cơ chế **CSRF Token** sử dụng HMAC-SHA256 liên kết chặt chẽ theo `userId` và `sessionId`.
  - Header bảo mật: `Cache-Control: no-store`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`.
- **Chống xung đột dữ liệu (Optimistic Concurrency Control):**
  - Sử dụng versioning `__v` của Mongoose để chặn việc hai admin vô tình ghi đè dữ liệu của nhau (trả lỗi 409 Conflict).
- **Quản lý Thành viên An toàn:**
  - Cấp VIP, khóa/mở khóa tài khoản. Khi thay đổi trạng thái, session của người dùng đó lập tức bị hủy bỏ (`activeSessionId: null`).
  - **Bảo vệ tài khoản Admin:** Không cho phép sửa đổi tài khoản admin qua web để chống tự khóa hoặc mất quyền quản trị viên duy nhất.
- **Quản lý Kho Phim & Xuất bản:**
  - Hỗ trợ nhập và gom nhóm tối đa 100 tập phim theo server `iframe` và `m3u8`.
  - Lưu nháp hoặc xuất bản ra Thư viện nội bộ (`/library`).
  - Tải ảnh poster/backdrop an toàn lên thư mục nội bộ `public/uploads/admin/`, kiểm tra magic bytes (PNG, JPEG, WebP) và giới hạn 5 MB.
- **Nhật ký Kiểm toán (Audit Logs - `/admin/logs`):**
  - Ghi nhận chi tiết mọi hành động thêm/sửa/xóa của admin, thời gian và trạng thái thành công/thất bại.

### 4.6. Hệ thống Xác thực, Phân quyền & Giới hạn 1 Thiết Bị
- **Mật khẩu an toàn:** Băm bằng `bcryptjs` với salt 10, tự động ẩn khi xuất JSON.
- **Token JWT HttpOnly:** Lưu trữ trong cookie `cineverse_token` với cờ `httpOnly: true` và `sameSite: 'lax'`.
- **Giới hạn 1 thiết bị/1 tài khoản:** Khi đăng nhập/đăng ký, hệ thống sinh ngẫu nhiên `sessionId = crypto.randomUUID()` lưu vào `User.activeSessionId` và nhúng vào JWT. Khi đăng nhập trên thiết bị mới, thiết bị cũ bị hủy phiên ngay lập tức (`SESSION_REPLACED`).

### 4.7. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)
- Cơ sở dữ liệu MongoDB lưu `userId` và `movieId` kèm Compound Unique Index.
- Trải nghiệm Optimistic UI: Đổi trạng thái biểu tượng trái tim tức thì trước khi API mạng phản hồi, tự động hoàn tác nếu mất kết nối.

### 4.8. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)
- Ép GPU render bằng `will-change: transform` và `transform: scaleX(0)`.
- Chế độ Pause/Resume tính toán thời gian `remaining`, không gây nảy chữ và giật slide khi rê chuột.

### 4.9. Hệ thống Worker Tự Động Hóa & Pipeline Đa Nguồn
- **Worker đồng bộ Top 10 TMDB mỗi 12 tiếng (`scripts/syncTop10TMDB.js`):** Tự động quét `GET /trending/movie/day`, cập nhật thứ hạng `#1` đến `#10` trên trang chủ.
- **Worker cào 200 phim Top Rated (`scripts/crawlTopRatedTMDB.js`):** Cào phim điểm cao nhất mọi thời đại từ TMDB vào kho nội bộ.

---

## 5. CẨM NANG BẮT BỆNH & KHẮC PHỤC SỰ CỐ (TROUBLESHOOTING MATRIX)

| Triệu chứng nhìn thấy (Symptom) | Nguyên nhân cốt lõi (Root Cause) | File liên quan | Cách xử lý dứt điểm |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas báo lỗi `querySrv ECONNREFUSED`** | DNS router nhà mạng chặn bản ghi SRV của Atlas. | [`config/db.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/config/db.js) | Đã tự động tích hợp `dns.setServers(['8.8.8.8', '1.1.1.1'])` trước khi kết nối. |
| **Trang web không tải được phim, màn hình trống** | Chưa cấu hình hoặc thiếu biến trong `.env`. | [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env) & [`app.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/app.js) | Tạo file `.env` theo mẫu `.env.example`, đảm bảo có `JWT_SECRET` và `MONGODB_URI`. |
| **Không truy cập được trang `/admin` (403)** | Tài khoản hiện tại có `role: 'user'` thay vì `'admin'`. | [`middlewares/authMiddleware.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js) | Chạy lệnh: `npm run admin:grant -- email-cua-ban@example.com`. |
| **Chưa có tài khoản admin nhưng muốn xem thử giao diện** | Cần môi trường demo không ảnh hưởng database thật. | [`tests/previewAdmin.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/tests/previewAdmin.js) | Chạy lệnh: `npm run admin:preview` và mở `http://127.0.0.1:5010/admin`. |
| **Lưu lịch sử xem trả về 400 "movieId không hợp lệ"** | Phim tạo trong MongoDB nội bộ có `movieId` là chuỗi ObjectId thay vì số TMDB. | [`controllers/watchHistoryController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/watchHistoryController.js) | Phim có `tmdb.id` số sẽ lưu bình thường; với phim nội bộ thuần ObjectId, cần nới lỏng schema chấp nhận String. |

---

## 6. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY DỰ ÁN

### Yêu cầu tiên quyết:
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị Node.js v20+ hoặc v22+).
- **MongoDB**: MongoDB Atlas Cloud hoặc MongoDB local tại `127.0.0.1:27017`.

### Các bước cài đặt:

1. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

2. **Cấu hình file biến môi trường [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env):**
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cineverse?retryWrites=true&w=majority
   JWT_SECRET=your_strong_random_jwt_secret_key_here
   TMDB_BASE_URL=https://api.themoviedb.org/3
   TMDB_TOKEN=your_tmdb_bearer_token_here
   OPHIM_BASE_URL=https://ophim1.com
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_supabase_secret_key
   SUPABASE_BUCKET=cineverse-movies
   ```

3. **Các lệnh tiện ích vận hành:**
   * **Cấp quyền Admin:** `npm run admin:grant -- email-cua-ban@example.com`
   * **Chạy thử Demo Admin (Database riêng, không cần login):** `npm run admin:preview`
   * **Đồng bộ Top 10 TMDB ngay lập tức:** `npm run sync:top10`
   * **Cào 200 phim Top Rated TMDB:** `npm run crawl:top-rated`

4. **Khởi chạy ứng dụng:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt: [http://localhost:5000](http://localhost:5000)

---

## 7. QUY CHUẨN KIỂM THỬ TỰ ĐỘNG & LINTING (TESTING & CODE QUALITY)

### 1. Kiểm thử tự động (Unit & Integration Tests):
```bash
npm test
```
* **Quy mô kiểm thử:** **34 bài test tự động** bao phủ 100% các phân hệ:
  * `tests/admin.test.js`: 10 bài test bảo mật Admin thuần MongoDB, CSRF, upload file, versioning `__v`, session revocation.
  * `tests/onboarding.test.js`: 10 bài test quy trình khảo sát sở thích 3-5 thể loại, độ tuổi, cập nhật profile.
  * `tests/watchHistoryAndVip.test.js`: 4 bài test render HLS player, lưu tọa độ giây, API nâng cấp VIP.
  * `tests/movies.test.js`: 4 bài test trang danh mục phim, phân trang, lọc theo thể loại.
  * `tests/search.test.js`: 6 bài test tìm kiếm realtime, live suggestions dropdown, escape ký tự.
* **Kết quả:** Luôn đạt **34 / 34 tests PASS (100%)**.

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
| **Phase 2** | Kho dữ liệu 355+ phim, Đa Server OPhim & NguonC | **Bảo** | 🟢 **DONE** | Cào dữ liệu, tích hợp 2-3 server độc lập |
| **Phase 3** | Xác thực JWT, Session 1 thiết bị & Onboarding Profile | **Nguyên** | 🟢 **DONE** | Đăng ký, đăng nhập, đá phiên cũ, khảo sát 3-5 sở thích |
| **Phase 4** | Live search, Danh mục phim, HLS Player, Khóa 5p VIP | **Nam & Bảo** | 🟢 **DONE** | Tách playerEngine.js, khóa 5p tích lũy phim VIP |
| **Phase 5** | Danh sách chọn tập phim bộ phân trang 50 tập/tab | **Ban & Bảo** | 🟢 **DONE** | PR #19: Phân tab 50 tập, chuyển tập zero-reload |
| **Phase 6** | Bảng điều khiển Admin Dashboard thuần MongoDB & Audit Logs | **Nam & Bảo** | 🟢 **DONE** | PR #17: Dashboard, quản lý user, CRUD phim, logs |
| **Phase 7** | Testing tự động (34 tests), Báo cáo tiến độ đồ án | **Bảo** | 🟢 **DONE** | 34/34 tests pass, tài liệu kỹ thuật & slide |

---

*Tài liệu được cập nhật toàn diện và chuẩn hóa cho dự án CineVerse (Cập nhật: 31/10/2026).*
