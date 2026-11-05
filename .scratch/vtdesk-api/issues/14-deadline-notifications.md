# 14: Thông báo theo hạn

**What to build:** Một tiến trình định kỳ mỗi giờ phát hiện Ticket sắp đến hạn (còn 1 ngày) và quá hạn, rồi sinh Thông báo cho Chuyên viên được giao và Trưởng phòng tiếp nhận. Mỗi Ticket chỉ báo mỗi loại một lần. SLA tính theo quy tắc đã chốt: tạm dừng khi Chờ phản hồi, Ticket đã đóng không còn bị cảnh báo.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] Mỗi Ticket nhận mỗi loại cảnh báo đúng một lần dù tiến trình chạy lặp
- [ ] Ticket không đặt hạn và Ticket đã đóng không sinh cảnh báo
- [ ] Ticket đang Chờ phản hồi không bị tính quá hạn trong thời gian tạm dừng
- [ ] Đồng hồ được tiêm để test được các biên hôm nay, quá hạn
- [ ] Ticket chưa được phân công thì cảnh báo đi tới Trưởng phòng tiếp nhận
