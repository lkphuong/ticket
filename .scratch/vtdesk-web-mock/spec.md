Status: ready-for-agent

## Problem Statement

Các phòng ban nội bộ (CNTT, Nhân sự, Kế toán, Marketing, Kinh doanh, Vận hành, Pháp chế, Hành chính) trao đổi yêu cầu dịch vụ qua kênh rời rạc nên khó biết ai chịu trách nhiệm, hạn xử lý là khi nào và kết quả đã được nghiệm thu chưa. Bản web VTDesk hiện đã có nhiều màn hình, nhưng dữ liệu mockup và quy tắc nghiệp vụ chưa phủ đủ vòng đời yêu cầu. Chưa thể dùng nó để kiểm chứng nghiệp vụ trước khi viết API.

## Solution

Hoàn thiện web VTDesk chạy hoàn toàn trên dữ liệu mockup (không backend), nhưng nghiệp vụ phải đúng như hệ thống thật: vòng đời yêu cầu, quyền theo vai trò, SLA và hạn chót, phân công, trao đổi hai chiều kèm tệp, nghiệm thu kèm CSAT, làm lại, hủy, lọc, xuất CSV và báo cáo cho lãnh đạo. Dữ liệu mockup phải đủ phong phú để mọi nhánh nghiệp vụ đều có ví dụ. Mọi logic nằm ở lớp domain thuần để sau này API thay thế nguồn dữ liệu mà không đổi nghiệp vụ.

## User Stories

Khởi tạo yêu cầu
1. As a nhân viên, I want chọn mẫu yêu cầu theo phòng tiếp nhận (CNTT, Kế toán, Pháp chế, Hành chính, Nhân sự), so that tôi khởi tạo nhanh và đủ thông tin.
2. As a nhân viên, I want nhập tiêu đề, mô tả, mục đích và kết quả mong muốn, so that bên xử lý hiểu đúng nhu cầu.
3. As a nhân viên, I want chọn phòng tiếp nhận và mức ưu tiên, so that yêu cầu đến đúng nơi với mức khẩn cấp phù hợp.
4. As a nhân viên, I want đặt hạn chót mong muốn, so that bên xử lý biết thời hạn cần đạt.
5. As a nhân viên, I want đính kèm hồ sơ chứng từ khi tạo, so that không phải gửi thêm qua kênh khác.
6. As a nhân viên, I want được báo lỗi rõ khi thiếu trường bắt buộc hoặc hạn chót ở quá khứ, so that tôi sửa ngay trước khi gửi.
7. As a nhân viên, I want yêu cầu mới có mã duy nhất và trạng thái Mới, so that tôi tra cứu và theo dõi được.
8. As a nhân viên, I want không gửi yêu cầu đến chính phòng của mình khi mẫu quy định ngược lại, so that luồng liên phòng ban không bị sai.

Tiếp nhận và phân công
9. As a trưởng phòng, I want thấy hàng đợi yêu cầu gửi đến phòng tôi, so that tôi kiểm soát đầu vào.
10. As a trưởng phòng, I want phân công một chuyên viên trong phòng, so that có người chịu trách nhiệm cụ thể.
11. As a trưởng phòng, I want khi phân công yêu cầu Mới tự chuyển sang Đang xử lý, so that tiến độ phản ánh đúng thực tế.
12. As a trưởng phòng, I want chuyển giao lại sang chuyên viên khác, so that cân đối khối lượng công việc.
13. As a trưởng phòng, I want đổi mức ưu tiên và hạn chót của yêu cầu phòng mình, so that điều phối theo năng lực.
14. As a trưởng phòng, I want chỉ phân công được yêu cầu còn hoạt động và thuộc phòng mình, so that không thao tác nhầm.
15. As a chuyên viên, I want thấy danh sách "Giao cho tôi", so that tôi biết việc cần làm.

Xử lý và trao đổi
16. As a chuyên viên, I want cập nhật trạng thái sang Đang xử lý, Chờ phản hồi, Đã xử lý, so that người gửi theo dõi được.
17. As a chuyên viên, I want chuyển sang Chờ phản hồi kèm câu hỏi, so that đồng hồ xử lý phản ánh việc đang chờ người gửi.
18. As a chuyên viên, I want chỉ cập nhật được yêu cầu mình được giao, so that tránh sửa nhầm việc người khác.
19. As a nhân viên, I want trả lời bình luận và đính kèm tệp, so that cung cấp thêm hồ sơ cho bên xử lý.
20. As a nhân viên, I want khi tôi trả lời lúc yêu cầu đang Chờ phản hồi, trạng thái quay lại Đang xử lý, so that việc xử lý tiếp tục.
21. As a người dùng, I want xem dòng thời gian gồm thay đổi trạng thái, phân công và bình luận theo thứ tự, so that truy vết được toàn bộ quá trình.
22. As a người dùng, I want bình luận hiển thị tác giả và phòng ban, so that biết ai nói thay mặt phòng nào.

