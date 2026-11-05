# 03: Tài khoản và phiên

**What to build:** Người dùng đăng nhập bằng username và mật khẩu, nhận phiên, và xem được thông tin của chính mình. Mật khẩu lưu băm bcrypt. Tài khoản do Quản trị cấp mật khẩu tạm phải đổi mật khẩu ở lần đăng nhập đầu tiên. Mọi endpoint sau này lấy người xem từ phiên, không tin dữ liệu client gửi, và kiểm vai trò Nhân viên, Trưởng phòng, Quản trị.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Đăng nhập đúng trả phiên, sai trả lỗi chung không lộ username có tồn tại hay không
- [ ] Tài khoản bị khóa không đăng nhập được
- [ ] Tài khoản còn mật khẩu tạm bị chặn mọi endpoint khác cho đến khi đổi mật khẩu
- [ ] Endpoint thông tin cá nhân trả vai trò, phòng và cờ Trưởng phòng
- [ ] Middleware từ chối đúng khi sai vai trò
- [ ] Mật khẩu không bao giờ xuất hiện trong log hay phản hồi
