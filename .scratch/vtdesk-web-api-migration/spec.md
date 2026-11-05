# Spec: Web bỏ dữ liệu mockup, dùng API

- Xoá web/src/data/*, TicketStoreProvider, ticketStoreContext, ticketsReducer.
- Thành viên lấy từ /api/members/directory; LoginPage bỏ mật khẩu demo; lib/auth.ts bỏ tra MEMBERS tĩnh.
- Test dùng fixture dựng tại chỗ.
- UI/UX: skeleton, lỗi kèm thử lại, trạng thái rỗng, khoá nút khi gửi, hết phiên về đăng nhập, theo DESIGN.md.
