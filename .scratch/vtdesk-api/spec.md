Status: ready-for-agent

## Problem Statement

Web VTDesk đã chạy đủ nghiệp vụ trên dữ liệu mockup (xem `.scratch/vtdesk-web-mock/spec.md`) nhưng chưa có API thật, tài khoản thật, nơi quản lý danh mục và thông báo.

## Solution

Xây `api/` bằng Bun, Express, PostgreSQL và Drizzle, dùng lại nguyên các hàm nghiệp vụ thuần của web qua gói domain dùng chung trong Bun workspaces. Web đổi nguồn dữ liệu sang API mà không đổi nghiệp vụ.

## Implementation Decisions

- Vai trò tài khoản: Nhân viên, Trưởng phòng, Quản trị. Vai trò Lãnh đạo bị bỏ. Quản trị xem được toàn bộ Ticket và báo cáo liên phòng ban, chỉ đọc trên Ticket, và quản lý Danh mục qua CMS.
- Chuyên viên không phải vai trò tài khoản, là Nhân viên đang được giao một Ticket.
- Đăng nhập bằng username và mật khẩu (bcrypt qua `Bun.password`), Quản trị tạo tài khoản kèm mật khẩu tạm, bắt buộc đổi khi đăng nhập lần đầu. Thành viên bị khóa, không xóa cứng. Ticket đang giao cho người bị khóa quay về hàng đợi phòng.
- Danh mục do CMS quản lý: thành viên, phòng ban, mẫu yêu cầu, SLA mặc định theo mức ưu tiên. Mọi thay đổi ghi nhật ký kiểm toán. Ticket đã tạo giữ snapshot phòng và hạn chót.
- Hủy là kết cục đóng, không phải trạng thái. Làm lại và mở lại là hai thao tác riêng, đều giữ người được giao và lịch sử. Mở lại trong 7 ngày kể từ lúc đóng, Ticket đã hủy không mở lại được.
- SLA tạm dừng khi Chờ phản hồi. Đã xử lý không tự đóng ở bản này, tỷ lệ đúng hạn chốt tại thời điểm chuyển sang Đã xử lý.
- Thông báo: bảng trong DB là nguồn sự thật, Firebase Cloud Messaging là kênh đẩy. Lỗi gửi chỉ ghi log, không làm hỏng nghiệp vụ. Người dùng được nhập email tùy chọn kèm cờ nhận thư (mặc định tắt), chưa gửi thư và chưa xác minh. Không có tùy chọn tắt từng loại, chỉ đã đọc và đọc tất cả.
- Sự kiện sinh thông báo: Ticket mới gửi đến phòng, được phân công hoặc chuyển giao, Chờ phản hồi, Đã xử lý, người gửi trả lời, nghiệm thu, làm lại, mở lại, hủy, sắp đến hạn (còn 1 ngày), quá hạn. Người tự thực hiện hành động không nhận thông báo của chính nó.
- Kiểm tra quyền và visibility ở máy chủ bằng cùng hàm thuần với web. Ticket ngoài phạm vi nhìn thấy trả 404.
- Khóa Firebase, chuỗi kết nối DB và các bí mật lấy từ biến môi trường, tách cấu hình dev, staging, production.
- Express chạy trên Bun, ghim phiên bản, không thêm thư viện khi tự viết được vài dòng.

## Testing Decisions

- Use case test với kho yêu cầu in-memory, theo mẫu `should_<expected>_when_<condition>`, đồng hồ được tiêm, không I/O thật.
- Một bộ nhỏ test tích hợp trên Postgres thật trong CI cho truy vấn, ràng buộc và migration.
- Bộ test vòng đời của web chạy lại như contract test đối với API.

## Out of Scope

- Gửi email thật, xác minh email, SSO, quên mật khẩu qua email.
- Báo cáo riêng cho vai trò Lãnh đạo, chuyển góc nhìn (impersonation).
- Tải tệp thật lên máy chủ: tệp đính kèm chỉ lưu tên và dung lượng.
- Lịch làm việc, ngày nghỉ lễ trong SLA và đa ngôn ngữ.
- Tự đóng Ticket sau khi Đã xử lý và tùy chọn tắt từng loại thông báo.
