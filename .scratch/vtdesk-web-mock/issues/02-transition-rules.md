# 02: Bảng chuyển trạng thái hợp lệ

**What to build:** Vòng đời Mới, Đang xử lý, Chờ phản hồi, Đã xử lý, Đã đóng có một nguồn sự thật duy nhất. Mọi thay đổi trạng thái trái quy tắc bị từ chối, hủy bắt buộc có lý do, CSAT chỉ nhận 1 đến 5, thông báo lỗi tiếng Việt có ngữ cảnh.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Chuyển trạng thái hợp lệ được chấp nhận, mọi chuyển trái quy tắc trả về trạng thái cũ
- [x] Hủy thiếu lý do và CSAT ngoài 1 đến 5 bị từ chối với thông báo rõ ràng
- [x] Phân công yêu cầu Mới tự chuyển sang Đang xử lý
- [x] Test theo chuỗi hành động qua reducer, đặt tên should_<expected>_when_<condition>
