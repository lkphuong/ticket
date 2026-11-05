# 01: Nối Postgres, seed và danh bạ thành viên

**What to build:** Nối server với Postgres, script migrate/seed an toàn, endpoint danh bạ thành viên, README api.

**Blocked by:** none

**Status:** resolved

- [x] Server dùng Postgres, lỗi rõ khi thiếu DATABASE_URL
- [x] Seed idempotent, `--reset` có xác nhận, chặn production
- [x] GET /api/members/directory không lộ email hay trạng thái khoá
- [ ] Chạy seed vào database trong api/.env (chờ xác nhận của người dùng)
