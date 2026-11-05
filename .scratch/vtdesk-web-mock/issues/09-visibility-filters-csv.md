# 09: Phạm vi nhìn thấy, bộ lọc và CSV dùng chung

**What to build:** Danh sách, bảng điều khiển và xuất CSV dùng cùng một tập yêu cầu theo quyền nhìn thấy nên số liệu không lệch. Tìm toàn văn, lọc theo phạm vi (Tất cả, Gửi đến phòng tôi, Tôi đã gửi, Giao cho tôi), trạng thái, ưu tiên, SLA, người phụ trách.

**Blocked by:** 01-mock-data, 03-permissions-matrix, 07-sla-engine

**Status:** ready-for-agent

- [x] Nhân viên chỉ thấy yêu cầu liên quan, trưởng phòng thấy yêu cầu gửi đến và gửi đi của phòng, lãnh đạo thấy toàn bộ
- [x] CSV UTF-8 BOM, đúng bộ lọc hiện tại, đúng tiếng Việt và dấu phẩy trong nội dung
- [x] Số lượng ở danh sách và bảng điều khiển khớp nhau
