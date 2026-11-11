# VTDesk

Hệ thống điều phối yêu cầu dịch vụ nội bộ giữa các phòng ban, với trách nhiệm xử lý và cam kết thời gian rõ ràng.

## Language

**Ticket**:
Một yêu cầu dịch vụ do một phòng ban gửi đến phòng ban khác, đi qua vòng đời từ Mới đến Đã đóng. Tiếng Việt: Yêu cầu.
_Avoid_: Request, Case, Service Request

**Phòng gửi / Phòng tiếp nhận**:
Phòng của người tạo Ticket và phòng chịu trách nhiệm xử lý Ticket.
_Avoid_: Phòng nguồn, phòng đích

**Nhân viên**:
Người dùng thường, tạo Ticket và nghiệm thu kết quả. Khi được giao một Ticket thì đóng vai Chuyên viên của Ticket đó.
_Avoid_: Staff, User

**Chuyên viên**:
Nhân viên đang được giao xử lý một Ticket. Không phải vai trò tài khoản riêng.
_Avoid_: Handler (như một vai trò)

**Trưởng phòng**:
Người quản lý một phòng ban, nhận hàng đợi Ticket gửi đến phòng và phân công Chuyên viên.
_Avoid_: Quản lý, Manager

**Quản trị**:
Vai trò tài khoản xem được toàn bộ Ticket và báo cáo, quản lý dữ liệu danh mục qua CMS, nhưng không thao tác nghiệp vụ trên Ticket.
_Avoid_: Admin, Lãnh đạo

**Kết cục đóng**:
Lý do một Ticket ở trạng thái Đã đóng, hoặc Hoàn thành (đã nghiệm thu) hoặc Đã hủy. Đã hủy luôn có lý do. Không phải một trạng thái.
_Avoid_: Trạng thái Đã hủy

**Làm lại**:
Người gửi trả Ticket ở trạng thái Đã xử lý về Đang xử lý vì kết quả chưa đạt, trước khi nghiệm thu.
_Avoid_: Reopen (khi chưa đóng)

**Mở lại**:
Người gửi đưa Ticket đã đóng (Hoàn thành) về Đang xử lý trong thời hạn cho phép. Ticket Đã hủy không mở lại được.
_Avoid_: Làm lại (khi đã đóng)

**Nghiệm thu**:
Quy trình hai bước đưa Ticket Đã xử lý sang Đã đóng. Bước một: người gửi xác nhận kết quả và chấm CSAT, Ticket sang Chờ duyệt. Bước hai: Trưởng phòng của phòng gửi duyệt thì Ticket Đã đóng; từ chối (kèm lý do) thì Ticket về Đang xử lý và điểm CSAT bị xóa.
_Avoid_: Duyệt, xác nhận

**Chờ duyệt**:
Trạng thái sau khi người gửi đã nghiệm thu bước một, đang chờ Trưởng phòng của phòng gửi duyệt. Không còn là Ticket hoạt động.
_Avoid_: Chờ nghiệm thu

**CSAT**:
Điểm hài lòng nguyên từ 1 đến 5 do người gửi chấm khi nghiệm thu, kèm ghi chú tùy chọn.
_Avoid_: Rating, đánh giá

**SLA**:
Cam kết hạn xử lý của một Ticket, thể hiện qua hạn chót và trạng thái hạn (còn hạn, hôm nay, quá hạn, không hạn).
_Avoid_: Deadline

**Danh mục**:
Dữ liệu cấu hình do Quản trị quản lý qua CMS: thành viên, phòng ban, mẫu yêu cầu và SLA mặc định.
_Avoid_: Master data

**Mẫu yêu cầu**:
Khuôn nhập sẵn của một phòng tiếp nhận để người gửi khởi tạo Ticket nhanh và đủ thông tin.
_Avoid_: Template (trong lời nói)

**Luân chuyển**:
Việc Nhân viên chuyển sang phòng ban khác. Nhân viên gửi yêu cầu, chỉ có hiệu lực khi Trưởng phòng của phòng hiện tại xác nhận; Nhân viên đang phụ trách Ticket chưa xử lý xong thì chưa được duyệt luân chuyển.
_Avoid_: Chuyển phòng, Transfer

**Thông báo**:
Bản ghi báo cho một người dùng về một sự kiện của Ticket liên quan. Có thể đẩy ra ngoài ứng dụng qua Firebase.
_Avoid_: Notification, alert
