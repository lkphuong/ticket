# 03: Ma trận quyền theo 4 vai trò

**What to build:** Quyền thao tác theo vai trò (nhân viên, chuyên viên, trưởng phòng, lãnh đạo) và theo trạng thái yêu cầu. Lãnh đạo chỉ đọc. Giao diện chỉ hiện nút thao tác khi có quyền và đúng trạng thái, không tự suy luận quyền.

**Blocked by:** 02-transition-rules

**Status:** ready-for-agent

- [x] Ma trận quyền được test cho từng vai trò và từng trạng thái
- [x] Lãnh đạo không thao tác được thay người khác
- [x] Nút phân công, cập nhật tiến độ, nghiệm thu, hủy, sửa ưu tiên, sửa hạn chót chỉ hiện khi có quyền
- [x] Chuyên viên chỉ cập nhật được yêu cầu được giao cho mình
