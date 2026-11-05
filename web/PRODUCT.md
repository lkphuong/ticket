# Product: VTDesk

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, Vite, Tailwind CSS v4, TypeScript. Production-grade architecture with strictly typed domain models, pure calculation functions, and zero icon/emoji dependencies.

## Target Audience & Personas

Enterprise employees and management across 8 key operational departments:
1. **Nhân viên (Staff)**: Khởi tạo yêu cầu dịch vụ theo mẫu chuẩn, theo dõi tiến độ, trao đổi hồ sơ và đánh giá nghiệm thu.
2. **Chuyên viên xử lý (Handler)**: Tiếp nhận công việc trong hàng đợi phòng ban, cập nhật trạng thái tiến trình và chuyển giao kết quả.
3. **Trưởng phòng ban (Department Head)**: Giám sát hàng đợi tiếp nhận, phân công nhân sự, kiểm soát quá hạn SLA và điều phối công việc.
4. **Ban Lãnh đạo điều hành (Executive)**: Giám sát toàn diện khối lượng công việc liên phòng ban, tỷ lệ hoàn thành đúng hạn SLA (%) và chỉ số hài lòng (CSAT).

## Product Purpose

VTDesk là nền tảng quản trị yêu cầu dịch vụ và điều phối nghiệp vụ liên phòng ban cấp doanh nghiệp (Enterprise Service Dispatch System). Nền tảng giải quyết bài toán ách tắc thông tin, thiếu trách nhiệm phân công và trễ hạn hoàn thành giữa các khối phòng ban nội bộ.

## Positioning

Hệ thống điều phối dịch vụ nội bộ (Internal Service Management / ESM), không phải hệ thống chăm sóc khách hàng bên ngoài (B2C customer support). Mỗi yêu cầu đều xác định rõ phòng ban khởi tạo và phòng ban tiếp nhận, với trách nhiệm và cam kết thời gian hoàn thành (SLA) minh bạch.

## Operating Context

Môi trường doanh nghiệp chuyên nghiệp trên trình duyệt máy tính và thiết bị di động. Giao diện tiếng Việt chuẩn mực, thuật ngữ hành chính công vụ nghiêm túc.

## Core Capabilities

- **Enterprise Request Templates (Mẫu yêu cầu doanh nghiệp)**: Bộ mẫu chuẩn cho CNTT, Kế toán, Pháp chế, Hành chính, Nhân sự giúp nhân viên khởi tạo nhanh chóng, đầy đủ mục đích và kết quả mong muốn.
- **SLA & Due Date Engine**: Tự động tính toán số ngày còn lại, cảnh báo hạn chót hôm nay, cảnh báo quá hạn và đo lường tỷ lệ tuân thủ SLA (%) của toàn hệ thống.
- **Dispatch & Assignment Workflow**: Trưởng phòng ban tiếp nhận phân công hoặc chuyển giao chuyên viên xử lý trực tiếp.
- **Two-way Communication & File Attachments**: Hỗ trợ trao đổi nghiệp vụ hai chiều, đính kèm hồ sơ chứng từ trong cả yêu cầu khởi tạo lẫn bình luận trao đổi.
- **Verification & CSAT Rating**: Người gửi nghiệm thu kết quả với thang điểm 5 sao, gửi ghi chú phản hồi hoặc yêu cầu làm lại nếu chưa đạt.
- **Advanced Filtering & CSV Reporting**: Tìm kiếm toàn văn, lọc theo phạm vi (Tất cả, Gửi đến phòng tôi, Tôi đã gửi, Giao cho tôi), mức ưu tiên, trạng thái, thời hạn SLA, phân công; xuất báo cáo CSV chuẩn UTF-8 BOM cho Excel.
- **Executive Lens & Quick Impersonation**: Cho phép ban lãnh đạo và kiểm toán viên chuyển đổi góc nhìn nghiệp vụ tức thì.
- **Compliance Rules**: Không sử dụng biểu tượng cảm xúc (emojis) hoặc glyph icons. Thiết kế dựa trên kiểu chữ, mã màu và hình khối kỹ thuật.
