import type { Department, NewTicketInput } from '../domain/ticket.ts'

export interface TicketTemplate {
  id: string
  name: string
  targetDepartment: Department
  suggestedDays: number
  values: Pick<NewTicketInput, 'title' | 'description' | 'purpose' | 'expectedResult' | 'priority' | 'toDepartment'>
}

// Pre-configured enterprise service templates for common cross-department requests
export const ENTERPRISE_TEMPLATES: readonly TicketTemplate[] = [
  {
    id: 'it-account-access',
    name: 'Cấp tài khoản & phần mềm CNTT',
    targetDepartment: 'Công nghệ thông tin',
    suggestedDays: 2,
    values: {
      title: 'Cấp tài khoản và quyền truy cập hệ thống cho nhân sự mới',
      toDepartment: 'Công nghệ thông tin',
      priority: 'medium',
      purpose: 'Cung cấp phương tiện làm việc và quyền truy cập hệ thống cho nhân viên mới theo thỏa thuận tiếp nhận.',
      description: 'Đề nghị Phòng CNTT cấp các quyền sau:\n1. Tài khoản email nội bộ theo tên định dạng chuẩn.\n2. Quyền truy cập mạng nội bộ và hệ thống VPN làm việc từ xa.\n3. Cài đặt các phần mềm văn phòng và công cụ chuyên môn.',
      expectedResult: 'Thông tin tài khoản và mật khẩu khởi tạo được gửi bảo mật tới người quản lý trực tiếp.',
    },
  },
  {
    id: 'accounting-expense',
    name: 'Thanh toán & tạm ứng công tác',
    targetDepartment: 'Kế toán',
    suggestedDays: 3,
    values: {
      title: 'Đề nghị thanh toán chi phí công tác và mua sắm trang thiết bị',
      toDepartment: 'Kế toán',
      priority: 'high',
      purpose: 'Hoàn ứng và thanh toán các khoản chi tiêu hợp lệ đã được lãnh đạo khối phê duyệt theo kế hoạch quý.',
      description: 'Kính gửi Phòng Kế toán hồ sơ đề nghị thanh toán:\n- Tổng số tiền đề nghị: Theo bảng kê chi tiết đính kèm.\n- Danh mục chứng từ: Hóa đơn điện tử hợp lệ, phiếu xác nhận giao dịch.',
      expectedResult: 'Chuyển khoản thanh toán vào tài khoản thụ hưởng và phát hành phiếu chi điện tử.',
    },
  },
  {
    id: 'legal-contract-review',
    name: 'Thẩm định hợp đồng & pháp lý',
    targetDepartment: 'Pháp chế',
    suggestedDays: 5,
    values: {
      title: 'Thẩm định điều khoản pháp lý hợp đồng dịch vụ đối tác',
      toDepartment: 'Pháp chế',
      priority: 'high',
      purpose: 'Kiểm tra rủi ro pháp lý, nghĩa vụ cam kết bảo mật và quyền sở hữu trí tuệ trước khi trình ký hợp đồng chính thức.',
      description: 'Kính gửi Phòng Pháp chế rà soát dự thảo hợp đồng đính kèm:\n- Đối tác: Doanh nghiệp cung cấp giải pháp.\n- Giá trị hợp đồng: Theo phụ lục kinh tế.\n- Trọng tâm rà soát: Điều khoản trách nhiệm bồi thường và chấm dứt hợp đồng.',
      expectedResult: 'Văn bản ý kiến pháp lý chi tiết và bản thảo hợp đồng có đánh dấu sửa đổi.',
    },
  },
  {
    id: 'admin-meeting-setup',
    name: 'Đặt phòng họp & thiết bị',
    targetDepartment: 'Hành chính',
    suggestedDays: 1,
    values: {
      title: 'Đăng ký phòng họp và trang thiết bị hội nghị',
      toDepartment: 'Hành chính',
      priority: 'medium',
      purpose: 'Phục vụ phiên họp điều hành quan trọng với ban lãnh đạo và các đối tác bên ngoài.',
      description: 'Đề nghị Phòng Hành chính sắp xếp:\n- Thời gian: Trong ngày theo lịch đăng ký.\n- Quy mô: 15 đến 20 người tham dự.\n- Yêu cầu kỹ thuật: Máy chiếu, micro hội thảo, nước uống văn phòng.',
      expectedResult: 'Phòng họp được kiểm tra kỹ thuật và sẵn sàng trước giờ họp 30 phút.',
    },
  },
  {
    id: 'hr-recruiting-request',
    name: 'Tuyển dụng & tiếp nhận nhân sự',
    targetDepartment: 'Nhân sự',
    suggestedDays: 7,
    values: {
      title: 'Yêu cầu tuyển dụng bổ sung nhân sự chuyên môn',
      toDepartment: 'Nhân sự',
      priority: 'medium',
      purpose: 'Bổ sung nhân sự đáp ứng khối lượng công việc mở rộng của dự án trọng điểm.',
      description: 'Đề nghị Phòng Nhân sự tiến hành đăng tuyển:\n- Vị trí: Chuyên viên xử lý nghiệp vụ.\n- Số lượng: 02 nhân sự.\n- Yêu cầu kinh nghiệm: Theo bản mô tả công việc JD đính kèm.',
      expectedResult: 'Đăng tuyển trên các kênh nội bộ/bên ngoài và cung cấp hồ sơ ứng viên đạt tiêu chuẩn vòng 1.',
    },
  },
]
