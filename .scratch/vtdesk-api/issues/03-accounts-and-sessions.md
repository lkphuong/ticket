# 03: Tài khoản và phiên

**What to build:** Người dùng đăng nhập bằng username và mật khẩu, nhận phiên, và xem được thông tin của chính mình. Mật khẩu lưu băm bcrypt. Tài khoản do Quản trị cấp mật khẩu tạm phải đổi mật khẩu ở lần đăng nhập đầu tiên. Mọi endpoint sau này lấy người xem từ phiên, không tin dữ liệu client gửi, và kiểm vai trò Nhân viên, Trưởng phòng, Quản trị.

**Blocked by:** 02

**Status:** resolved

- [x] Đăng nhập đúng trả phiên, sai trả lỗi chung không lộ username có tồn tại hay không
- [x] Tài khoản bị khóa không đăng nhập được
- [x] Tài khoản còn mật khẩu tạm bị chặn mọi endpoint khác cho đến khi đổi mật khẩu
- [x] Endpoint thông tin cá nhân trả vai trò, phòng và cờ Trưởng phòng
- [x] Middleware từ chối đúng khi sai vai trò
- [x] Mật khẩu không bao giờ xuất hiện trong log hay phản hồi

## Answer

Da hoan tat tinh nang tai khoan va phien lam viec:
- Xay dung MemorySessionService tai api/src/auth/sessionService.ts tao phien 256-bit an toan co TTL va co che thu hoi phien.
- Xay dung AuthService tai api/src/auth/authService.ts:
  - Dang nhap su dung bcrypt qua Bun.password.verify.
  - Khi sai username hoac mat khau deu tra ve thong diep loi chung 401 de tranh timing / enumeration attacks.
  - Tai khoan bi khoa (!isActive) bi tu choi dang nhap voi ma 403 AccountLocked.
  - Cho phep doi mat khau an toan (/api/auth/change-password) va xoa co requiresPasswordChange.
- Xay dung authMiddleware tai api/src/middleware/authMiddleware.ts:
  - Doc Bearer token / x-session-token tu request header.
  - Chan nguoi dung co mat khau tam truy cap bat ky endpoint nghiep vu nao khac tru khi doi mat khau.
  - Cung cap requireRoles va requireDepartmentHead de xac thuc phan quyen.
- Thiet lap routing auth tai api/src/routes/authRoutes.ts (/login, /logout, /me, /change-password).
- Bo test day du tai api/src/routes/auth.test.ts vuot qua 100%.
