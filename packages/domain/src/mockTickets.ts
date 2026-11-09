import type { Ticket } from './ticket.ts'
import { DEPARTMENT_CODE_PREFIXES, deterministicUuid, formatTicketCode, formatTicketPeriod } from './ticketCode.ts'

// Draft rows keep a readable legacy key as id; it is converted to a stable uuid and a department code below
type MockTicketDraft = Omit<Ticket, 'code'>
const LEGACY_KEY_PATTERN = /TCK-\d{4}/g

const DAY_MS = 24 * 60 * 60 * 1000

// Every date is an offset from the injected clock so the sample data never goes stale
export function buildMockTickets(now: Date): Ticket[] {
  const isoDaysFromNow = (offsetDays: number): string => new Date(now.getTime() + offsetDays * DAY_MS).toISOString()
  const dateOnlyDaysFromNow = (offsetDays: number): string => isoDaysFromNow(offsetDays).slice(0, 10)

  const drafts: MockTicketDraft[] = [
  {
    id: 'TCK-1010',
    title: 'Bổ sung giấy phép kinh doanh bản sao y cho hồ sơ thầu',
    description: 'Pháp chế cần bản sao y còn hiệu lực. Nhờ bên Kinh doanh gửi lại bản scan rõ nét kèm dấu giáp lai.',
    priority: 'high',
    status: 'waiting',
    requesterName: 'Nguyễn Minh Anh',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Pháp chế',
    assigneeName: 'Đỗ Hoàng Nam',
    dueDate: dateOnlyDaysFromNow(1),
    createdAt: isoDaysFromNow(-3),
    updatedAt: isoDaysFromNow(0),
    attachments: [{ name: 'ho-so-thau-ban-nhap.pdf', sizeKb: 1240 }],
    comments: [
      {
        id: 'c-1010-1',
        author: 'Đỗ Hoàng Nam',
        department: 'Pháp chế',
        body: 'Bản scan trước bị mờ phần dấu, anh chị gửi lại giúp trong hôm nay.',
        createdAt: isoDaysFromNow(0),
      },
    ],
  },
  {
    id: 'TCK-1009',
    title: 'Danh sách khách hàng tiềm năng cho chiến dịch tháng 12',
    description: 'Marketing cần danh sách khách hàng đã từng mua trong 12 tháng qua, tách theo khu vực, để chạy chiến dịch email.',
    priority: 'medium',
    status: 'open',
    requesterName: 'Phạm Khánh Linh',
    fromDepartment: 'Marketing',
    toDepartment: 'Kinh doanh',
    dueDate: dateOnlyDaysFromNow(4),
    createdAt: isoDaysFromNow(0),
    updatedAt: isoDaysFromNow(0),
    attachments: [],
    comments: [],
  },
  {
    id: 'TCK-1008',
    title: 'Cấp tài khoản email cho nhân viên mới',
    description: 'Ba nhân viên kinh doanh bắt đầu làm việc vào thứ Hai tuần sau, cần email công ty và quyền vào CRM.',
    priority: 'high',
    status: 'open',
    requesterName: 'Nguyễn Minh Anh',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Công nghệ thông tin',
    dueDate: dateOnlyDaysFromNow(3),
    createdAt: isoDaysFromNow(-1),
    updatedAt: isoDaysFromNow(-1),
    attachments: [],
    comments: [],
  },
  {
    id: 'TCK-1007',
    title: 'Xuất báo cáo công nợ khách hàng quý này',
    description: 'Cần bảng công nợ theo từng khách hàng, tách riêng các khoản quá hạn trên 30 ngày, để chuẩn bị họp với giám đốc.',
    priority: 'urgent',
    status: 'in_progress',
    requesterName: 'Trần Quốc Bảo',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Kế toán',
    assigneeName: 'Lê Thu Hà',
    dueDate: dateOnlyDaysFromNow(-1),
    createdAt: isoDaysFromNow(-4),
    updatedAt: isoDaysFromNow(-1),
    attachments: [{ name: 'mau-bao-cao-cong-no.xlsx', sizeKb: 86 }],
    comments: [
      {
        id: 'c-1007-1',
        author: 'Lê Thu Hà',
        department: 'Kế toán',
        body: 'Mình đang đối chiếu số liệu với sổ phụ, chiều nay gửi bản nháp.',
        createdAt: isoDaysFromNow(-1),
      },
    ],
  },
  {
    id: 'TCK-1006',
    title: 'Duyệt nội dung chương trình khuyến mãi tháng 12',
    description: 'Nhờ pháp chế xem lại điều khoản chương trình khuyến mãi trước khi đăng lên website và mạng xã hội.',
    priority: 'medium',
    status: 'waiting',
    requesterName: 'Phạm Khánh Linh',
    fromDepartment: 'Marketing',
    toDepartment: 'Pháp chế',
    assigneeName: 'Đỗ Hoàng Nam',
    dueDate: dateOnlyDaysFromNow(5),
    createdAt: isoDaysFromNow(-6),
    updatedAt: isoDaysFromNow(-2),
    attachments: [],
    comments: [
      {
        id: 'c-1006-1',
        author: 'Đỗ Hoàng Nam',
        department: 'Pháp chế',
        body: 'Điều khoản số 3 chưa nêu rõ thời hạn áp dụng, bên Marketing bổ sung giúp.',
        createdAt: isoDaysFromNow(-2),
      },
    ],
  },
  {
    id: 'TCK-1005',
    title: 'Máy chiếu phòng họp tầng 3 không lên hình',
    description: 'Cắm cáp HDMI nhưng máy chiếu báo không có tín hiệu, đã thử hai laptop khác nhau.',
    priority: 'high',
    status: 'in_progress',
    requesterName: 'Vũ Thanh Tùng',
    fromDepartment: 'Vận hành',
    toDepartment: 'Công nghệ thông tin',
    assigneeName: 'Hoàng Gia Huy',
    createdAt: isoDaysFromNow(-2),
    updatedAt: isoDaysFromNow(-1),
    attachments: [],
    comments: [],
  },
  {
    id: 'TCK-1004',
    title: 'Xác nhận bảng lương tháng trước cho phòng Kinh doanh',
    description: 'Có hai nhân viên phản ánh thiếu khoản thưởng doanh số, nhờ nhân sự kiểm tra lại.',
    priority: 'medium',
    status: 'open',
    requesterName: 'Trần Quốc Bảo',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Nhân sự',
    dueDate: dateOnlyDaysFromNow(2),
    createdAt: isoDaysFromNow(-3),
    updatedAt: isoDaysFromNow(-3),
    attachments: [],
    comments: [],
  },
  {
    id: 'TCK-1003',
    title: 'Đặt phòng họp lớn cho buổi đào tạo sản phẩm',
    description: 'Cần phòng sức chứa 40 người, có máy chiếu, vào sáng thứ Năm tuần tới.',
    priority: 'low',
    status: 'resolved',
    requesterName: 'Nguyễn Minh Anh',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Hành chính',
    assigneeName: 'Bùi Mai Phương',
    createdAt: isoDaysFromNow(-8),
    updatedAt: isoDaysFromNow(-5),
    attachments: [],
    comments: [
      {
        id: 'c-1003-1',
        author: 'Bùi Mai Phương',
        department: 'Hành chính',
        body: 'Đã đặt phòng A301, anh chị nhận xác nhận qua email.',
        createdAt: isoDaysFromNow(-5),
      },
    ],
  },
  {
    id: 'TCK-1002',
    title: 'Thiết kế banner cho trang đối tác',
    description: 'Cần ba kích thước banner theo bộ nhận diện mới để gắn lên trang đối tác.',
    priority: 'medium',
    status: 'closed',
    requesterName: 'Vũ Thanh Tùng',
    fromDepartment: 'Vận hành',
    toDepartment: 'Marketing',
    assigneeName: 'Phạm Khánh Linh',
    rating: 5,
    feedback: 'Thiết kế rất đẹp, chuẩn nhận diện thương hiệu mới và hoàn thành đúng cam kết.',
    createdAt: isoDaysFromNow(-14),
    updatedAt: isoDaysFromNow(-9),
    attachments: [],
    comments: [],
  },
  {
    id: 'TCK-1001',
    title: 'Rà soát hợp đồng nhà cung cấp văn phòng phẩm',
    description: 'Hợp đồng sắp hết hạn, cần pháp chế rà soát điều khoản gia hạn trước khi ký.',
    priority: 'low',
    status: 'waiting',
    requesterName: 'Bùi Mai Phương',
    fromDepartment: 'Hành chính',
    toDepartment: 'Pháp chế',
    assigneeName: 'Đỗ Hoàng Nam',
    dueDate: dateOnlyDaysFromNow(10),
    createdAt: isoDaysFromNow(-10),
    updatedAt: isoDaysFromNow(-4),
    attachments: [],
    comments: [],
  },

  {
    id: 'TCK-1011',
    title: 'Sửa hệ thống chiếu sáng kho hàng khu B',
    description: 'Ba dãy đèn khu B không sáng, nhân viên kho phải dùng đèn pin khi kiểm hàng buổi tối.',
    priority: 'urgent',
    status: 'open',
    requesterName: 'Lê Thu Hà',
    fromDepartment: 'Kế toán',
    toDepartment: 'Vận hành',
    dueDate: dateOnlyDaysFromNow(0),
    createdAt: isoDaysFromNow(-1),
    updatedAt: isoDaysFromNow(-1),
    attachments: [{ name: 'anh-hien-truong.jpg', sizeKb: 640 }],
    comments: [],
    statusHistory: [{ status: 'open', at: isoDaysFromNow(-1) }],
  },
  {
    id: 'TCK-1012',
    title: 'Báo cáo chi phí quảng cáo quý trước',
    description: 'Cần bảng tổng hợp chi phí quảng cáo theo kênh, đã làm lại một lần do thiếu kênh mạng xã hội.',
    priority: 'medium',
    status: 'closed',
    requesterName: 'Phạm Khánh Linh',
    fromDepartment: 'Marketing',
    toDepartment: 'Kế toán',
    assigneeName: 'Tạ Bảo Trân',
    rating: 4,
    feedback: 'Bản làm lại đã đủ kênh, giao hơi trễ so với hạn.',
    dueDate: dateOnlyDaysFromNow(-8),
    createdAt: isoDaysFromNow(-15),
    updatedAt: isoDaysFromNow(-5),
    attachments: [],
    comments: [],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-15) },
      { status: 'in_progress', at: isoDaysFromNow(-14) },
      { status: 'resolved', at: isoDaysFromNow(-10) },
      { status: 'in_progress', at: isoDaysFromNow(-9), reason: 'Thiếu số liệu kênh mạng xã hội' },
      { status: 'resolved', at: isoDaysFromNow(-6) },
      { status: 'closed', at: isoDaysFromNow(-5) },
    ],
    assignmentHistory: [{ to: 'Lê Thu Hà', at: isoDaysFromNow(-14) }, { from: 'Lê Thu Hà', to: 'Tạ Bảo Trân', at: isoDaysFromNow(-9) }],
  },
  {
    id: 'TCK-1013',
    title: 'Thêm quyền truy cập thư mục dùng chung của phòng Nhân sự',
    description: 'Yêu cầu bị hủy vì đã được cấp quyền qua kênh khác, ghi lại để tránh xử lý trùng.',
    priority: 'low',
    status: 'closed',
    requesterName: 'Đỗ Hoàng Nam',
    fromDepartment: 'Pháp chế',
    toDepartment: 'Công nghệ thông tin',
    cancelReason: 'Quyền đã được cấp qua yêu cầu TCK-1008, không cần xử lý thêm.',
    createdAt: isoDaysFromNow(-7),
    updatedAt: isoDaysFromNow(-6),
    attachments: [],
    comments: [],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-7) },
      { status: 'closed', at: isoDaysFromNow(-6), reason: 'Quyền đã được cấp qua yêu cầu TCK-1008, không cần xử lý thêm.' },
    ],
  },
  {
    id: 'TCK-1014',
    title: 'Chuyển giao bộ hồ sơ đào tạo nhân viên mới',
    description: 'Cần bộ hồ sơ đào tạo gồm nội quy, quy trình và lịch học, ưu tiên gửi trước thứ Sáu.',
    priority: 'high',
    status: 'in_progress',
    requesterName: 'Trần Quốc Bảo',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Nhân sự',
    assigneeName: 'Hồ Thúy Vy',
    dueDate: dateOnlyDaysFromNow(2),
    createdAt: isoDaysFromNow(-5),
    updatedAt: isoDaysFromNow(-1),
    attachments: [],
    comments: [
      {
        id: 'c-1014-1',
        author: 'Hồ Thúy Vy',
        department: 'Nhân sự',
        body: 'Mình tiếp nhận từ chị Nhung, đã có bản nháp lịch học đính kèm.',
        createdAt: isoDaysFromNow(-1),
        attachments: [{ name: 'lich-hoc-nhap.xlsx', sizeKb: 54 }],
      },
    ],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-5) },
      { status: 'in_progress', at: isoDaysFromNow(-4) },
    ],
    assignmentHistory: [
      { to: 'Lý Hồng Nhung', at: isoDaysFromNow(-4) },
      { from: 'Lý Hồng Nhung', to: 'Hồ Thúy Vy', at: isoDaysFromNow(-2) },
    ],
  },
  {
    id: 'TCK-1015',
    title: 'Hoàn tất bàn giao tài sản văn phòng cũ',
    description: 'Danh sách tài sản đã kiểm kê đầy đủ, chờ người gửi nghiệm thu.',
    priority: 'low',
    status: 'resolved',
    requesterName: 'Vũ Thanh Tùng',
    fromDepartment: 'Vận hành',
    toDepartment: 'Hành chính',
    assigneeName: 'Lâm Mỹ Duyên',
    dueDate: dateOnlyDaysFromNow(-3),
    createdAt: isoDaysFromNow(-12),
    updatedAt: isoDaysFromNow(-1),
    attachments: [],
    comments: [],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-12) },
      { status: 'in_progress', at: isoDaysFromNow(-11) },
      { status: 'resolved', at: isoDaysFromNow(-1) },
    ],
  },
  {
    id: 'TCK-1016',
    title: 'Xác nhận số ngày phép còn lại của nhóm hạ tầng',
    description: 'Nhóm hạ tầng cần số ngày phép còn lại để sắp lịch trực cuối năm.',
    priority: 'medium',
    status: 'open',
    requesterName: 'Đặng Văn Khoa',
    fromDepartment: 'Công nghệ thông tin',
    toDepartment: 'Nhân sự',
    dueDate: dateOnlyDaysFromNow(6),
    createdAt: isoDaysFromNow(0),
    updatedAt: isoDaysFromNow(0),
    attachments: [],
    comments: [],
    statusHistory: [{ status: 'open', at: isoDaysFromNow(0) }],
  },
  {
    id: 'TCK-1017',
    title: 'Chi tạm ứng công tác phí cho đoàn tuyển dụng',
    description: 'Đoàn tuyển dụng đi ba tỉnh trong tuần tới, cần tạm ứng theo định mức đã duyệt.',
    priority: 'high',
    status: 'in_progress',
    requesterName: 'Mai Thị Lan',
    fromDepartment: 'Nhân sự',
    toDepartment: 'Kế toán',
    assigneeName: 'Lê Thu Hà',
    dueDate: dateOnlyDaysFromNow(1),
    createdAt: isoDaysFromNow(-2),
    updatedAt: isoDaysFromNow(-1),
    attachments: [{ name: 'de-nghi-tam-ung.pdf', sizeKb: 210 }],
    comments: [],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-2) },
      { status: 'in_progress', at: isoDaysFromNow(-1) },
    ],
    assignmentHistory: [{ to: 'Lê Thu Hà', at: isoDaysFromNow(-1) }],
  },
  {
    id: 'TCK-1018',
    title: 'Cấp lại thẻ từ ra vào cho nhân sự mới',
    description: 'Thẻ từ đã cấp đủ, người gửi đã nghiệm thu và chờ Trưởng phòng Vận hành duyệt.',
    priority: 'low',
    status: 'pending_approval',
    requesterName: 'Vũ Thanh Tùng',
    fromDepartment: 'Vận hành',
    toDepartment: 'Hành chính',
    assigneeName: 'Lâm Mỹ Duyên',
    dueDate: dateOnlyDaysFromNow(2),
    createdAt: isoDaysFromNow(-6),
    updatedAt: isoDaysFromNow(-1),
    rating: 5,
    attachments: [],
    comments: [],
    statusHistory: [
      { status: 'open', at: isoDaysFromNow(-6) },
      { status: 'in_progress', at: isoDaysFromNow(-5) },
      { status: 'resolved', at: isoDaysFromNow(-2) },
      { status: 'pending_approval', at: isoDaysFromNow(-1) },
    ],
    assignmentHistory: [{ to: 'Lâm Mỹ Duyên', at: isoDaysFromNow(-5) }],
  },
  ]

  return assignCodesAndUuids(drafts)
}

