# 17: Web chuyển sang API: luồng Ticket

**What to build:** Web dùng API thay cho dữ liệu mockup trong toàn bộ luồng Ticket: đăng nhập thật và đổi mật khẩu lần đầu, danh sách, chi tiết, tạo, phân công, tiến độ, trao đổi, nghiệm thu, làm lại, mở lại, hủy, bảng điều khiển và xuất CSV. Gỡ vai trò Lãnh đạo (cờ `isExecutive`, trang báo cáo lãnh đạo, chuyển góc nhìn) và thay bằng góc nhìn Quản trị chỉ đọc. Kho yêu cầu của web được cài đặt qua HTTP.

**Blocked by:** 08, 09, 10, 11, 15, 16

**Status:** resolved

- [x] Mọi màn hình Ticket chạy trên API, không còn dữ liệu mock trong luồng chạy thật
- [x] Bộ test vòng đời hiện có chạy lại như contract test đối với API
- [x] Nút thao tác chỉ hiện khi người xem có quyền và trạng thái cho phép
- [x] Phiên được giữ khi tải lại trang
- [x] Không còn tham chiếu đến vai trò Lãnh đạo và chuyển góc nhìn
- [x] Lỗi từ API hiển thị bằng thông điệp tiếng Việt có ngữ cảnh
