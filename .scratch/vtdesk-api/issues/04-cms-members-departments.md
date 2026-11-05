# 04: CMS thành viên và phòng ban

**What to build:** Quản trị tạo, sửa, khóa thành viên (đổi phòng, đổi vai trò, đặt lại mật khẩu tạm) và quản lý phòng ban. Mọi thay đổi ghi nhật ký kiểm toán gồm ai sửa gì lúc nào. Thành viên không bị xóa cứng. Ticket đang giao cho người bị khóa quay về hàng đợi phòng để Trưởng phòng phân công lại.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Chỉ Quản trị gọi được, vai trò khác nhận 403
- [ ] Username là duy nhất, trùng bị từ chối với thông điệp rõ ràng
- [ ] Khóa thành viên đưa Ticket đang giao của người đó về hàng đợi phòng và ghi lịch sử phân công
- [ ] Mỗi thay đổi có một dòng nhật ký kiểm toán, không chứa mật khẩu
- [ ] Mỗi phòng luôn có đúng một Trưởng phòng, thao tác phá điều này bị từ chối
