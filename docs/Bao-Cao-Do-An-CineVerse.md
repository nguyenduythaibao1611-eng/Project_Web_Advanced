# 🎓 BÁO CÁO TỔNG KẾT & BẢO VỆ ĐỒ ÁN MÔN HỌC: NỀN TẢNG STREAMING PHIM ĐIỆN ẢNH CINEVERSE

> **TÀI LIỆU BÁO CÁO CHÍNH THỨC TRƯỚC HỘI ĐỒNG / GIẢNG VIÊN HƯỚNG DẪN**  
> **Môn học:** Lập trình Web Nâng Cao (Advanced Web Development)  
> **Dự án:** CineVerse — High-Performance Cinematic Streaming Platform  
> **Ngày báo cáo chính thức:** 07/11/2026  
> **Sinh viên thực hiện / Trưởng nhóm:** Nguyễn Duy Thái Bảo  
> **Trạng thái nghiệm thu:** **HOÀN THÀNH 100% TOÀN BỘ CÁC HẠNG MỤC (PHASE 1 - PHASE 9)**  
> **Mã nguồn Repository:** `feature/onboarding-payment-cloud` (Đã đồng bộ với nhánh `main`)

---

## 📌 TÓM TẮT TỔNG THỂ DỰ ÁN (EXECUTIVE SUMMARY)

Dự án **CineVerse** là một nền tảng xem phim trực tuyến (Video Streaming Platform) hiện đại, hoàn chỉnh theo mô hình kiến trúc **MVC-Service (Model-View-Controller-Service)**. Dự án giải quyết triệt để bài toán phụ thuộc vào API bên thứ ba bằng cách tự chủ hoàn toàn kho dữ liệu nội bộ trên **MongoDB Atlas Cloud**, tối ưu hóa trải nghiệm xem phim với hạ tầng **Đa Máy Chủ phát luồng HLS**, trình phát căn giữa chuẩn tỉ lệ rạp điện ảnh 16:9, hệ thống **chọn tập thông minh phân tab 50 tập/lần**, cơ chế **Freemium & VIP Paywall tích lũy 5 phút**, cổng thanh toán tự động **VietQR qua SePay**, đồng hồ đếm ngược thời hạn VIP thời gian thực **`👑 DD:HH:MM`**, phân hệ **Admin Workspace toàn diện thuần MongoDB** và bộ kiểm thử tự động đạt **tỷ lệ vượt qua tuyệt đối 46/46 tests (100% PASS)**.

### 🌟 Bảng chỉ số kỹ thuật và kết quả nghiệm thu trọng yếu:

| Chỉ số kỹ thuật & Nghiệp vụ | Kết quả thực tế đạt được | Ý nghĩa thực tiễn & Giá trị kỹ thuật |
| :--- | :---: | :--- |
| **Quy mô kho phim nội bộ** | **355+ bộ phim** | Lưu trữ trên MongoDB Atlas, truy vấn tức thì (< 200ms), không phụ thuộc API ngoài |
| **Độ phủ dữ liệu chuẩn TMDB** | **353 / 355 phim (99.4%)** | Đầy đủ poster 4K, backdrop điện ảnh, điểm đánh giá, số phiếu bầu và nội dung chuẩn quốc tế |
| **Phim bộ có danh sách tập** | **122 bộ phim** | Có từ 10 đến 555 tập; giao diện phân tab 50 tập/lần tối ưu DOM, Zero Reload |
| **Hạ tầng Đa Máy Chủ** | **2 - 3 Server / phim** | **Server 1** (OPhim Vietsub luồng HLS `.m3u8`) + **Server 2** (NguonC StreamC dự phòng) |
| **Bố cục Trình phát Điện ảnh** | **Chuẩn tỷ lệ rạp 16:9** | Căn giữa tuyệt đối màn hình (`margin: 0 auto; max-width: calc(78vh * 16 / 9)`), tự co giãn đa thiết bị |
| **Cơ chế Khóa VIP Paywall** | **5 phút (300s) tích lũy** | Phim thường xem 100% thời lượng; phim VIP khóa sau 5s tích lũy, chống lách luật bằng tua hoặc đổi tập |
| **Cổng thanh toán tự động** | **VietQR + SePay Webhook** | Sinh mã QR NAPAS kèm cú pháp chuyển khoản `SEV...`, Webhook đối soát tự động, Polling 2s |
| **Quy trình Thanh toán mượt mà** | **Nút "Kiểm tra thanh toán"** | Đếm ngược 5s tự động chuyển về trang chủ (`/`) khi thành công; cảnh báo chưa thanh toán tự ẩn sau 5s |
| **Đồng hồ VIP thời gian thực** | **`👑 DD:HH:MM`** | Đếm ngược từng giây trên Header và Menu tài khoản; tự động giáng cấp khi hết hạn qua middleware |
| **Admin Cấp VIP Động** | **Quản lý theo gói cước** | Cấp VIP dựa trên collection `VipPlan`, tự cộng dồn ngày, hỗ trợ VIP vĩnh viễn, không hardcode |
| **Lưu trữ CDN hình ảnh** | **Supabase Storage CDN** | Tải ảnh cực nhanh qua CDN toàn cầu, loại trừ 100% nguy cơ link die / lỗi 404 |
| **Bảo mật phiên đăng nhập** | **1 Tài khoản / 1 Thiết bị** | JWT HttpOnly Cookie + Active Session ID hủy phiên cũ + Session CSRF Token HMAC-SHA256 |
| **Bộ kiểm thử tự động (Unit Test)** | **46 / 46 tests PASS (100%)** | Kiểm thử tự động từ Auth, Admin, VIP, Thanh toán, Onboarding, WatchHistory đến Search |
| **Tiêu chuẩn cú pháp (ESLint)** | **0 errors, 0 warnings** | Tuân thủ nghiêm ngặt tiêu chuẩn ECMAScript & Clean Architecture |

