# 04: CMS thành viên và phòng ban

**What to build:** Quản trị tạo, sửa, khóa thành viên (đổi phòng, đổi vai trò, đặt lại mật khẩu tạm) và quản lý phòng ban. Mọi thay đổi ghi nhật ký kiểm toán gồm ai sửa gì lúc nào. Thành viên không bị xóa cứng. Ticket đang giao cho người bị khóa quay về hàng đợi phòng để Trưởng phòng phân công lại.

**Blocked by:** 03

**Status:** resolved

- [x] Chỉ Quản trị gọi được, vai trò khác nhận 403
- [x] Username là duy nhất, trùng bị từ chối với thông điệp rõ ràng
- [x] Khóa thành viên đưa Ticket đang giao của người đó về hàng đợi phòng và ghi lịch sử phân công
- [x] Mỗi thay đổi có một dòng nhật ký kiểm toán, không chứa mật khẩu
- [x] Mỗi phòng luôn có đúng một Trưởng phòng, thao tác phá điều này bị từ chối

## Answer

Da hoan thanh chuc nang CMS quan ly thanh vien va phong ban:
- Xay dung CmsService tai api/src/cms/cmsService.ts:
  - Rang buoc chi cho phep Quản trị viên (admin) thao tac qua requireRoles('admin').
  - Kiem tra tinh duy nhat cua username khi tao moi thanh vien, tu choi kem thong diep ro rang.
  - Rang buoc nghiem ngat moi phong luu giu dung mot Truong phong, tu choi neu bo nhiem them hoac giang chuc Truong phong duy nhat khi chua co nguoi thay the.
  - Khi khoa thanh vien: chuyen trang thai isActive = false, thu hoi toan bo Ticket dang phan cong ve hang doi phong (status = 'open', assigneeName = undefined), ghi nhan lich su phan cong va lich su trang thai.
  - Moi hanh dong quan tri deu tu dong ghi nhat ky kiem toan audit_logs, khong luu mat khau hoac hash.
- Thiet lap routing CMS tai api/src/routes/cmsRoutes.ts (/departments, /members, /lock, /unlock, /reset-password, /audit-logs).
- Toan bo test trong api/src/routes/cms.test.ts pass 100%.
