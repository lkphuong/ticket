# 02: Schema Postgres, migration và dữ liệu mẫu

**What to build:** Lưu trữ bền vững cho thành viên, phòng ban, Ticket, bình luận, lịch sử trạng thái và phân công, mẫu yêu cầu, thông báo bằng Drizzle trên PostgreSQL, kèm migration và dữ liệu mẫu. Truy cập qua giao diện kho yêu cầu mà domain hiện có, cài đặt Postgres đứng sau giao diện đó.

**Blocked by:** 01

**Status:** resolved

- [x] Migration chạy sạch trên DB trống
- [x] Dữ liệu mẫu có ngày tương đối và đủ mọi trạng thái, phòng, mức ưu tiên
- [x] Mỗi phòng có một Trưởng phòng và vài Nhân viên, có ít nhất một tài khoản Quản trị
- [x] Ghi rồi đọc lại Ticket đầy đủ lịch sử và bình luận qua kho yêu cầu
- [x] Bộ test tích hợp nhỏ chạy trên Postgres thật trong CI
- [x] Kho yêu cầu in-memory dùng cho test use case

## Answer

Da hoan thien toan bo he thong luu tru theo kien truc S.O.L.I.D va Repository pattern:
- Dinh nghia interface kho yeu cau ITicketStore tai api/src/repositories/interfaces.ts gom tickets, members, departments, templates, notifications, auditLogs.
- Xay dung schema Drizzle PostgreSQL tai api/src/db/schema.ts voi day du rang buoc khoa ngoai, khoa chinh va cascade.
- Tao script migration SQL tu dong qua drizzle-kit tai api/src/db/migrations/.
- Viet migrator idempotent tai api/src/db/migrator.ts ho tro thuc thi tren Postgres that va PGlite.
- Cung cap ham seedDatabase tai api/src/db/seed.ts tao du lieu tuong doi theo moc thoi gian tiem vao, co tai khoan Admin va day du cac phong, truong phong, nhan vien, mau yeu cau va Ticket voi moi trang thai/muc uu tien.
- Cai dat PostgresTicketStore bang Drizzle ORM ho tro luu tru va truy van Ticket kem attachment, comments, status history, assignment history.
- Cai dat InMemoryTicketStore phuc vu cac use case test khong can I/O.
- Bo test tich hop chay tren engine Postgres that pass 100%.
