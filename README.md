# 🎬 CINEVERSE — Nền Tảng Trực Tuyến Điện Ảnh Đỉnh Cao (Full Documentation & Technical Manual)

> **CineVerse** là nền tảng streaming phim điện ảnh trực tuyến chuẩn quốc tế (lấy cảm hứng từ Disney+ và Marvel Studios). Dự án được xây dựng theo kiến trúc **MVC-Service**, tích hợp tổng hợp dữ liệu từ nhiều nguồn API (TMDB, OPhim, VidSrc), quản lý người dùng với JWT Cookie và lưu trữ phim yêu thích cá nhân hóa trên MongoDB.

---

## 📑 MỤC LỤC TRA CỨU NHANH
1. [Kiến trúc Hệ thống & Luồng Dữ liệu (MVC-S)](#1-kiến-trúc-hệ-thống--luồng-dữ-liệu-mvc-s)
2. [Bản đồ Cấu trúc Thư mục & Trách nhiệm Code](#2-bản-đồ-cấu-trúc-thư-mục--trách-nhiệm-code)
3. [Bản Đồ Giao Diện Trực Quan (Screen-to-Code Mapping)](#3-bản-đồ-giao-diện-trực-quan-screen-to-code-mapping)
4. [Các Phân Hệ Kỹ Thuật Trọng Tâm](#4-các-phân-hệ-kỹ-thuật-trọng-tâm)
   - [4.1. Hệ thống Streaming Đa Server & Tự động Fallback](#41-hệ-thống-streaming-đa-server--tự-động-fallback)
   - [4.2. Hệ thống Xác thực & Phân quyền (Auth & Security)](#42-hệ-thống-xác-thực--phân-quyền-auth--security)
   - [4.3. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)](#43-hệ-thống-danh-sách-yêu-thích-favorites--optimistic-ui)
   - [4.4. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)](#44-hệ-thống-hero-banner--cơ-chế-chống-giật-anti-jitter)
5. [Cẩm Nang Bắt Bệnh & Khắc Phục Sự Cố (Troubleshooting Matrix)](#5-cẩm-nang-bắt-bệnh--khắc-phục-sự-cố-troubleshooting-matrix)
6. [Hướng dẫn Cài đặt & Khởi chạy Dự án](#6-hướng-dẫn-cài-đặt--khởi-chạy-dự-án)
7. [Quy chuẩn Kiểm tra Code (Linting & Code Quality)](#7-quy-chuẩn-kiểm-tra-code-linting--code-quality)

---

## 1. KIẾN TRÚC HỆ THỐNG & LUỒNG DỮ LIỆU (MVC-S)

CineVerse vận hành theo mô hình kiến trúc phân lớp chuẩn:
**Client (Trình duyệt) ⇄ Routes ⇄ Middlewares ⇄ Controllers ⇄ Services / Models ⇄ Views (EJS Rendering)**

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 CLIENT (Trình duyệt)                  │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTP Request (Cookie, Form, Fetch)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                  APP.JS / ROUTES                       │
                  │  (routes/movieRoutes, favoriteRoutes, authRoutes)      │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                    MIDDLEWARES                         │
                  │  - checkUser (giải mã JWT, gán req.user, res.locals)   │
                  │  - requireAuth (chặn khách, redirect login / 401 JSON) │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                    CONTROLLERS                         │
                  │  (movieController, favoriteController, authController) │
                  └─────────────┬───────────────────────────┬──────────────┘
                                │                           │
                 Gọi nghiệp vụ  ▼            Truy vấn DB    ▼
    ┌──────────────────────────────────────┐     ┌────────────────────────┐
    │              SERVICES                │     │         MODELS         │
    │ - tmdbService: Gọi TheMovieDB API    │     │ - userModel: bcrypt    │
    │ - ophimService: Dò Vietsub & Embed   │     │ - favoriteModel: Index │
    └──────────────────────────────────────┘     └────────────────────────┘
                                │                           │
                                └─────────────┬─────────────┘
                                              │ res.render(view, data) / res.json()
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 VIEWS ENGINE (EJS)                     │
                  │   layouts/main.ejs ➔ pages/*.ejs + partials/*.ejs      │
                  │   Trả về HTML hoàn chỉnh kèm CSS/JS tĩnh cho Client    │
                  └────────────────────────────────────────────────────────┘
```

---

## 2. BẢN ĐỒ CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM CODE

```
cineverse/
├── config/
│   └── db.js                       # Kết nối CSDL MongoDB thông qua Mongoose
│
├── controllers/
│   ├── movieController.js          # Điều phối Trang chủ (Hero Banner, Thể loại) & Trang Chi tiết phim
│   ├── favoriteController.js       # Quản lý Danh sách yêu thích (Render page, API CRUD, Toggle)
│   ├── authController.js           # Xử lý Đăng ký, Đăng nhập, Đăng xuất, Cấp JWT Cookie
│   └── assistantController.js      # [Khung sườn] Dự phòng cho tính năng Chatbot AI
│
├── middlewares/
│   └── authMiddleware.js           # Kiểm tra token JWT (checkUser), Bắt buộc đăng nhập (requireAuth), Sanitize URL
│
├── models/
│   ├── userModel.js                # Schema Người dùng (Username, Email, Password băm bcrypt)
│   ├── favoriteModel.js            # Schema Phim lưu (UserId, MovieId, Title, Poster, Index unique)
│   └── chatLogModel.js             # [Khung sườn] Dự phòng lưu nhật ký chat AI
│
├── routes/
│   ├── index.js                    # Tổng hợp toàn bộ các Router con vào 1 đầu mối
│   ├── movieRoutes.js              # Định tuyến: GET / (Trang chủ), GET /movies/:id (Chi tiết)
│   ├── favoriteRoutes.js           # Định tuyến: GET /favorites, API /api/favorites/*
│   ├── authRoutes.js               # Định tuyến: /login, /register, /logout, /api/auth/me
│   └── assistantRoutes.js          # [Khung sườn] Định tuyến cho trợ lý ảo
│
├── services/
│   ├── tmdbService.js              # Gọi TMDB API: Phim hot, thể loại, chi tiết, logo trong suốt (getMovieLogo)
│   ├── ophimService.js             # Gọi OPhim/PhimAPI: Tìm phim theo tên, bóc tách link embed tập 1
│   └── geminiService.js            # [Khung sườn] Gọi Gemini AI gợi ý phim
│
├── views/                          # TOÀN BỘ GIAO DIỆN (SERVER-SIDE RENDERING EJS)
│   ├── layouts/
│   │   └── main.ejs                # Khung HTML bao ngoài: Head, Font, CSS, Header, Main, Footer, Toast, JS
│   ├── partials/
│   │   ├── header.ejs              # Thanh điều hướng trên cùng: Logo, Menu, Tìm kiếm, Chuông, User Profile
│   │   ├── footer.ejs              # Chân trang thông tin, bản quyền, liên kết xã hội
│   │   ├── movieCard.ejs           # Component thẻ phim chuẩn điện ảnh (Poster, Nút yêu thích, Điểm, HD)
│   │   ├── aiModal.ejs             # [Khung sườn] Hộp thoại popup trợ lý AI
│   │   └── trailerModal.ejs        # [Khung sườn] Popup phát trailer phim
│   └── pages/
│       ├── index.ejs               # TRANG CHỦ: Hero Slider 5 phim thịnh hành, các hàng phim cuộn ngang
│       ├── movieDetail.ejs         # TRANG CHI TIẾT: Hero chi tiết, Trình phát Video Đa Server, Nút đổi nguồn
│       ├── favorites.ejs           # TRANG MY LIST: Lưới hiển thị các phim đã lưu hoặc màn hình trống (Empty state)
│       ├── login.ejs               # TRANG ĐĂNG NHẬP: Form tài khoản/email, mật khẩu, thông báo lỗi
│       ├── register.ejs            # TRANG ĐĂNG KÝ: Form tạo tài khoản mới với validation
│       ├── search.ejs              # [Khung sườn] Trang kết quả tìm kiếm mở rộng
│       └── error.ejs               # [Khung sườn] Trang báo lỗi 404/500
│
├── public/                         # TÀI NGUYÊN TĨNH PHÍA TRÌNH DUYỆT (CLIENT-SIDE)
│   ├── css/
│   │   └── style.css               # Hệ thống Design System: Biến CSS, Theme tối, Typography, Slider, Glassmorphism
│   └── js/
│       ├── ui-interactions.js      # Điều khiển tương tác UI: Hero slider tự động/dừng khi hover, cuộn hàng, dropdown
│       ├── favorite.js             # Xử lý click Bookmark: Optimistic UI, gọi API toggle, cập nhật Badge, Toast
│       ├── chat.js                 # [Khung sườn] Client JS cho AI chat
│       ├── main.js                 # [Khung sườn] Client JS bổ trợ
│       └── trailer.js              # [Khung sườn] Client JS mở trailer
│
├── local-docs/                     # Tài liệu nội bộ (không commit)
├── .env                            # Chứa biến môi trường bí mật (PORT, TMDB_TOKEN, MONGODB_URI, JWT_SECRET...)
├── .env.example                    # File mẫu hướng dẫn khai báo biến môi trường
├── eslint.config.mjs               # Cấu hình kiểm tra cú pháp ESLint cho cả Node.js và Client Browser
├── server.js                       # Điểm khởi chạy ứng dụng (Bootstrap Server, kết nối DB, app.listen)
├── app.js                          # Cấu hình Express, View engine, Cookie parser, Static folder, Root routes
└── package.json                    # Khai báo thư viện phụ thuộc và scripts chạy (dev, start, lint)
```

---

## 3. BẢN ĐỒ GIAO DIỆN TRỰC QUAN (SCREEN-TO-CODE MAPPING)

> **Khi nhìn vào giao diện trang web hoặc chụp ảnh màn hình, đối chiếu với bảng này để biết ngay code nằm ở file nào:**

### 🖥️ Khu vực 1: Thanh Điều Hướng (Site Header / Navbar)
| Vị trí trên màn hình | Giao diện hiển thị | File View phụ trách | File CSS / JS xử lý | Controller / Dữ liệu |
| :--- | :--- | :--- | :--- | :--- |
| **Góc trái Header** | Logo `CINEVERSE` & Nút Menu Mobile | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L5-L12) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.brand-logo`) | Tĩnh |
| **Menu chính** | Các mục: `HOME`, `TV (SOON)`, `MOVIES`, `MY LIST`, `KIDS (SOON)` | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L14-L42) | [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) (chặn click tab SOON) | `res.locals.user` kiểm tra trạng thái |
| **Badge số lượng phim** | Viên thuốc màu đỏ/vàng trên mục `MY LIST` (VD: `3`, `99+`) | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L34) (`#favCountBadge`) | [`public/js/favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js) (`updateBadge()`) | Lấy từ API `/api/favorites/ids` |
| **Thanh tìm kiếm** | Icon kính lúp bấm vào bung ra ô nhập tên phim | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L44-L53) (`#quickSearchInput`) | [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) (lọc thẻ phim tức thì) | Lọc DOM Client-side |
| **Chuông thông báo** | Icon chuông có chấm đỏ, bấm mở danh sách thông báo | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L60-L80) (`#notifBtn`) | [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) (bật tắt dropdown) | Tĩnh |
| **Góc phải: Chưa login** | 2 nút `Đăng nhập` và `Đăng ký` | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L98-L103) (`.auth-nav-group`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) | `!user` |
| **Góc phải: Đã login** | Avatar tròn, bấm xổ menu: Tên user, email, Phim đã lưu, Đăng xuất | [`views/partials/header.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/header.ejs#L83-L97) (`#userAvatarBtn`) | [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) (toggle dropdown) | Middleware `checkUser` truyền `user` |

---

### 🖥️ Khu vực 2: Trang Chủ (Homepage - `/`)
| Vị trí trên màn hình | Giao diện hiển thị | File View phụ trách | File CSS / JS xử lý | Controller / Service |
| :--- | :--- | :--- | :--- | :--- |
| **Banner Hero Slider** | Khung phim lớn: Ảnh nền 4K zoom chậm, Title Logo PNG hoặc tiêu đề chữ, mô tả, nút `PLAY`, nút `+ MY LIST` | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs#L24-L83) (`.hero`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.hero-slide`, `.hero-bg`) & [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) | [`controllers/movieController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/movieController.js) + [`services/tmdbService.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/services/tmdbService.js) (`getMovieLogo`) |
| **Thumbnail chọn slide** | 5 ô ảnh nhỏ góc phải dưới banner kèm thanh tiến trình chạy 8 giây | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs#L73-L81) (`.hero-thumbs`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.hero-thumb-bar` animation `fill`) | `ui-interactions.js` đếm thời gian `pause/resume` |
| **Hàng phim Đề xuất** | Băng chuyền cuộn ngang các phim thịnh hành kèm 2 nút mũi tên trái/phải | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs#L96-L111) (`.row`) | [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) (`track.scrollBy()`) | `tmdbService.getPopularMovies()` |
| **Hàng phim Top 10** | Dãy số xếp hạng 1-10 kích thước lớn phía sau poster dọc | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs#L113-L134) (`.rank-card`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.rank-num`) | Cắt 10 phim đầu từ danh sách |
| **Các hàng Thể loại** | Hàng Hành Động, Viễn Tưởng, Kinh Dị, Hoạt Hình, Lãng Mạn | [`views/pages/index.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/index.ejs#L170-L190) | [`views/partials/movieCard.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/movieCard.ejs) | `tmdbService.getMoviesByGenre(id)` |
| **Thẻ phim đơn lẻ** | Ảnh bìa, bóng đen mờ, nút Play tròn, tên phim, điểm IMDb, icon Bookmark | [`views/partials/movieCard.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/partials/movieCard.ejs) (`.m-card`) | [`public/js/favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js) (bắt click `.favorite-btn`) | Dữ liệu từng object `movie` |

---

### 🖥️ Khu vực 3: Trang Chi Tiết Phim (Movie Detail - `/movies/:id`)
| Vị trí trên màn hình | Giao diện hiển thị | File View phụ trách | File CSS / JS xử lý | Controller / Service |
| :--- | :--- | :--- | :--- | :--- |
| **Hero chi tiết** | Ảnh nền mờ rộng toàn màn hình, Poster dọc, Nút `< Quay lại` | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L8-L23) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.detail-hero`) | [`controllers/movieController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/movieController.js) (`getMovieDetail`) |
| **Thông tin chi tiết** | Tên gốc, Tên tiếng Việt, Năm, Thời lượng (h m), Điểm ⭐, Tags thể loại, Mô tả nội dung | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L25-L73) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.genre-pill`) | `tmdbService.getMovieDetail(movieId)` |
| **Bộ nút hành động** | Nút `XEM NGAY` (cuộn xuống player), Nút `+ MY LIST`, Nút `Trailer (SOON)` | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L49-L67) | [`public/js/favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js) | Gắn sẵn metadata vào data-attributes |
| **Bảng chọn Server** | Nút `Server 1 · Vietsub` và nút `Server 2 · Bản gốc` | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L81-L90) | Inline script `switchServer(url, btn)` trong `movieDetail.ejs` | Controller tính toán `ophimLink` & `vidsrcLink` |
| **Trình phát Video Player** | Thẻ `<iframe>` phát phim tỉ lệ chuẩn 16:9 | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L93-L105) (`#mainPlayer`) | Thuộc tính allowfullscreen, autoplay | Tự động ưu tiên link Vietsub nếu tìm thấy |

---

### 🖥️ Khu vực 4: Trang Danh Sách Yêu Thích (My List - `/favorites`)
| Vị trí trên màn hình | Giao diện hiển thị | File View phụ trách | File CSS / JS xử lý | Controller / Service |
| :--- | :--- | :--- | :--- | :--- |
| **Tiêu đề trang** | Icon bookmark, Tiêu đề "My List" và câu giới thiệu | [`views/pages/favorites.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/favorites.ejs#L1-L5) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.page-head`) | Tĩnh |
| **Lưới phim đã lưu** | Hiển thị tất cả thẻ phim người dùng đã bookmark | [`views/pages/favorites.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/favorites.ejs#L15-L20) (`#favoritesGrid`) | [`public/js/favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js) (bỏ bookmark -> tự animate xoá thẻ) | [`controllers/favoriteController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/favoriteController.js) (`Favorite.find({ userId })`) |
| **Màn hình danh sách trống** | Icon rỗng + Thông báo "Danh sách của bạn đang trống" + Nút "Khám phá phim" | [`views/pages/favorites.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/favorites.ejs#L21-L28) (`#emptyFavorites`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.empty-state`) | Tự động hiện khi `movies.length === 0` |

---

### 🖥️ Khu vực 5: Trang Đăng Nhập & Đăng Ký (`/login` & `/register`)
| Vị trí trên màn hình | Giao diện hiển thị | File View phụ trách | File CSS / JS xử lý | Controller / Middleware |
| :--- | :--- | :--- | :--- | :--- |
| **Hộp đăng nhập (Card)** | Khung nền kính tối, ô Username/Email, Mật khẩu, Nút "Đăng Nhập" | [`views/pages/login.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/login.ejs) (`.auth-card`) | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) (`.auth-container`) | [`controllers/authController.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/controllers/authController.js) (`postLogin`) |
| **Thông báo lỗi form** | Khung màu đỏ cam chứa icon ⚠️ và thông báo lỗi nhập liệu | `login.ejs` (#L8) & `register.ejs` (#L8) | [`.auth-alert.error`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) | Render biến `error` truyền từ controller |
| **Tham số chuyển hướng** | Input ẩn `<input type="hidden" name="redirect">` | `login.ejs` (#L16) & `register.ejs` (#L16) | Ghi nhớ trang người dùng vừa đứng trước khi bị bắt login | Helper `sanitizeRedirectUrl` chống lỗi bảo mật |

---

## 4. CÁC PHÂN HỆ KỸ THUẬT TRỌNG TÂM

### 4.1. Hệ thống Streaming Đa Server & Tự động Fallback
Hệ thống giải quyết bài toán: **TMDB có thông tin và ảnh chất lượng cao nhưng không có video full; OPhim có Vietsub nhưng không dùng chung ID với TMDB.**

```
[Khách bấm xem phim]
        │
        ▼
Lấy ID TMDB ───➔ Gọi TMDB lấy chi tiết: movie.original_title & movie.title
        │
        ├─────────────────────────────────────────┐
        │                                         │
        ▼                                         ▼
Tạo link dự phòng VidSrc (Server 2):      Tìm kiếm Vietsub trên OPhim (Server 1):
https://vidsrc.me/embed/movie?tmdb={id}   1. Tìm theo original_title (VD: "Deadpool")
                                          2. Nếu không thấy ➔ Tìm theo movie.title
                                          3. Lấy slug ➔ Trích xuất link_embed tập 1
        │                                         │
        └────────────────────┬────────────────────┘
                             │
                             ▼
              Đóng gói truyền sang View:
       - ophimLink: Link Vietsub (hoặc null nếu không tìm thấy)
       - vidsrcLink: Link bản gốc tiếng Anh (dự phòng luôn chạy)
                             │
                             ▼
      Giao diện phát: iframe ưu tiên ophimLink ➔ Nếu null thì tự phát vidsrcLink
```

- **Đổi nguồn không cần tải lại trang:** Hàm `switchServer(url, btn)` trong [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs#L112) gán trực tiếp URL mới vào `iframe.src`, giúp người dùng đổi nguồn phim tức thì trong 0.1 giây.

---

### 4.2. Hệ thống Xác thực & Phân quyền (Auth & Security)
- **Mật khẩu an toàn:** Được tự động băm (hash) bằng thư viện `bcryptjs` với độ muối (salt) 10 thông qua hook `pre('save')` trong [`models/userModel.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/models/userModel.js#L56). Khi xuất dữ liệu ra JSON, trường `password` tự động bị ẩn.
- **Phiên đăng nhập JWT + Cookie HttpOnly:**
  - Sau khi đăng nhập thành công, máy chủ tạo chuỗi JWT chứa `{ id, username }` có hạn 7 ngày.
  - Gắn vào cookie mang tên `cineverse_token` với cờ `httpOnly: true` (ngăn chặn đánh cắp token qua mã độc XSS phía Client) và `sameSite: 'lax'`.
- **Middleware phân quyền thông minh:**
  - [`checkUser`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js#L25): Chạy cho **tất cả** các request. Nếu có cookie hợp lệ, nạp user vào `req.user` và `res.locals.user` để Header/Footer tự biết là khách hay đã đăng nhập.
  - [`requireAuth`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js#L83): Chặn các trang hoặc API nhạy cảm (`/favorites`, `/api/favorites/*`). Nếu là gọi API (AJAX/Fetch) thì trả về mã `401 JSON`. Nếu là duyệt web thì tự chuyển hướng sang `/login?redirect=...`.
- **Chống lỗi Open-Redirect:** Hàm `sanitizeRedirectUrl` chỉ chấp nhận URL nội bộ bắt đầu bằng dấu `/`, loại bỏ các URL độc hại trỏ ra ngoài tên miền.

---

### 4.3. Hệ thống Danh sách Yêu thích (Favorites & Optimistic UI)
- **Cơ sở dữ liệu MongoDB:** Model [`models/favoriteModel.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/models/favoriteModel.js) lưu `userId` và `movieId`. Thiết lập Compound Index Unique `{ userId: 1, movieId: 1 }` đảm bảo một người không thể lưu trùng 1 bộ phim 2 lần.
- **Trải nghiệm Optimistic UI (Phản hồi tức thì):**
  - Trong [`public/js/favorite.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/favorite.js): Khi người dùng bấm vào biểu tượng bookmark/ngôi sao, giao diện lập tức đổi màu sáng/tối ngay lập tức mà không cần đợi API mạng phản hồi.
  - Nếu API trả về thành công: Cập nhật lại số lượng trên Badge Header và hiện thông báo Toast.
  - Nếu phát hiện người dùng chưa đăng nhập (mã 401) hoặc lỗi mạng: Nút bấm tự động hoàn tác (revert) về trạng thái ban đầu và hiện Toast thông báo yêu cầu đăng nhập.

---

### 4.4. Hệ thống Hero Banner & Cơ chế Chống Giật (Anti-Jitter)
Đây là phần tinh chỉnh giao diện quan trọng nhất để đạt chất lượng Streaming mượt mà 60fps:
1. **Triệt tiêu Layout Reflow:**
   - Trong [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css#L583), thanh tiến trình thời gian ở thumbnail được tối ưu:
     ```css
     /* KHÔNG DÙNG: width: 0% -> 100% (làm CPU tính lại layout liên tục gây giật) */
     /* DÙNG CHUẨN: transform GPU */
     .hero-thumb-bar {
         width: 100%;
         transform: scaleX(0);
         transform-origin: left;
         will-change: transform; /* Ép card đồ họa GPU xử lý */
     }
     @keyframes fill { to { transform: scaleX(1); } }
     ```
2. **Khung ảnh phóng to mượt mà (Anti-aliasing):**
   - Đặt `inset: -5%`, `width: 110%`, `height: 110%` nới rộng viền ảnh ra ngoài màn hình.
   - Thay `@keyframes kenBurns` bằng `transform: translate3d(0, 0, 0) scale(1.08)` với `transition: transform 12s cubic-bezier(0.1, 0.2, 0.3, 1)`. Tránh hiện tượng răng cưa và rung giật khung hình khi hiển thị ảnh chất lượng cao.
3. **Cơ chế Pause / Resume không reset slide:**
   - Trong [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js#L95): Viết thuật toán tính `remaining` (thời gian còn lại). Khi chuột rời khỏi banner (`mouseleave`), timer tiếp tục đếm từ giây hiện tại, **tuyệt đối không gọi lại hàm `go(current)`** gây nảy chữ và giật slide.

---

## 5. CẨM NANG BẮT BỆNH & KHẮC PHỤC SỰ CỐ (TROUBLESHOOTING MATRIX)

> **Khi gặp lỗi trên màn hình hoặc terminal, tra cứu bảng này để xử lý ngay:**

| Triệu chứng nhìn thấy (Symptom) | Nguyên nhân cốt lõi (Root Cause) | File liên quan | Cách xử lý dứt điểm |
| :--- | :--- | :--- | :--- |
| **Trang chủ trống trơn, hiện icon chảo vệ tinh kèm dòng chữ "Không tải được danh sách phim"** | Khóa `TMDB_TOKEN` trong `.env` bị thiếu hoặc mang giá trị placeholder mẫu (`your_tmdb_bearer_token_here`), dẫn tới TMDB trả về mã lỗi 401. | [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env) | Mở file `.env`, dán Bearer Token TMDB hợp lệ bắt đầu bằng `eyJhbGciOi...` vào dòng `TMDB_TOKEN`. Khởi động lại server. |
| **Terminal báo lỗi: `Error: Cannot find module 'cookie-parser'` hoặc `bcryptjs` / `jsonwebtoken`** | Vừa chuyển branch hoặc pull code mới có bổ sung thư viện mới nhưng chưa cài đặt vào `node_modules` máy cục bộ. | [`package.json`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/package.json) | Mở terminal gõ: `npm install` |
| **Banner Hero Slider bị giật nảy lên, chữ chớp tắt mỗi khi di chuột vào hoặc ra khỏi banner** | File CSS bị mất thuộc tính `scaleX` hoặc file JS bị gắn lệnh gọi `go(current)` ở sự kiện `mouseleave`. | [`public/css/style.css`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/css/style.css) & [`public/js/ui-interactions.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js) | Đảm bảo `.hero-thumb-bar` dùng `transform: scaleX(0)` và trong JS dùng hàm `pause()` / `resume()` như đã hướng dẫn ở Mục 4.4. |
| **Bấm vào ngôi sao / bookmark thẻ phim nhưng không lưu được, hiện Toast màu đỏ báo lỗi** | Người dùng chưa đăng nhập tài khoản (Server trả về mã 401 Unauthorized theo chính sách bảo mật). | [`middlewares/authMiddleware.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js) | Bấm vào nút `Đăng nhập` trên Header hoặc link trên Toast để đăng nhập tài khoản trước khi lưu phim. |
| **Chạy lệnh `npm run lint` bị báo đỏ hàng loạt: `'document' is not defined` hoặc `'window' is not defined`** | Cấu hình ESLint áp đặt môi trường Node.js cho toàn bộ dự án mà quên cấp quyền `globals.browser` cho thư mục `public/`. | [`eslint.config.mjs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/eslint.config.mjs) | Cấu hình thêm `{ files: ["public/**/*.js"], languageOptions: { globals: globals.browser } }` trong `eslint.config.mjs`. |
| **Terminal Git báo: `CONFLICT (content): Merge conflict in views/pages/movieDetail.ejs`** | Xảy ra khi gộp code (merge/pull) giữa các nhánh có cùng chỉnh sửa ở trang chi tiết phim. | [`views/pages/movieDetail.ejs`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/views/pages/movieDetail.ejs) | Chạy lệnh `git checkout --theirs views/pages/movieDetail.ejs` để lấy bản của `main`, sau đó `git add .` và `git commit`. |
| **Video Server 1 (Vietsub) không hiển thị nút hoặc báo không tìm thấy tập phim** | Phim này trên kho OPhim chưa có bản dịch hoặc phim quá mới. | [`services/ophimService.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/services/ophimService.js) | Cơ chế Fallback đã tự động chuyển sang `Server 2 · Bản gốc` (VidSrc), người dùng vẫn xem được bình thường. |
| **Đăng ký tài khoản mới báo lỗi: "Tên người dùng này đã có người sử dụng" hoặc "Email đã được đăng ký"** | Vi phạm ràng buộc duy nhất (Unique index) trong CSDL MongoDB. | [`models/userModel.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/models/userModel.js) | Nhập tên người dùng hoặc địa chỉ email khác chưa từng đăng ký. |
| **MongoDB báo lỗi kết nối: `❌ Lỗi kết nối MongoDB: connect ECONNREFUSED 127.0.0.1:27017`** | Dịch vụ MongoDB cục bộ trên máy chưa được khởi chạy. | [`config/db.js`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/config/db.js) | Bật MongoDB Compass hoặc chạy lệnh khởi động `mongod` / Service MongoDB trên Windows Services. |

---

## 6. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY DỰ ÁN

### Yêu cầu tiên quyết:
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị bản LTS).
- **MongoDB**: Đã cài đặt MongoDB Community Server hoặc có kết nối MongoDB Atlas Cloud.

### Các bước cài đặt:

1. **Cài đặt toàn bộ thư viện phụ thuộc:**
   ```bash
   npm install
   ```

2. **Cấu hình file biến môi trường [`.env`](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/.env):**
   Tạo file `.env` tại thư mục gốc của dự án với các thông số mẫu:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/cineverse
   JWT_SECRET=cineverse_super_secret_jwt_key_2026_xyz
   TMDB_BASE_URL=https://api.themoviedb.org/3
   TMDB_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMzQxMTg5ZWRiMWNjYjY1OTY3OTUxMDM4NGQ4NTA1YiIsIm5iZiI6MTc5MTc3NjY1NC4xMiwic3ViIjoiNmFjYzU3OGU1NTcyOTZkNDFjYmZiZWI1Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.cWN6Lt6HkDonhYzgPM16Smi79mxj_Jl3SqpvZJpaLaU
   OPHIM_BASE_URL=https://ophim1.com
   ```

3. **Chạy ứng dụng trong môi trường phát triển (Tự động tải lại khi sửa code):**
   ```bash
   npm run dev
   ```

4. **Truy cập ứng dụng:**
   Mở trình duyệt web và truy cập địa chỉ: [http://localhost:5000](http://localhost:5000)

---

## 7. QUY CHUẨN KIỂM TRA CODE (LINTING & CODE QUALITY)

Dự án áp dụng bộ quy tắc kiểm tra cú pháp hiện đại nhất của **ESLint v10** (Flat Config `eslint.config.mjs`):
- Kiểm tra toàn bộ mã nguồn:
  ```bash
  npm run lint
  ```
- **Quy tắc vàng:**
  - Code Node.js tầng Backend chạy với môi trường `globals.node`.
  - Code JavaScript tầng Client trong thư mục `public/` chạy với môi trường `globals.browser`.
  - Các biến trong khối `catch` nếu không sử dụng phải đặt tiền tố dấu gạch dưới (VD: `_err`).
  - Dự án phải luôn đảm bảo kết quả: **0 errors, 0 warnings** trước khi tạo Pull Request gộp code.

---

*Tài liệu được tổng hợp và chuẩn hoá toàn diện cho dự án CineVerse (Web Nâng Cao - 2026).*