---

## 🏗️ 1. KIẾN TRÚC HỆ THỐNG TOÀN DIỆN (SYSTEM ARCHITECTURE)

Hệ thống được thiết kế theo kiến trúc phân tầng chuyên biệt, tách biệt rõ ràng giữa tầng hiển thị (Presentation Layer), tầng bảo mật (Security Layer), tầng nghiệp vụ (Business Logic Layer), tầng dịch vụ nền (Background Workers & Payment) và tầng lưu trữ dữ liệu (Data & Storage Layer).

```mermaid
flowchart TD
    UserClient(["Client (Trình duyệt Web / Mobile)"]) --> ExpressApp["Express Application & Middleware Pipeline"]

    subgraph SecurityLayer ["Tầng Bảo Mật & Kiểm Soát Phiên (Security Pipeline)"]
        ExpressApp --> CookieParser["Cookie-Parser (HttpOnly JWT Token)"]
        CookieParser --> SingleSession["Bảo vệ 1 Thiết bị / 1 Tài khoản (Active Session ID)"]
        SingleSession --> VIPAutoDemote["Middleware Kiểm tra & Giáng cấp VIP tự động khi hết hạn"]
        VIPAutoDemote --> CSRFProtect["Bảo vệ CSRF theo Session (HMAC-SHA256)"]
        CSRFProtect --> RoleRBAC["Phân quyền theo vai trò (Guest / User / VIP / Admin)"]
    end

    subgraph BusinessLayer ["Tầng Nghiệp Vụ Ứng Dụng (MVC-Service)"]
        RoleRBAC --> MC["movieController: Trang chủ, Chi tiết, Đề xuất, Tìm kiếm"]
        RoleRBAC --> AC["adminController: Quản trị Phim, Users, Cấp VIP Động, Audit Logs"]
        RoleRBAC --> PC["paymentController: Bảng giá /pricing, VietQR, SePay Webhook, Polling"]
        RoleRBAC --> HC["watchHistoryController: Tiếp tục xem, Lưu tọa độ giây, Resume"]
        RoleRBAC --> UC["authController: Đăng ký, Đăng nhập, Onboarding khảo sát"]
        RoleRBAC --> LC["libraryController: Thư viện phim MongoDB Atlas"]
    end

    subgraph PaymentEngine ["Cổng Thanh Toán & Đồng Bộ Hóa Thời Hạn VIP"]
        PC --> VietQRService["VietQR API: Sinh mã QR động chuẩn NAPAS kèm mã SEV..."]
        PC --> SePayHook["SePay Webhook Endpoint (POST /api/payment/sepay-webhook)"]
        PC --> CheckOrder["Polling & Nút 'Kiểm tra thanh toán' (5s Auto-Redirect về Trang Chủ)"]
        VietQRService --> DynamicVIP["Cộng dồn ngày sử dụng vipExpiresAt vào UserModel"]
    end

    subgraph MultiServerPlayer ["Trình Phát Đa Máy Chủ Căn Giữa 16:9 (Player Engine)"]
        MC --> PlayerEngine["public/js/playerEngine.js (Module Độc Lập)"]
        PlayerEngine --> Center169["Khung phát Căn giữa chuẩn rạp 16:9 (margin: 0 auto; max-width 78vh*16/9)"]
        Center169 --> S1["[Server 1] OPhim Vietsub (Luồng m3u8 phát qua HLS.js)"]
        Center169 --> S2["[Server 2] NguonC Dự Phòng (Embed qua streamc.xyz)"]
        PlayerEngine --> TabbedSelector["Lưới chọn tập phân tab 50 tập (Tối ưu DOM, Zero Reload)"]
        PlayerEngine --> PaywallLogic["Khóa 5 phút VIP Paywall tích lũy (totalVipWatchSeconds)"]
        PlayerEngine --> SyncHistory["Beacon / API lưu tọa độ giây theo từng tập"]
    end

    subgraph DataStorageLayer ["Tầng Cơ Sở Dữ Liệu & Lưu Trữ Đám Mây"]
        BusinessLayer --> MongoAtlas[("MongoDB Atlas Cluster<br/>(Movies, Users, Orders, VipPlans, History, AdminLogs)")]
        BusinessLayer --> SupabaseCDN[("Supabase Storage CDN<br/>(Posters, Backdrops 4K, Avatars)")]
    end

    subgraph WorkerJobs ["Tác Vụ Ngầm Tự Động Hóa (Automation Workers)"]
        WorkerJobs --> SyncTop10["Worker đồng bộ Top 10 TMDB mỗi 12 giờ (syncTop10TMDB.js)"]
        WorkerJobs --> CrawlTopRated["Worker cào 200 phim kinh điển TMDB (crawlTopRatedTMDB.js)"]
    end
```

---

## 💳 2. QUY TRÌNH THANH TOÁN VIETQR & NÂNG CẤP VIP TỰ ĐỘNG

