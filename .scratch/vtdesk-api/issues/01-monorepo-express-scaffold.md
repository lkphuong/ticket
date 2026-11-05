# 01: Monorepo Bun và khung Express

**What to build:** Chuyển repo sang Bun workspaces gồm web, api và một gói domain dùng chung chứa các hàm nghiệp vụ thuần (Ticket, bảng chuyển trạng thái, reducer, quyền, SLA, visibility). API Express chạy trên Bun có endpoint kiểm tra sức khỏe, cấu hình đọc từ biến môi trường theo dev, staging, production, và CI chạy lint, test, build.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Web và API cùng import nghiệp vụ từ gói dùng chung, không chép logic
- [x] Toàn bộ test web hiện có vẫn xanh sau khi chuyển
- [x] Endpoint health trả 200 và có test
- [x] Lockfile và phiên bản được ghim
- [x] CI chạy lint, test và build

## Answer

Da chuyen doi repository thanh Bun monorepo workspaces:
- Goi packages/domain chua toan bo domain types, state reducer, rules (SLA, permissions, visibility, timeline, filters, validation, formatters, seed fixtures).
- Goi web chuyen sang phu thuoc vao @vtdesk/domain, toan bo 235 tests hien huu tiep tuc vuot qua 100%.
- Goi api dung khung Express tren Bun, phu thuoc vao @vtdesk/domain, co endpoint GET /health tra ve HTTP 200 kem test day du.
- Cau hinh moi truong tai api/src/config/environment.ts ho tro cac che do development, staging, production voi kiem tra hop le chat che.
- Khoa lockfile bun.lock duoc ghim phien ban.
- Thiet lap GitHub Actions CI tai .github/workflows/ci.yml thuc thi lint, test va build.
