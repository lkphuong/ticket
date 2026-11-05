# 05: CMS mẫu yêu cầu và SLA mặc định

**What to build:** Quản trị quản lý mẫu yêu cầu theo phòng tiếp nhận và SLA mặc định theo mức ưu tiên. Ticket đã tạo giữ nguyên snapshot phòng và hạn chót, cấu hình mới chỉ áp dụng cho Ticket tạo sau đó. Mọi thay đổi ghi nhật ký kiểm toán.

**Blocked by:** 04

**Status:** resolved

- [x] Nhân viên và Trưởng phòng đọc được danh sách mẫu đang hoạt động, chỉ Quản trị sửa được
- [x] Sửa mẫu hoặc SLA không đổi Ticket đã tạo
- [x] Mẫu ràng buộc phòng tiếp nhận hợp lệ, mẫu cấm gửi đến chính phòng gửi được thể hiện
- [x] SLA mặc định theo mức ưu tiên được lưu và đọc đúng
- [x] Có dòng nhật ký kiểm toán cho mỗi thay đổi

## Answer

Da hoan thanh tinh nang CMS quan ly mau yeu cau va SLA mac dinh:
- Cung cap endpoint GET /api/templates va GET /api/slas cho moi nguoi dung da dang nhap (Nhan vien, Truong phong, Quan tri) doc danh sach dang hoat dong.
- Chi Quan tri duoc phep tao moi (/api/cms/templates), cap nhat mau yeu cau va cap nhat thoi gian SLA (/api/cms/slas/:priority) qua guard requireRoles('admin').
- Rang buoc chat che phong tiep nhan hop le khi tao/cap nhat mau yeu cau.
- Thao tac cap nhat mau hoac SLA khong lam anh huong den snapshot cua cac Ticket da duoc tao truoc do.
- Tu dong ghi log vao audit_logs cho moi thao tac them, sua mau va cap nhat thong so SLA.
- Toan bo test trong api/src/routes/cmsTemplatesSla.test.ts pass 100%.
