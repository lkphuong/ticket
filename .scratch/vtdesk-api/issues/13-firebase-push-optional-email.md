# 13: Đẩy Firebase và email tùy chọn

**What to build:** Thông báo mới được đẩy tức thời đến các thiết bị người dùng đã cho phép qua Firebase Cloud Messaging. Người dùng đăng ký và hủy đăng ký token thiết bị. Người dùng có thể nhập email tùy chọn kèm cờ nhận thư (mặc định tắt) để chuẩn bị cho việc gửi thư sau này. Chưa gửi thư và chưa xác minh quyền sở hữu email.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] Một người dùng có nhiều token, token bị Firebase từ chối được tự xóa
- [ ] Lỗi gửi Firebase chỉ ghi log có ngữ cảnh, không làm hỏng hành động nghiệp vụ
- [ ] Khóa dịch vụ Firebase đọc từ biến môi trường, không có trong mã nguồn hay log
- [ ] Email được kiểm tra định dạng, cờ nhận thư mặc định tắt
- [ ] Cổng gửi Firebase nằm sau một giao diện để test bằng bản giả, không I/O thật