Dưới đây là sơ đồ luồng dữ liệu của phân hệ thanh toán trực tuyến VietQR và cơ chế kiểm tra thanh toán mượt mà:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Web as Trình duyệt (CineVerse Client)
    participant Server as CineVerse Server (Express)
    participant DB as MongoDB Atlas
    participant Bank as Ngân hàng / SePay Gateway

    User->>Web: Truy cập /pricing và chọn gói VIP (ví dụ: Gói 30 ngày)
    Web->>Server: POST /api/payment/create-order { planCode: "VIP30" }
    Server->>DB: Tạo bản ghi Order (status: "pending", orderCode: "SEV...", amount: 49000)
    Server-->>Web: Trả về orderCode và VietQR URL (kèm số tài khoản, số tiền, cú pháp)
    Web->>User: Mở Payment Modal hiển thị mã VietQR & Nút "Kiểm tra thanh toán"

    User->>Bank: Quét mã VietQR và chuyển tiền qua App Ngân hàng
    Bank->>Server: POST /api/payment/sepay-webhook (Dữ liệu giao dịch thật)
    Server->>DB: Kiểm tra số tiền & Cập nhật Order (status: "completed")
    Server->>DB: Nâng cấp user.isVip = true, cộng dồn vipExpiresAt (+30 ngày)
    Server-->>Bank: 200 OK (Webhook thành công)

    par Luồng Polling nền (mỗi 2s) & Nút Kiểm tra chủ động
        User->>Web: Bấm nút "Kiểm tra thanh toán" (hoặc chờ Polling 2s)
        Web->>Server: GET /api/payment/check-status/:orderCode
        Server-->>Web: { success: true, isPaid: true, user: { isVip: true, vipExpiresAt: "..." } }
    end

    Web->>User: Đổi trạng thái: "Thanh toán thành công! Tự động chuyển về trang chính sau 5 giây..."
    Note over Web,User: Đếm ngược: 5s ➔ 4s ➔ 3s ➔ 2s ➔ 1s ➔ window.location.href = '/'
    User->>Web: Về Trang chủ: Header hiển thị ngay đồng hồ VIP đếm ngược 👑 29:23:59
```

---

## 🚀 3. CHI TIẾT TOÀN BỘ CÁC HẠNG MỤC HOÀN THIỆN (PHASE 1 - PHASE 9)

### 3.1. Phase 1 & 2: Hạ tầng Dữ liệu, Xác thực & Kho phim Độc quyền 355+ Phim
* **Bảo mật phiên đăng nhập hiện đại:**
  * JWT được lưu trong Cookie `HttpOnly`, ngăn ngừa tuyệt đối nguy cơ bị đánh cắp token qua tấn công XSS.
  * Tích hợp cơ chế **Active Session ID** (duy nhất 1 phiên đăng nhập tại một thời điểm): Khi người dùng đăng nhập trên thiết bị mới, `activeSessionId` được cập nhật lại, phiên cũ trên thiết bị trước lập tức bị vô hiệu hóa.
* **Khảo sát cá nhân hóa người dùng (Onboarding Survey):**
  * Ngay sau khi đăng ký tài khoản mới, hệ thống điều hướng bắt buộc vào trang `/onboarding`.
  * Yêu cầu chọn từ 3 đến 5 thể loại phim yêu thích và độ tuổi để xây dựng hồ sơ sở thích cá nhân hóa.
* **Kho phim nội bộ độc lập thuần MongoDB Atlas (355+ phim):**
  * Chuyển đổi toàn diện từ gọi API bên thứ ba sang **truy vấn 100% từ MongoDB Atlas**.
  * Đợt 1: Cào 48 phim thử nghiệm.
  * Đợt 2: Cào 100 phim ưu tiên TMDB.
  * Đợt 3: Cào 200 phim Top Rated điểm cao nhất mọi thời đại từ TMDB (`GET /movie/top_rated`).
  * **Tổng quy mô hiện tại: 355+ bộ phim** với poster và backdrop 4K lưu trữ an toàn trên CDN Supabase Storage.

### 3.2. Phase 3: Phân hệ Quản trị Toàn Diện Thuần MongoDB (Admin Workspace)
* **Bảng điều khiển thống kê thực (Admin Dashboard):**
  * Lấy số liệu thời gian thực từ MongoDB: Tổng tài khoản, Quản trị viên, Thành viên VIP, Tài khoản bị chặn, Kho phim nội bộ và Lượt yêu thích.
* **Quản trị người dùng & Cấp VIP Động theo Gói cước (`/admin/users`):**
  * Hỗ trợ tìm kiếm theo tên, email; phân trang (20 user/trang); lọc theo vai trò (`user`, `admin`) hoặc trạng thái (`active`, `blocked`, `vip`).
  * **Cấp VIP động theo gói cước (`VipPlan`):** Admin chọn trực tiếp các gói cước đang kích hoạt trong hệ thống (Gói 30 ngày, 90 ngày, 365 ngày, Vĩnh viễn). Hệ thống tự động tính ngày cộng dồn nếu tài khoản đã có VIP, hoặc chuyển về tài khoản Thường khi chọn "Hủy VIP", hoàn toàn **không hardcode** bất kỳ giá trị nào trong mã nguồn.
  * Khóa / mở khóa tài khoản: Khi khóa tài khoản, `activeSessionId` lập tức bị xóa rỗng, buộc phiên đăng nhập của người đó bị đăng xuất ngay lập tức.
  * **Bảo vệ tài khoản quản trị:** Không cho phép sửa đổi hoặc tự khóa tài khoản admin qua giao diện web để tránh nguy cơ mất admin duy nhất.
* **Quản trị kho phim & Quản lý 100 tập phim (`/admin/movies`):**
  * Thêm mới, chỉnh sửa metadata, thể loại, diễn viên, đạo diễn và danh sách tối đa 100 tập phim (hỗ trợ cả luồng HLS m3u8 và iframe embed).
  * Cơ chế **Optimistic Concurrency Control (`__v`)**: Ngăn chặn tình trạng ghi đè dữ liệu khi nhiều quản trị viên cùng mở và lưu dữ liệu trên một bộ phim.
  * Upload ảnh poster và backdrop an toàn vào thư mục lưu trữ với cơ chế kiểm tra **Magic Bytes** (chỉ chấp nhận định dạng thực tế là PNG, JPEG, WebP) và giới hạn dung lượng 5 MB.
* **Nhật ký kiểm toán hệ thống (`/admin/logs`):**
  * Ghi lại chi tiết mọi hành vi quản trị: Người thực hiện, thời gian, đối tượng bị tác động, chi tiết thay đổi và địa chỉ IP.

### 3.3. Phase 4: Giao diện Người dùng Điện ảnh Chuẩn Disney+/Marvel Studios
* **Dark Mode phong cách Marvel & Disney+:**
  * Tông màu tối sâu huyền bí (#0b0f19, #131926) kết hợp dải sáng vàng kim điện ảnh (#fbbf24) và xanh ngọc neon (#38bdf8).
* **Hero Banner Slider chống giật (Smooth Pre-fade):**
  * Cơ chế chuyển slide mượt mà, hiển thị huy hiệu xu hướng `#1 Thịnh hành hôm nay`, nút xem ngay và nút lưu vào danh sách yêu thích.
