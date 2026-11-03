# CineVerse Admin

## Dùng với dữ liệu ứng dụng

1. Cài dependency theo `package.json`, cấu hình `MONGODB_URI` và `JWT_SECRET` trong `.env` (xem `.env.example`). JWT secret cần là giá trị bí mật ngẫu nhiên dài, không commit vào Git.
2. Đăng ký tài khoản bằng trang `/register` nếu chưa có.
3. Cấp quyền cho đúng tài khoản đã đăng ký: `npm run admin:grant -- email-cua-ban@example.com`.
4. Chạy `npm start`, đăng nhập lại và truy cập `/admin`. Menu tài khoản của admin có liên kết tới trang quản trị.

Script cấp quyền chỉ cập nhật tài khoản hoạt động có email chỉ định; không tạo mật khẩu hay tài khoản mặc định. Việc cấp quyền sẽ thu hồi phiên cũ.

## Chức năng

- **Dashboard:** Lấy số tài khoản, admin, VIP, phim nội bộ, phim hiển thị và bản ghi yêu thích từ MongoDB. Không dùng lượt xem ngẫu nhiên của crawler làm số liệu người xem.
- **Tìm kiếm, lọc và phân trang:** Hỗ trợ tìm theo tên/email, quyền, trạng thái với 20 bản ghi mỗi trang.
- **Quản lý Thành viên & Cấp VIP Động Theo Gói:**
  - Cột trạng thái hiển thị rõ ràng huy hiệu VIP, tên gói cước đang sử dụng và ngày hết hạn cụ thể (`vipExpiresAt`) hoặc nhãn "Vô thời hạn".
  - Admin có thể cấp VIP cho thành viên bằng cách chọn trực tiếp các gói cước được cấu hình trong hệ thống (`VipPlan`), hoàn toàn không gán cứng mã gói trong code.
  - Hệ thống tự động cộng dồn thời hạn sử dụng nếu người dùng vẫn đang trong thời hạn VIP; hỗ trợ lựa chọn Cấp VIP Vĩnh viễn (Vô thời hạn) và Hủy VIP (chuyển về tài khoản Thường).
  - Khóa/mở khóa và cấp quyền admin cho tài khoản thành viên. Mọi cập nhật thu hồi phiên người đó ngay lập tức (`activeSessionId: null`). Không được sửa tài khoản đang có quyền admin qua web để bảo vệ admin cuối cùng.
- **Quản lý Gói cước VIP (`/admin/plans`):** Thêm mới, chỉnh sửa, kích hoạt/tạm dừng và xóa gói cước VIP; cấu hình số ngày sử dụng (`durationDays`), giá niêm yết, giá gốc, huy hiệu (`badge`), mô tả và các đặc quyền VIP.
- **Quản lý Đơn hàng Thanh toán (`/admin/orders`):** Theo dõi danh sách đơn hàng nạp VIP qua VietQR / SePay với đầy đủ thông tin: mã đơn hàng (`CV...`), số tiền, gói cước, mã giao dịch, trạng thái (`pending`, `completed`, `expired`).
- **Quản lý Phim CRUD:** Thêm/sửa metadata, thể loại, quốc gia, diễn viên, đạo diễn, ảnh, trailer, tập và các server iframe/HLS. Tối đa 100 tập mỗi form. Các tập cùng tên và loại server được gom vào một server.
- **Lưu nháp, ẩn/hiện phim:** Chưa xóa vĩnh viễn dữ liệu. Form giữ dữ liệu khi lỗi validation và phát hiện chỉnh sửa đồng thời qua versioning `__v` để tránh ghi đè.
- **Tải ảnh an toàn:** Hỗ trợ PNG/JPEG/WebP tối đa 5 MB hoặc dùng URL. Ảnh tải lên nằm trong `public/uploads/admin/`; thư mục được Git ignore.
- **Nhật ký Kiểm toán (`/admin/logs`):** Lưu admin thực hiện, thời gian, đối tượng, thao tác và trạng thái thành công/thất bại; không lưu mật khẩu hay token.

## Nội dung công khai

`/library` đọc các phim đã xuất bản trong MongoDB; `/library/:slug` hiển thị metadata và nguồn phát. Phim ẩn trả 404. Với phim VIP, server chỉ truyền nguồn cho admin hoặc thành viên có `isVip=true`; tài khoản bị khóa không được nhận diện là đã đăng nhập.

Trang chủ và `/movies/:id` hiện dùng TMDB/OPhim, là nguồn riêng. Ẩn một bản ghi MongoDB chỉ ảnh hưởng thư viện MongoDB, không phải lệnh gỡ nội dung khỏi TMDB. Không tạo bộ yêu thích riêng cho thư viện vì `Favorite.movieId` hiện dùng ID TMDB số.

Nguồn iframe chạy trong sandbox. HLS dùng hỗ trợ native của trình duyệt kết hợp HLS.js, có khung player chuẩn tỷ lệ rạp chiếu 16:9 căn giữa hoàn hảo.

## Bảo vệ

Toàn bộ `/admin` kiểm tra phiên và quyền từ database trên mỗi request, trước controller. Các POST yêu cầu CSRF token gắn với phiên, bao gồm logout và upload. Trang admin không được cache (`no-store`) và không được nhúng iframe. Chỉ whitelist các trường cho phép cập nhật; không nhận dữ liệu role/VIP từ đăng ký công khai.

## Kiểm thử và bản xem trước

`npm test` dùng MongoDB local tại `127.0.0.1:27017`, tạo database ngẫu nhiên có prefix `cineverse_admin_test_` và xóa đúng database đó sau kiểm thử. Bộ kiểm thử đạt **46/46 tests PASS (100%)**, bao gồm cả kiểm thử cấp VIP động theo gói và thu hồi VIP.

`npm run admin:preview` tạo database demo riêng có prefix `cineverse_admin_preview_`, chạy trên `127.0.0.1:5010`, không thay dữ liệu thật. Mở `http://127.0.0.1:5010/admin` để vào ngay, không cần tài khoản hoặc cấp quyền.
