# 02: Schema Postgres, migration và dữ liệu mẫu

**What to build:** Lưu trữ bền vững cho thành viên, phòng ban, Ticket, bình luận, lịch sử trạng thái và phân công, mẫu yêu cầu, thông báo bằng Drizzle trên PostgreSQL, kèm migration và dữ liệu mẫu. Truy cập qua giao diện kho yêu cầu mà domain hiện có, cài đặt Postgres đứng sau giao diện đó.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration chạy sạch trên DB trống
- [ ] Dữ liệu mẫu có ngày tương đối và đủ mọi trạng thái, phòng, mức ưu tiên
- [ ] Mỗi phòng có một Trưởng phòng và vài Nhân viên, có ít nhất một tài khoản Quản trị
- [ ] Ghi rồi đọc lại Ticket đầy đủ lịch sử và bình luận qua kho yêu cầu
- [ ] Bộ test tích hợp nhỏ chạy trên Postgres thật trong CI
- [ ] Kho yêu cầu in-memory dùng cho test use case
