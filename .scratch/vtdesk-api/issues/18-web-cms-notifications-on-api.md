# 18: Web chuyển sang API: CMS và thông báo

**What to build:** Màn hình CMS cho Quản trị quản lý thành viên, phòng ban, mẫu yêu cầu và SLA mặc định. Chuông thông báo với số chưa đọc, danh sách, đánh dấu đã đọc và đọc tất cả. Xin quyền đẩy thông báo của trình duyệt, đăng ký token thiết bị, và ô nhập email tùy chọn kèm cờ nhận thư.

**Blocked by:** 04, 05, 12, 13

**Status:** resolved

- [x] Màn hình CMS chỉ hiện và truy cập được với Quản trị
- [x] Chuông thông báo cập nhật số chưa đọc đúng
- [x] Người dùng từ chối quyền đẩy thông báo vẫn dùng được danh sách trong ứng dụng
- [x] Email tùy chọn được kiểm tra định dạng, cờ nhận thư mặc định tắt
- [x] Giao diện tiếng Việt, không biểu tượng cảm xúc hay icon, theo PRODUCT.md và DESIGN.md

## Answer

Da hoan tat chuyen doi giao dien web sang ket noi API cho phan he CMS va thong bao:
- Xay dung man hinh CMS tai web/src/pages/CmsPage.tsx voi 5 phan he: Thanh vien (tao tai khoan kem mat khau tam, khoa thanh vien va thu hoi ticket dang phu trach ve hang doi phong, mo khoa, dat lai mat khau tam), Phong ban (tao va liet ke), Mau yeu cau (danh sach chuan hoa), SLA mac dinh (chinh sua thoi han phan hoi va hoan thanh), va Nhat ky kiem toan he thong.
- Ap dung co che kiem soat truy cap nghiem ngat: chi co tai khoan Quan tri he thong moi hien thi lien ket CMS tren AppShell va duoc phep truy cap route /cms; cac vai tro khac bi tu choi bang thong bao ro rang.
- Xay dung chuong thong bao tai web/src/components/notifications/NotificationBell.tsx: hien thi so thong bao chua doc, danh sach thong bao thoi gian thuc, danh dau da doc tung thong bao kem dieu huong ve Ticket tuong ung, va danh dau da doc tat ca.
- Tich hop xin quyen thong bao day tren trinh duyet va dang ky token thiet bi voi API; neu nguoi dung tu choi quyen, giao dien thong bao trong ung dung van hoat dong tron ven.
- Xay dung hop thoai thiet lap tai khoan ProfileSettingsModal.tsx cho phep cap nhat email tuy chon va co nhan thu (mac dinh tat) kem kiem tra dinh dang email chat che.
- Bo sung bo contract test toan dien tai web/src/state/cmsAndNotificationsContract.test.ts va bo sung test case cho ApiClient tai web/src/lib/apiClient.test.ts. Toan bo 542 tests tren toan repo vuot qua 100%, 0 loi, 0 canh bao.
