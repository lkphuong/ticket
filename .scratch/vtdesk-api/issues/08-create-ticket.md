# 08: Tạo Ticket

**What to build:** Nhân viên chọn Mẫu yêu cầu, nhập tiêu đề, mô tả, mục đích, kết quả mong muốn, phòng tiếp nhận, mức ưu tiên, hạn chót mong muốn và đính kèm tệp (chỉ lưu tên và dung lượng), rồi gửi. Ticket mới có mã duy nhất và trạng thái Mới. Thiếu trường bắt buộc hoặc hạn chót ở quá khứ bị từ chối với thông điệp tiếng Việt rõ ràng.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] Mã Ticket là duy nhất dù tạo đồng thời
- [ ] Lỗi kiểm tra trả đủ ngữ cảnh theo từng trường
- [ ] Mẫu cấm gửi đến chính phòng mình được tuân thủ
- [ ] Hạn chót mặc định lấy từ SLA theo ưu tiên khi người gửi không đặt
- [ ] Ticket lưu snapshot phòng gửi và phòng tiếp nhận tại thời điểm tạo
- [ ] Quản trị không tạo được Ticket