Nghiệm thu và làm lại
23. As a nhân viên, I want nghiệm thu yêu cầu ở trạng thái Đã xử lý, so that xác nhận kết quả đạt.
24. As a nhân viên, I want chấm CSAT 1 đến 5 sao và ghi chú, so that phản ánh mức hài lòng.
25. As a nhân viên, I want yêu cầu làm lại khi kết quả chưa đạt, so that không phải tạo yêu cầu mới.
26. As a nhân viên, I want mở lại cả yêu cầu đã đóng trong thời gian cho phép, so that sửa sai sót phát sinh sau.
27. As a nhân viên, I want không nghiệm thu được yêu cầu chưa ở trạng thái Đã xử lý, so that quy trình không bị bỏ bước.
28. As a trưởng phòng, I want thấy điểm CSAT và ghi chú của yêu cầu phòng mình, so that cải thiện chất lượng.

Hủy yêu cầu
29. As a nhân viên, I want hủy yêu cầu còn hoạt động kèm lý do bắt buộc, so that bên xử lý biết vì sao dừng.
30. As a trưởng phòng, I want từ chối hoặc hủy yêu cầu phòng mình kèm lý do, so that yêu cầu sai phạm vi được đóng đúng cách.
31. As a người dùng, I want yêu cầu đã hủy hiển thị lý do, so that không bị hiểu nhầm là hoàn thành.

SLA và hạn chót
32. As a người dùng, I want thấy số ngày còn lại, "hạn hôm nay" và "quá hạn", so that ưu tiên đúng việc.
33. As a trưởng phòng, I want lọc yêu cầu quá hạn SLA, so that xử lý trước.
34. As a lãnh đạo, I want thấy tỷ lệ hoàn thành đúng hạn (%), so that đánh giá hiệu quả phòng ban.
35. As a người dùng, I want yêu cầu đã đóng không còn bị cảnh báo quá hạn, so that cảnh báo chỉ còn ý nghĩa với việc đang mở.
36. As a người dùng, I want yêu cầu không đặt hạn chót hiển thị trung tính, so that không có cảnh báo sai.

Tìm kiếm, lọc, báo cáo
37. As a người dùng, I want tìm toàn văn theo mã, tiêu đề, mô tả, người gửi, so that tìm nhanh.
38. As a người dùng, I want lọc phạm vi: Tất cả, Gửi đến phòng tôi, Tôi đã gửi, Giao cho tôi, so that chỉ thấy việc liên quan.
39. As a người dùng, I want lọc theo trạng thái, ưu tiên, thời hạn SLA, người được phân công, so that thu hẹp danh sách.
40. As a người dùng, I want xuất CSV UTF-8 BOM đúng bộ lọc hiện tại, so that mở bằng Excel không lỗi tiếng Việt.
41. As a người dùng, I want bảng điều khiển có số lượng theo trạng thái, quá hạn, sắp đến hạn, so that nắm tình hình nhanh.
42. As a lãnh đạo, I want chuyển góc nhìn sang phòng ban khác (impersonation), so that giám sát liên phòng ban.
43. As a lãnh đạo, I want thấy CSAT trung bình và khối lượng theo phòng, so that so sánh các phòng.

Quyền và hiển thị
44. As a nhân viên, I want chỉ thấy yêu cầu tôi gửi hoặc có liên quan, so that thông tin không lộ.
45. As a trưởng phòng, I want thấy mọi yêu cầu gửi đến và gửi đi của phòng mình, so that giám sát đầy đủ.
46. As a lãnh đạo, I want xem toàn bộ nhưng không thao tác thay người khác, so that giữ đúng vai trò giám sát.
47. As a người dùng, I want nút thao tác chỉ hiện khi tôi có quyền và trạng thái cho phép, so that không bấm vào việc bị từ chối.
48. As a người dùng, I want đăng nhập chọn tài khoản mẫu theo vai trò và giữ phiên khi tải lại trang, so that kiểm thử mọi vai trò dễ dàng.

Dữ liệu mockup
49. As a người kiểm thử nghiệp vụ, I want dữ liệu mockup có ít nhất một yêu cầu cho mỗi trạng thái, mỗi phòng và mỗi mức ưu tiên, so that mọi màn hình có ví dụ.
50. As a người kiểm thử nghiệp vụ, I want có mẫu quá hạn, hôm nay, sắp đến hạn, không hạn, đã hủy, đã làm lại và đã chấm CSAT, so that kiểm tra được các nhánh SLA.
51. As a người kiểm thử nghiệp vụ, I want mỗi phòng có một trưởng phòng và vài chuyên viên, so that thử được phân công và chuyển giao.
52. As a người kiểm thử nghiệp vụ, I want ngày trong mockup tính tương đối theo ngày hiện tại, so that dữ liệu không lỗi thời theo thời gian.

## Implementation Decisions

