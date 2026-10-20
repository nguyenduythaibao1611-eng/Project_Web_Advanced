npm init -y
npm install express ejs express-ejs-layouts dotenv cors mongoose axios @google/generative-ai
npm install -D nodemon


cineverse/
├── config/
│   └── db.js                       # Kết nối MongoDB (Mongoose)
│
├── controllers/
│   ├── movieController.js          # Xử lý render trang chủ, chi tiết phim (đa server TMDB/OPhim/VidSrc), tìm kiếm, trailer
│   ├── assistantController.js      # Xử lý yêu cầu gợi ý phim từ AI (trả JSON)
│   └── favoriteController.js       # Xử lý thêm/xóa/lấy danh sách phim yêu thích
│
├── models/
│   ├── favoriteModel.js            # Schema lưu phim yêu thích vào MongoDB
│   └── chatLogModel.js             # Schema lưu lịch sử chat AI (nếu nhóm làm thêm)
│
├── routes/
│   ├── index.js                    # Gom toàn bộ route lại một nơi
│   ├── movieRoutes.js              # Định nghĩa các URL: /, /movies/:id, /search
│   ├── assistantRoutes.js          # Định nghĩa URL: POST /api/assistant/recommend
│   └── favoriteRoutes.js           # Định nghĩa URL: /api/favorites
│
├── services/
│   ├── tmdbService.js              # Gọi TMDB API (trending, popular, search, detail, videos)
│   ├── ophimService.js             # Gọi OPhim / PhimAPI (tìm kiếm nguồn phim, lấy link embed & streaming Vietsub)
│   └── geminiService.js            # Gọi Google Gemini API để phân tích yêu cầu & gợi ý
│
├── middlewares/
│   ├── errorHandler.js             # Bắt lỗi toàn cục và render trang thông báo lỗi
│   └── validateMiddleware.js       # Kiểm tra dữ liệu đầu vào (query, body)
│
├── utils/
│   ├── formatMovie.js              # Format link ảnh TMDB (backdrop, poster), ngày tháng
│   └── cleanJson.js                # Xử lý chuỗi JSON trả về từ Gemini
│
├── views/                          # TOÀN BỘ FILE GIAO DIỆN (.ejs)
│   ├── layouts/
│   │   └── main.ejs                # Khung HTML gốc (thẻ <html>, <head>, nhúng CDN GSAP/Tailwind, header, footer)
│   │
│   ├── partials/                   # Các khối giao diện tái sử dụng
│   │   ├── header.ejs              # Thanh navbar (logo, ô tìm kiếm nhanh, nút AI)
│   │   ├── footer.ejs              # Chân trang thông tin nhóm và bản quyền
│   │   ├── movieCard.ejs           # Component thẻ phim (poster, tên, điểm đánh giá, nút yêu thích)
│   │   ├── aiModal.ejs             # Hộp thoại popup trợ lý AI chat
│   │   └── trailerModal.ejs        # Popup iframe phát trailer phim
│   │
│   └── pages/                      # Các trang hiển thị chính
│       ├── index.ejs               # Trang chủ (banner hero, danh sách trending, popular)
│       ├── movieDetail.ejs         # Trang chi tiết phim (mô tả, diễn viên, video trailer, phim tương tự)
│       ├── search.ejs              # Trang kết quả tìm kiếm và bộ lọc (năm, thể loại, điểm)
│       ├── favorites.ejs           # Trang hiển thị danh sách phim đã lưu
│       └── error.ejs               # Trang hiển thị khi gặp lỗi 404 hoặc 500
│
├── public/                         # FILE TĨNH & JAVASCRIPT PHÍA CLIENT (.js, .css)
│   ├── css/
│   │   └── style.css               # Tùy chỉnh CSS thêm
│   └── js/
│       ├── main.js                 # GSAP animations (hiệu ứng cuộn, hover poster, chuyển cảnh)
│       ├── chat.js                 # Xử lý gửi câu hỏi chat AI, nhận JSON và render kết quả vào popup
│       ├── trailer.js              # Xử lý mở modal trailer và nhúng video YouTube
│       └── favorite.js             # Xử lý click nút thả tim/lưu phim vào danh sách yêu thích
│
├── local-docs/                     # Thư mục tài liệu nội bộ (đã cấu hình .gitignore)
│   └── Luồng-API.md                # Tài liệu giải thích kiến trúc MVC và luồng gọi API
│
├── app.js                          # Cấu hình Express, View engine EJS, Static public
├── server.js                       # Điểm chạy máy chủ, kết nối DB, lắng nghe PORT
├── .env                            # Biến môi trường (PORT, TMDB_TOKEN, OPHIM_BASE_URL,...)
├── .env.example                    # Mẫu cấu hình biến môi trường
├── .gitignore                      # Danh sách file/thư mục bỏ qua khi commit Git
├── package.json                    # Cấu hình dự án và danh sách dependencies
├── package-lock.json               # Khóa phiên bản chi tiết của các dependencies
└── README.md                       # Tài liệu hướng dẫn dự án