* **Các hàng phim chuyên biệt trên Trang chủ:**
  * **Tiếp tục xem (Continue Watching):** Tự động nạp danh sách phim đang xem dở của tài khoản, hiển thị thanh tiến độ xem `%` và số phút còn lại chính xác.
  * **Top 10 phim hôm nay:** Đồng bộ tự động theo thời gian thực từ bảng xếp hạng thịnh hành TMDB với số thứ tự rank lớn `#1` đến `#10`.
  * **Hàng phim Đề xuất cho bạn, Đánh giá cao nhất, Mới ra mắt** và các hàng phim theo thể loại (*Hành động, Chính kịch, Hoạt hình, Viễn tưởng, Hài hước*).
* **Danh sách yêu thích (Favorites):** Thêm / gỡ phim yêu thích với cơ chế **Optimistic UI** (cập nhật biểu tượng trái tim tức thì mà không cần chờ mạng phản hồi).

### 3.4. Phase 5: Trình phát Đa Máy Chủ, Chọn Tập Phim Bộ & Bố cục Căn Giữa 16:9
* **Module Trình phát Độc lập ([public/js/playerEngine.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/playerEngine.js)):**
  * Tách biệt 100% logic player client ra khỏi file giao diện EJS, bảo vệ chống XSS bằng cách escape `\u003c` trong các thẻ JSON data nhúng.
* **Khung chiếu phim Căn Giữa Chuẩn Tỷ Lệ Rạp 16:9:**
  * `.player-wrapper`: Căn giữa tuyệt đối với `margin: 0 auto; max-width: calc(78vh * 16 / 9); width: 100%;`.
  * `.player-section`: Giới hạn chiều rộng tối đa 1440px căn giữa, tạo cảm giác như đang thưởng thức phim trong rạp chiếu chuyên nghiệp.
* **Hệ thống Chọn Tập Phân Trang 50 tập/tab (Episode Selector):**
  * Tự động nhận diện phim bộ (122 bộ phim) và hiển thị thanh tab thông minh: `1 - 50`, `51 - 100`, `101 - 150`...
  * Chỉ khởi tạo đúng 50 nút DOM của tab đang xem, đảm bảo trình duyệt chạy cực nhẹ dù phim có tới 555 tập.
  * Bấm chọn tập là đổi luồng phát ngay lập tức mà **không cần reload lại trang web**.
  * Chuyển đổi qua lại giữa Server 1 và Server 2 tự động giữ nguyên đúng tập đang xem dở.
* **Cơ chế Khóa 5 phút VIP Paywall Tích Lũy (Anti-Cheat VIP Paywall):**
  * **Phim Thường / Miễn phí (329+ phim):** Xem trọn vẹn 100% thời lượng, tua video tùy thích, không bao giờ bị khóa 5 phút.
  * **Phim Gắn Tag VIP (26 phim đặc quyền):** Người dùng tài khoản thường được xem thử 5 phút (300 giây).
  * Bộ đếm thời gian xem thực tế (`totalVipWatchSeconds`) cộng dồn trên toàn bộ các tập, ngăn chặn triệt để hành vi đổi tập hoặc tua lại từ đầu để lách luật.
* **Đồng bộ Lịch sử xem theo tập (Watch History & Resume):**
  * Tự động gửi tọa độ giây và tên tập về endpoint `POST /api/history` mỗi 12 giây và khi người dùng đóng/rời trang.
  * Khi mở lại phim, trình phát tự động nhận diện tập đang xem dở và hiển thị banner thông minh: *"Bạn đã xem đến mm:ss. Tiếp tục xem?"*.

### 3.5. Phase 6: Tác vụ Ngầm Tự động hóa Định kỳ (Automation Workers)
* **Worker tự động đồng bộ Top 10 TMDB ([scripts/syncTop10TMDB.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/scripts/syncTop10TMDB.js)):**
  * Tích hợp `setInterval` chạy ngầm trong `server.js` định kỳ mỗi 12 giờ một lần hoặc chạy theo yêu cầu qua lệnh `npm run sync:top10`.
  * Quét endpoint `GET /trending/movie/day`, tự động cập nhật thứ hạng vào MongoDB Atlas.
