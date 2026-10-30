# CineVerse Admin

## Dùng với dữ liệu ứng dụng

1. Cài dependency theo `package.json`, cấu hình `MONGODB_URI` và `JWT_SECRET` trong `.env` (xem `.env.example`). JWT secret cần là giá trị bí mật ngẫu nhiên dài, không commit vào Git.
2. Đăng ký tài khoản bằng trang `/register` nếu chưa có.
3. Cấp quyền cho đúng tài khoản đã đăng ký: `npm run admin:grant -- email-cua-ban@example.com`.
4. Chạy `npm start`, đăng nhập lại và truy cập `/admin`. Menu tài khoản của admin có liên kết tới trang quản trị.

Script cấp quyền chỉ cập nhật tài khoản hoạt động có email chỉ định; không tạo mật khẩu hay tài khoản mặc định. Việc cấp quyền sẽ thu hồi phiên cũ.

## Chức năng

- Dashboard lấy số tài khoản, admin, VIP, phim nội bộ, phim hiển thị và bản ghi yêu thích từ MongoDB. Không dùng lượt xem ngẫu nhiên của crawler làm số liệu người xem.
- Tìm kiếm, lọc và phân trang người dùng/phim; 20 bản ghi mỗi trang.
- Đổi VIP, khóa/mở khóa và cấp quyền admin cho tài khoản thành viên. Mọi cập nhật thu hồi phiên người đó. Không được sửa tài khoản đang có quyền admin qua web để bảo vệ admin cuối cùng, kể cả khi các yêu cầu chạy đồng thời. Việc hạ quyền admin cần quy trình vận hành trực tiếp có kiểm soát.
- Thêm/sửa metadata, thể loại, quốc gia, diễn viên, đạo diễn, ảnh, trailer, tập và các server iframe/HLS. Tối đa 100 tập mỗi form. Các tập cùng tên và loại server được gom vào một server.
- Lưu nháp, ẩn/hiện phim; chưa xóa vĩnh viễn dữ liệu. Form giữ dữ liệu khi lỗi validation và phát hiện chỉnh sửa đồng thời để tránh ghi đè.
- Tải ảnh PNG/JPEG/WebP tối đa 5 MB hoặc dùng URL. Ảnh tải lên nằm trong `public/uploads/admin/`; thư mục được Git ignore. Phải giữ và sao lưu thư mục này cùng database, dùng volume bền vững nếu triển khai bằng container. Thay ảnh không tự xóa ảnh cũ.
- Nhật ký lưu admin, thời gian, đối tượng, thao tác và trạng thái; không lưu mật khẩu hay token. Khi thay đổi dữ liệu thành công nhưng cập nhật kết quả log lỗi, trang báo lỗi; cần kiểm tra dữ liệu trước khi gửi lại. Log `pending` cần kiểm tra nếu tiến trình bị ngắt.

## Nội dung công khai

`/library` đọc các phim đã xuất bản trong MongoDB; `/library/:slug` hiển thị metadata và nguồn phát. Phim ẩn trả 404. Với phim VIP, server chỉ truyền nguồn cho admin hoặc thành viên có `isVip=true`; tài khoản bị khóa không được nhận diện là đã đăng nhập.

Trang chủ và `/movies/:id` hiện dùng TMDB/OPhim, là nguồn riêng. Ẩn một bản ghi MongoDB chỉ ảnh hưởng thư viện MongoDB, không phải lệnh gỡ nội dung khỏi TMDB. Không tạo bộ yêu thích riêng cho thư viện vì `Favorite.movieId` hiện dùng ID TMDB số.

Nguồn iframe chạy trong sandbox. HLS dùng hỗ trợ native của trình duyệt, có link mở nguồn cho trình phát hỗ trợ HLS; trên trình duyệt không hỗ trợ, dùng server iframe. Đánh dấu VIP là quản lý quyền thủ công, không bao gồm thanh toán hoặc chống sao chép video.

## Bảo vệ

Toàn bộ `/admin` kiểm tra phiên và quyền từ database trên mỗi request, trước controller. Các POST yêu cầu CSRF token gắn với phiên, bao gồm logout và upload. Trang admin không được cache và không được nhúng iframe. Chỉ whitelist các trường cho phép cập nhật; không nhận dữ liệu role/VIP từ đăng ký công khai.

## Kiểm thử và bản xem trước

`npm test` dùng MongoDB local tại `127.0.0.1:27017`, tạo database ngẫu nhiên có prefix `cineverse_admin_test_` và xóa đúng database đó sau kiểm thử. Không đọc cấu hình DB thật từ `.env`.

`npm run admin:preview` tạo database demo riêng có prefix `cineverse_admin_preview_`, chạy trên `127.0.0.1:5010`, không thay dữ liệu thật. Mở `http://127.0.0.1:5010/admin` để vào ngay, không cần tài khoản hoặc cấp quyền. Server preview tự dùng phiên của tài khoản admin giả; phiên này không được gửi xuống trình duyệt. Nút đăng xuất được thay bằng nhãn “Bản demo”. Dừng bằng Ctrl+C để xóa database demo. Không triển khai script preview ra môi trường công khai. Chế độ này chỉ có trong script preview, không bật bằng tham số URL hay biến môi trường của server thật.

Crawler hàng loạt, đồng bộ lịch, thanh toán, biểu đồ lượt xem và quản lý AI chưa thuộc trang admin này. Script crawler CLI hiện tại vẫn dùng được độc lập; trang quản trị không giả lập trạng thái hoặc nút tác vụ chưa có xử lý.
