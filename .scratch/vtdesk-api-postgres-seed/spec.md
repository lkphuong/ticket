# Spec: API chạy trên Postgres và seed dữ liệu mẫu

- API dùng PostgresTicketStore qua DATABASE_URL, tự chạy migrations khi khởi động, thiếu DATABASE_URL thì báo lỗi.
- Script `db:seed` idempotent (không ghi đè dữ liệu có sẵn), cờ `--reset` có xác nhận, từ chối khi NODE_ENV=production.
- Endpoint `GET /api/members/directory` cho mọi role đã đăng nhập, chỉ trả trường không nhạy cảm.
- Proxy Vite mặc định trỏ cổng 3001.