* **Worker cào 200 phim Top Rated TMDB ([scripts/crawlTopRatedTMDB.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/scripts/crawlTopRatedTMDB.js)):**
  * Lệnh chạy: `npm run crawl:top-rated`.
  * Thu thập dữ liệu 200 kiệt tác điện ảnh có điểm đánh giá cao nhất lịch sử từ TMDB.

### 3.6. Phase 7: Bộ Kiểm Thử Tự Động Toàn Diện (Unit Testing 100% PASS)
* Toàn bộ 46 ca kiểm thử tự động được xây dựng trực tiếp trên bộ kiểm thử chuẩn của Node.js (`node:test` và `node:assert/strict`), đảm bảo tốc độ thực thi siêu tốc (< 11 giây) và không phụ thuộc nặng nề vào các thư viện bên thứ ba.
* Độ bao phủ kiểm thử trải dài qua toàn bộ các tầng nghiệp vụ: Auth, Quản trị Admin, Kho phim TMDB, Khảo sát Onboarding, Thanh toán VietQR & Gói VIP, Tìm kiếm phim và Trình phát Video Đa máy chủ.

### 3.7. Phase 8: Cổng Thanh toán VietQR Tự động & Quản lý Gói VIP
* **Trang Bảng giá Gói cước (`/pricing`):**
  * Hiển thị bảng so sánh quyền lợi giữa tài khoản Thường và VIP.
  * Tự động nạp danh sách các gói cước VIP đang hoạt động từ collection `VipPlan` trong cơ sở dữ liệu.
* **Modal Thanh toán VietQR Chuẩn Ngân hàng:**
  * Sinh mã VietQR động theo chuẩn NAPAS tích hợp số tài khoản, tên chủ thẻ, số tiền và nội dung chuyển khoản độc nhất `SEV<ORDER_CODE>`.
* **Nút "Kiểm tra thanh toán" & Trải nghiệm Đếm ngược 5 giây:**
  * Người dùng có thể chủ động bấm nút **"Kiểm tra thanh toán"** sau khi quét mã ngân hàng.
  * **Trường hợp đã thanh toán thành công:** Hiển thị thông báo màu xanh ngọc đẹp mắt: *"Thanh toán thành công! Chúc mừng bạn đã nâng cấp VIP. Đang chuyển về trang chính sau 5 giây..."* với bộ đếm ngược thời gian thực (5s ➔ 0s) rồi tự động chuyển hướng về `/`.
  * **Trường hợp chưa nhận được tiền:** Hiển thị khung cảnh báo màu vàng: *"Hệ thống chưa nhận được thanh toán. Vui lòng kiểm tra lại tài khoản hoặc chuyển khoản đúng nội dung!"* kèm nút *"Trở lại để thanh toán"*, tự động biến mất sau 5 giây để không làm phiền người dùng.
* **Tích hợp Webhook SePay:**
  * Endpoint `POST /api/payment/sepay-webhook` tiếp nhận thông báo biến động số dư từ ngân hàng, xác minh số tiền chuyển khoản (`transferAmount >= order.amount`) và tự động nâng cấp thời hạn VIP cho người dùng ngay tức khắc.

### 3.8. Phase 9: Quản lý Thời hạn VIP & Giáng cấp Tự động
* **Đồng hồ VIP đếm ngược thời gian thực (`👑 DD:HH:MM`):**
  * Trên thanh Header và trong Menu Dropdown tài khoản, nếu người dùng là thành viên VIP có thời hạn cụ thể, hệ thống hiển thị đồng hồ đếm ngược định dạng `👑 DD:HH:MM` (ví dụ: `👑 29:23:59`).
  * Sử dụng cơ chế đếm lùi từng giây phía Client ([public/js/ui-interactions.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/public/js/ui-interactions.js)), giúp người dùng luôn nắm bắt chính xác thời hạn VIP còn lại của mình.
