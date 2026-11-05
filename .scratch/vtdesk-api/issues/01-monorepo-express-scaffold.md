# 01: Monorepo Bun và khung Express

**What to build:** Chuyển repo sang Bun workspaces gồm web, api và một gói domain dùng chung chứa các hàm nghiệp vụ thuần (Ticket, bảng chuyển trạng thái, reducer, quyền, SLA, visibility). API Express chạy trên Bun có endpoint kiểm tra sức khỏe, cấu hình đọc từ biến môi trường theo dev, staging, production, và CI chạy lint, test, build.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Web và API cùng import nghiệp vụ từ gói dùng chung, không chép logic
- [ ] Toàn bộ test web hiện có vẫn xanh sau khi chuyển
- [ ] Endpoint health trả 200 và có test
- [ ] Lockfile và phiên bản được ghim
- [ ] CI chạy lint, test và build