// Codes follow creation order per receiving department and month, so they read like real allocations
function assignCodesAndUuids(drafts: MockTicketDraft[]): Ticket[] {
  const counters = new Map<string, number>()
  const codeByLegacyKey = new Map<string, string>()
  const chronological = [...drafts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const draft of chronological) {
    const prefix = DEPARTMENT_CODE_PREFIXES[draft.toDepartment]
    const period = formatTicketPeriod(new Date(draft.createdAt))
    const counterKey = `${prefix}-${period}`
    const sequence = (counters.get(counterKey) ?? 0) + 1
    counters.set(counterKey, sequence)
    codeByLegacyKey.set(draft.id, formatTicketCode(prefix, period, sequence))
  }

  // One serialization pass swaps every id for a stable uuid and every legacy key mentioned in text for its code
  const rewritten = JSON.parse(
    JSON.stringify(drafts, (key, value) => {
      if (typeof value !== 'string') return value
      if (key === 'id') return deterministicUuid(`mock:${value}`)
      return value.replace(LEGACY_KEY_PATTERN, (legacyKey) => codeByLegacyKey.get(legacyKey) ?? legacyKey)
    }),
  ) as MockTicketDraft[]

  return rewritten.map((draft, index) => ({ ...draft, code: codeByLegacyKey.get(drafts[index].id) as string }))
}

export const MOCK_TICKETS: Ticket[] = buildMockTickets(new Date())