- Vòng đời yêu cầu: Mới -> Đang xử lý <-> Chờ phản hồi -> Đã xử lý -> Đã đóng. Đã xử lý có thể quay về Đang xử lý khi người gửi yêu cầu làm lại. Hủy dẫn thẳng đến Đã đóng kèm lý do hủy. Bảng chuyển trạng thái hợp lệ là một nguồn sự thật duy nhất, cả reducer và quyền đều tham chiếu.
- Reducer là cổng duy nhất thay đổi yêu cầu. Cần bổ sung hành động còn thiếu: làm lại/mở lại, chuyển giao chuyên viên (có lịch sử), và quy tắc bình luận của người gửi làm Chờ phản hồi quay lại Đang xử lý. Reducer từ chối (trả state cũ) chuyển trạng thái không hợp lệ.
- Quyền theo (yêu cầu, người xem) là các hàm thuần: phân công, cập nhật tiến độ, nghiệm thu, mở lại, hủy, sửa ưu tiên, sửa hạn chót. Lãnh đạo chỉ đọc. Lớp UI chỉ gọi các hàm này, không tự suy luận quyền.
- SLA là hàm thuần nhận "bây giờ" làm tham số, gồm trạng thái hạn (còn hạn, hôm nay, quá hạn, không hạn), số ngày còn lại và tỷ lệ đúng hạn. Yêu cầu đã đóng được xét theo thời điểm đóng so với hạn, không theo ngày hiện tại.
- Phạm vi nhìn thấy theo vai trò và phòng ban là hàm thuần, dùng chung cho danh sách, bảng điều khiển và xuất CSV để ba nơi không lệch số liệu.
- Bộ lọc, hộp thư theo phạm vi, thống kê bảng điều khiển và xuất CSV là các hàm thuần trên cùng tập yêu cầu đã lọc theo quyền nhìn thấy.
- Dữ liệu mockup (thành viên, yêu cầu) tách khỏi logic và được truy cập qua một giao diện kho yêu cầu (store) mà provider hiện có đang cung cấp. Khi viết API chỉ thay cài đặt phía sau giao diện này.
- Dữ liệu mockup sinh ngày theo độ lệch ngày so với hiện tại. Mã yêu cầu và thời gian do một nhà máy (factory) tạo, có thể tiêm đồng hồ để test.
- Không thêm thư viện ngoài. Giao diện tiếng Việt, không biểu tượng cảm xúc hay icon, theo PRODUCT.md và DESIGN.md.
- Lỗi nghiệp vụ (hủy thiếu lý do, CSAT ngoài 1 đến 5, hạn ở quá khứ) trả thông điệp tiếng Việt có ngữ cảnh, không nuốt lỗi.

## Testing Decisions

- Test tốt chỉ kiểm tra hành vi quan sát được: cho trạng thái ban đầu và một chuỗi hành động, kiểm tra state kết quả, quyền và nhãn SLA. Không kiểm tra cấu trúc nội bộ hay thứ tự gọi hàm.
- Seam duy nhất: reducer cùng các hàm thuần quyền và SLA, đi qua chuỗi hành động vòng đời đầy đủ. Các hàm lọc, hộp thư, thống kê, CSV được kiểm tra như bề mặt đọc của cùng seam, bằng dữ liệu mockup làm đầu vào.
- Ca bắt buộc: luồng hạnh phúc (tạo, phân công, xử lý, nghiệm thu, đóng), làm lại, hủy, chuyển giao, mọi chuyển trạng thái bị cấm, từng ma trận quyền theo 4 vai trò, các biên SLA (hôm nay, quá hạn, không hạn, đã đóng), CSV với tiếng Việt và dấu phẩy trong nội dung.
- Test độc lập, không I/O thật, tên theo mẫu `should_<expected>_when_<condition>`, đồng hồ được tiêm.
- Prior art: `ticketsReducer.test.ts`, `ticketSla.test.ts`, `ticketInbox.test.ts`, `ticketFilters.test.ts`, `ticketExport.test.ts`, `dashboardSummary.test.ts`, `validateNewTicket.test.ts`.

## Out of Scope

- Backend `api/`, cơ sở dữ liệu, xác thực thật, phân quyền phía máy chủ (sẽ làm sau theo cùng nghiệp vụ).
- Thông báo email, đẩy thông báo, tích hợp ngoài.
- Tải tệp thật lên máy chủ: tệp đính kèm chỉ lưu tên và dung lượng.
- Lịch làm việc, ngày nghỉ lễ trong tính SLA và đa ngôn ngữ.
- Chăm sóc khách hàng bên ngoài (B2C).

## Further Notes

- Tài liệu sản phẩm gốc: `web/PRODUCT.md`. Khi API ra đời, hợp đồng HTTP sẽ là seam thứ hai, tái sử dụng chính các ca test của seam hiện tại.
- Câu hỏi mở cần chốt sau: thời hạn cho phép mở lại yêu cầu đã đóng, và cách tính SLA khi ở trạng thái Chờ phản hồi (tạm dừng hay vẫn tính).
- Chưa có cấu hình issue tracker trong session, nên spec được lưu thành file trong repo. Có thể chuyển thành issue khi chạy `/setup-matt-pocock-skills`.