* **Middleware Tự động Giáng cấp khi Hết hạn ([middlewares/authMiddleware.js](file:///c:/Users/ASUS-PRO/Desktop/Rottos/web%20advanced/project/cineverse/middlewares/authMiddleware.js)):**
  * Trong mỗi lượt request của người dùng, middleware tự động so sánh `vipExpiresAt` với thời gian hiện tại (`Date.now()`).
  * Nếu thời hạn VIP đã hết, hệ thống tự động cập nhật `isVip = false`, bảo vệ tuyệt đối nội dung VIP mà không cần bất kỳ can thiệp thủ công nào từ phía quản trị viên.

---

## 🧪 4. BÁO CÁO KIỂM THỬ TỰ ĐỘNG & BẢO ĐẢM CHẤT LƯỢNG MÃ NGUỒN

Hệ thống được kiểm thử tự động toàn diện qua 46 bài test viết trên module chuẩn `node:test` của Node.js:

```
✔ all admin pages and writes reject guests and ordinary members (845ms)
✔ admin pages render real data with no cached/private auth fields (375ms)
✔ mutations require a valid session-bound CSRF token (11ms)
✔ create movie preserves episodes, escapes titles, validates fields and retains failed input (43ms)
✔ publish and hide affect public detail; stale revisions cannot overwrite (64ms)
✔ VIP sources never appear in HTML for guests or non-VIP users (31ms)
✔ user update is allowlisted, revokes sessions, and protects every admin account (19ms)
✔ blocked accounts cannot login, activeSessionId persists on normal login (170ms)
✔ upload enforces CSRF, file size and file signatures and audits successful writes (46ms)
✔ database role is rechecked on every request, logout invalidates session (127ms)
✔ admin can grant VIP dynamically according to managed vipPlan (142ms)
✔ TMDB receives page, genre, adult filter and timeout (3ms)
✔ movie page renders cards and keeps genre in pagination (225ms)
✔ rejects invalid pages and genres without calling TMDB (64ms)
✔ empty results and API failure show different states (21ms)
✔ 1. userModel has preferences and age schema fields with correct defaults (2ms)
✔ 2.1 Unauthenticated request to /onboarding redirects to login page (57ms)
✔ 2.2 Authenticated user successfully accesses /onboarding view (161ms)
✔ 3.1 Successful registration redirects to /onboarding (form submission) (304ms)
✔ 3.2 Successful registration via API returns 201 and redirectTo /onboarding (8ms)
✔ 4.1 POST /onboarding rejects when less than 3 genres are chosen (9ms)
✔ 4.2 POST /onboarding rejects when more than 5 genres are chosen (7ms)
✔ 4.3 POST /onboarding accepts 3-5 genres and age, saving to user preferences (8ms)
✔ 4.4 POST /onboarding via web form redirects to destination after saving preferences (8ms)
✔ 5. GET /api/auth/me returns updated preferences and age (7ms)
✔ 1. VipPlan and Order models have correct schema definitions (1ms)
✔ 2.1 GET /pricing renders pricing page with plans and comparison table (370ms)
✔ 2.2 GET /api/payment/plans returns active plans in JSON (14ms)
✔ 3.1 POST /api/payment/create-order rejects unauthenticated user with 401 (137ms)
✔ 3.2 POST /api/payment/create-order rejects invalid planCode with 404 (11ms)
✔ 3.3 POST /api/payment/create-order successfully creates order and VietQR link (6ms)
✔ 4. GET /api/payment/check-status/:orderCode returns pending status (6ms)
✔ 5. POST /api/payment/simulate-success completes order and upgrades user to VIP (7ms)
✔ 6.1 POST /api/payment/sepay-webhook verifies amount and completes order (7ms)
✔ 6.2 POST /api/payment/sepay-webhook rejects if transferAmount is insufficient (7ms)
✔ TMDB search passes encoded params, pagination, adult filter and timeout (4ms)
✔ empty search renders guidance without calling TMDB (235ms)
✔ rejects malformed, excessive queries and invalid pages (73ms)
✔ results reuse movie cards, escape text and preserve pagination query (12ms)
✔ suggestions return at most five movies and only needed fields (5ms)
✔ no results and upstream failure have distinct states (21ms)
✔ movieDetail page renders HLS player, CDN and Multi-Server buttons (376ms)
✔ POST /api/history validates input and upserts watch position (157ms)
✔ GET /api/history returns user watch list (8ms)
✔ POST /api/auth/upgrade-vip successfully upgrades user account (7ms)
✔ VIP movie accessed by numeric TMDB ID correctly enforces VIP for regular users and bypasses for admin (26ms)

======================================================================
ℹ TỔNG KẾT KIỂM THỬ: 46 tests | 0 suites | 46 PASS | 0 FAIL (100% PASS)
ℹ TIÊU CHUẨN LINTING (ESLint): 0 errors, 0 warnings
======================================================================
```

### 🔒 Các giải pháp an ninh thông tin đã được kiểm chứng:
1. **Chống tấn công XSS:** Tất cả dữ liệu đầu ra được EJS tự động encode, các biến nhúng script đều được escape mã hóa chuỗi ký tự an toàn (`\u003c` thay vì `<`).
2. **Chống tấn công CSRF:** Áp dụng token HMAC-SHA256 gắn chặt với ID phiên làm việc (`session-bound`), bắt buộc trong mọi thao tác ghi dữ liệu (POST/PUT/DELETE).
3. **Bảo vệ tài khoản đơn thiết bị (Active Session ID):** Chống chia sẻ tài khoản xem lậu trên nhiều máy cùng lúc.
4. **Kiểm tra chữ ký số ảnh tải lên (Magic Bytes Check):** Ngăn chặn hacker ngụy trang mã độc PHP/JS dưới dạng file ảnh JPG/PNG.
5. **Khóa chống xung đột dữ liệu (Optimistic Concurrency Control - `__v`):** Ngăn ngừa tình trạng nhiều quản trị viên cùng sửa một bộ phim dẫn đến mất mát dữ liệu.

---

## 🎬 5. KỊCH BẢN DEMO THUYẾT TRÌNH BẢO VỆ CHÍNH THỨC

Để buổi bảo vệ diễn ra trôi chảy, thuyết phục và làm nổi bật toàn bộ các kỹ thuật chuyên sâu, kịch bản thuyết trình được thiết kế theo 8 bước logic dưới đây:

### 5.1. Thông tin tài khoản chuẩn bị sẵn trong Database:
* **Tài khoản Người dùng Thường (Free Member):** `user@cineverse.com` / Mật khẩu: `Password123!`
* **Tài khoản Quản trị viên & VIP (Admin):** `admin@cineverse.com` / Mật khẩu: `Password123!`
* **Tài khoản Thành viên thử nghiệm (Test Member):** `member@cineverse.com` / Mật khẩu: `Password123!`

---

### 5.2. Các bước thuyết minh chi tiết:

#### 🌟 BƯỚC 1: Tổng quan Trang chủ, Hero Banner & Dữ liệu TMDB Tự động
1. Mở trình duyệt tại địa chỉ `http://localhost:5000`.
2. Trình diễn **Hero Banner Slider**: Hiệu ứng chuyển động mượt mà, hiển thị huy hiệu `#1 Thịnh hành hôm nay`.
3. Trình chiếu hàng **Top 10 phim hôm nay**: Chỉ rõ các số thứ tự to `#1` đến `#10` được hệ thống đồng bộ tự động từ bảng xếp hạng thế giới của TMDB.
4. Cuộn chuột qua các hàng phim theo thể loại (*Hành động, Hoạt hình, Viễn tưởng, Chính kịch*), giải thích cơ chế nạp tức thì từ kho 355+ phim MongoDB Atlas mà không bị nghẽn mạng.

#### 🌟 BƯỚC 2: Phim Bộ Nhiều Tập, Lưới Chọn Tập Phân Tab 50 Tập & Khung Chiếu Căn Giữa 16:9
1. Bấm vào một bộ phim hoạt hình nhiều tập nổi tiếng (ví dụ: *"Thương Nguyên Đồ"*).
2. **Khung chiếu phim:** Chỉ cho Giảng viên thấy khung hình video đã được **căn giữa hoàn hảo chuẩn rạp 16:9** trên toàn bộ màn hình.
3. **Hạ tầng Đa Máy Chủ:**
   * **Server 1:** Video phát mượt mà luồng HLS `.m3u8` qua thư viện `Hls.js`.
   * **Server 2:** Bấm chuyển sang Server 2 dự phòng, nút phát chuyển sang màu xanh ngọc, video chuyển sang nguồn StreamC độc lập và **giữ nguyên đúng tập đang xem**.
4. **Lưới chọn tập phân tab 50 tập:**
   * Giới thiệu thanh phân tab `1 - 50`, `51 - 100`.
   * Bấm chọn tập 5 hoặc tập 12: Video đổi luồng phát tức thì mà **không cần tải lại trang web (Zero Reload)**. Giải thích giải pháp tối ưu DOM (chỉ render 50 tập của tab đang chọn) giúp trang web giữ tốc độ siêu nhẹ.

#### 🌟 BƯỚC 3: Kiểm Chứng Khóa 5 Phút VIP Paywall Tích Lũy
1. Đăng nhập bằng tài khoản người dùng thường: `user@cineverse.com`.
2. **Kiểm tra phim thường (329+ phim):** Mở một phim miễn phí bất kỳ (ví dụ: *Ván Cờ Của Cô Ấy*, *Luân Hồi*...). Tua qua phút thứ 6, 7 $\rightarrow$ Xem bình thường, không bao giờ bị khóa.
3. **Kiểm tra phim VIP (26 phim đặc quyền):** Mở một phim có huy hiệu `👑 VIP` (ví dụ: *Thương Nguyên Đồ*, *Bố Già*...).
   * Xem hoặc tua đến phút thứ 5 (300 giây): Trình phát video lập tức dừng lại, xuất hiện hộp thoại Paywall cao cấp mời nâng cấp tài khoản VIP.
   * Thử chuyển sang tập khác hoặc tua lại: Hệ thống vẫn khóa video nhờ biến đếm giây tích lũy `totalVipWatchSeconds`, chứng minh cơ chế chống gian lận hoạt động hoàn hảo.

#### 🌟 BƯỚC 4: Quy Trình Đăng Ký & Thanh Toán Gói VIP Qua VietQR
1. Bấm nút **"Nâng cấp VIP ngay"** hoặc truy cập vào trang Bảng giá `/pricing`.
2. Giới thiệu bảng so sánh quyền lợi giữa tài khoản Thường và VIP.
3. Chọn gói cước (ví dụ: Gói 1 Tháng - 49.000đ).
4. Hộp thoại **Thanh toán VietQR** xuất hiện:
   * Giới thiệu mã QR chuẩn NAPAS được sinh động chứa đúng số tiền và nội dung chuyển khoản cá nhân hóa `SEV...`.
5. **Kiểm thử Nút "Kiểm tra thanh toán":**
   * Nếu bấm ngay khi chưa thanh toán: Hệ thống hiển thị hộp cảnh báo màu vàng tự động ẩn sau 5 giây: *"Hệ thống chưa nhận được thanh toán. Vui lòng kiểm tra lại tài khoản hoặc chuyển khoản đúng nội dung!"* kèm nút *"Trở lại để thanh toán"*.
   * Khi thanh toán thành công (hoặc kích hoạt mô phỏng giao dịch): Hệ thống lập tức hiển thị thông báo màu xanh ngọc: *"Thanh toán thành công! Chúc mừng bạn đã nâng cấp VIP. Đang chuyển về trang chính sau 5 giây..."* với đồng hồ đếm ngược (5s, 4s, 3s, 2s, 1s) rồi tự động chuyển người dùng về Trang chủ (`/`).

#### 🌟 BƯỚC 5: Đồng Hồ VIP Đếm Ngược Thời Gian Thực `👑 DD:HH:MM`
1. Tại Trang chủ, chỉ cho Giảng viên thấy trên thanh Header và trong Menu Dropdown người dùng đã xuất hiện biểu tượng:
   $$\text{👑 } DD:HH:MM$$
2. Đồng hồ nhảy từng giây một theo thời gian thực (ví dụ: `👑 29:23:59` ➔ `👑 29:23:58`).
3. Giải thích cơ chế bảo mật: Middleware phía Backend tự động kiểm tra `vipExpiresAt <= Date.now()` để giáng cấp tài khoản khi hết hạn, hoàn toàn tự động hóa.

#### 🌟 BƯỚC 6: Lịch Sử Xem & Tính Năng "Tiếp Tục Xem" (Continue Watching)
1. Phát một bộ phim đến giây thứ 90, sau đó quay lại Trang chủ.
2. Hàng **"Tiếp tục xem"** xuất hiện ngay đầu trang với ảnh bìa phim, thanh tiến độ `%` đã xem và số phút còn lại.
3. Bấm vào xem tiếp: Video tự động mở đúng tập phim và hiển thị banner thông minh mời tua tiếp đến đúng giây đã dừng lại lần trước.

#### 🌟 BƯỚC 7: Phân Hệ Quản Trị Hệ Thống Thuần MongoDB (Admin Workspace)
1. Đăng xuất và đăng nhập bằng tài khoản Admin: `admin@cineverse.com`.
2. Truy cập `/admin`: Xem các chỉ số thống kê thực tế lấy từ MongoDB Atlas.
3. Vào mục **Quản lý người dùng (`/admin/users`)**:
   * Xem danh sách người dùng với nhãn VIP, tên gói cước và ngày hết hạn cụ thể.
   * **Biểu diễn Cấp VIP Động theo Gói cước:** Mở form cấp VIP, chọn một gói cước (ví dụ: Gói 90 Ngày). Chứng minh hệ thống tự động cộng dồn thêm ngày vào thời hạn cũ của người dùng mà không hardcode.
   * Thử chọn "Hủy VIP": Tài khoản lập tức trở về tài khoản Thường.
   * Thử chức năng Khóa tài khoản: Hệ thống lập tức xóa `activeSessionId`, vô hiệu hóa phiên làm việc của người dùng đó.
   * Chứng minh tài khoản admin được bảo vệ tuyệt đối (nút sửa bị khóa an toàn).
4. Vào mục **Quản trị phim (`/admin/movies`)**:
   * Trình diễn thêm mới/sửa phim, quản lý danh sách tập phim.
   * Giải thích cơ chế chống xung đột phiên bản `__v` (Optimistic Concurrency Control) và kiểm tra định dạng ảnh (Magic Bytes).
5. Vào mục **Nhật ký kiểm toán (`/admin/logs`)**:
   * Chỉ cho Giảng viên thấy mọi thao tác vừa thực hiện (cấp VIP, sửa phim, khóa tài khoản) đều được ghi nhận chi tiết về thời gian, đối tượng và địa chỉ IP.

#### 🌟 BƯỚC 8: Nghiệm Thu Chất Lượng Mã Nguồn & Kiểm Thử Tự Động
1. Mở Terminal và gõ lệnh chạy kiểm thử:
   ```bash
   npm test
   ```
2. Cho Giảng viên chứng kiến **toàn bộ 46/46 unit tests chạy mượt mà và vượt qua 100% (PASS)** trong vòng ~10 giây.
3. Chạy lệnh kiểm tra chuẩn cú pháp:
   ```bash
   npm run lint
   ```
   Kết quả: **0 errors, 0 warnings**, chứng minh mã nguồn đạt độ hoàn thiện cao nhất.

---

## 🔮 6. TỔNG KẾT ĐÁNH GIÁ & HƯỚNG PHÁT TRIỂN TƯƠNG LAI

### 6.1. Mức độ hoàn thành mục tiêu đồ án:
* **Tính độc lập & Ổn định:** Dự án tự chủ 100% kho dữ liệu trên MongoDB Atlas, không phụ thuộc vào tình trạng sống/chết của các API cào phim bên ngoài.
* **Hiệu năng & Tối ưu:** Ứng dụng tải trang cực nhanh (< 200ms), trình phát phân tab 50 tập giữ DOM luôn gọn nhẹ, tỷ lệ khung hình 16:9 căn giữa chuẩn điện ảnh mang lại cảm giác rạp chiếu sang trọng.
* **Nghiệp vụ thực tế:** Hệ thống monetization với cơ chế Freemium 5 phút tích lũy, cổng thanh toán tự động VietQR qua SePay và đồng hồ đếm ngược VIP thời gian thực đáp ứng hoàn hảo tiêu chuẩn của một sản phẩm thương mại thực thụ.
* **An ninh & Bảo mật:** Kiểm soát phiên 1 thiết bị/1 tài khoản, bảo vệ CSRF theo session, kiểm tra magic bytes ảnh tải lên và kiểm toán lịch sử thay đổi chặt chẽ.

### 6.2. Hướng mở rộng tiếp theo:
1. **Hệ thống AI Recommendation nâng cao:** Ứng dụng học máy hoặc Vector Embeddings để phân tích sâu hơn lịch sử xem và gợi ý phim theo ngữ cảnh tâm trạng người dùng.
2. **Watch Party (Xem phim cùng bạn bè):** Tích hợp WebSockets / WebRTC để đồng bộ khung hình và voice chat theo thời gian thực giữa các thành viên VIP trong cùng phòng xem.
3. **Ứng dụng Di động & TV (Cross-platform App):** Đóng gói ứng dụng thành PWA hoặc phát triển ứng dụng di động qua React Native / Flutter sử dụng chung backend RESTful API hiện tại.

---

> **LỜI CẢM ƠN:**  
> Nhóm sinh viên xin chân thành cảm ơn Thầy/Cô Giảng viên hướng dẫn môn **Lập trình Web Nâng Cao** đã tận tình định hướng, hỗ trợ chuyên môn và đóng góp những ý kiến quý báu trong suốt quá trình xây dựng và hoàn thiện đồ án CineVerse.
