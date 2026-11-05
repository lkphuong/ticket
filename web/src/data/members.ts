import type { Viewer } from '../domain/ticket.ts'

export interface Member extends Viewer {
  username: string
}

// Synthetic directory standing in for the future user service
export const MEMBERS: Member[] = [
  { username: 'minhanh', name: 'Nguyễn Minh Anh', department: 'Kinh doanh', isDepartmentHead: false },
  { username: 'quocbao', name: 'Trần Quốc Bảo', department: 'Kinh doanh', isDepartmentHead: true },
  { username: 'thuha', name: 'Lê Thu Hà', department: 'Kế toán', isDepartmentHead: false },
  { username: 'bichngoc', name: 'Ngô Bích Ngọc', department: 'Kế toán', isDepartmentHead: true },
  { username: 'giahuy', name: 'Hoàng Gia Huy', department: 'Công nghệ thông tin', isDepartmentHead: false },
  { username: 'vankhoa', name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin', isDepartmentHead: true },
  { username: 'khanhlinh', name: 'Phạm Khánh Linh', department: 'Marketing', isDepartmentHead: true },
  { username: 'hoangnam', name: 'Đỗ Hoàng Nam', department: 'Pháp chế', isDepartmentHead: true },
  { username: 'maiphuong', name: 'Bùi Mai Phương', department: 'Hành chính', isDepartmentHead: true },
  { username: 'thanhtung', name: 'Vũ Thanh Tùng', department: 'Vận hành', isDepartmentHead: true },
  { username: 'thilan', name: 'Mai Thị Lan', department: 'Nhân sự', isDepartmentHead: true },
  { username: 'hongnhung', name: 'Lý Hồng Nhung', department: 'Nhân sự', isDepartmentHead: false },
  { username: 'minhtuan', name: 'Cao Minh Tuấn', department: 'Pháp chế', isDepartmentHead: false },
  { username: 'thiyen', name: 'Phan Thị Yến', department: 'Hành chính', isDepartmentHead: false },
  { username: 'duclong', name: 'Trịnh Đức Long', department: 'Vận hành', isDepartmentHead: false },
  { username: 'haidang', name: 'Nguyễn Hải Đăng', department: 'Hành chính', isDepartmentHead: false, isExecutive: true },
  { username: 'quangvinh', name: 'Lương Quang Vinh', department: 'Kinh doanh', isDepartmentHead: false },
  { username: 'baotran', name: 'Tạ Bảo Trân', department: 'Kế toán', isDepartmentHead: false },
  { username: 'tuananh', name: 'Chu Tuấn Anh', department: 'Công nghệ thông tin', isDepartmentHead: false },
  { username: 'ngocdiep', name: 'Kiều Ngọc Diệp', department: 'Marketing', isDepartmentHead: false },
  { username: 'thanhhai', name: 'Võ Thanh Hải', department: 'Pháp chế', isDepartmentHead: false },
  { username: 'myduyen', name: 'Lâm Mỹ Duyên', department: 'Hành chính', isDepartmentHead: false },
  { username: 'ducminh', name: 'Âu Đức Minh', department: 'Vận hành', isDepartmentHead: false },
  { username: 'thuyvy', name: 'Hồ Thúy Vy', department: 'Nhân sự', isDepartmentHead: false },
  { username: 'thutrang', name: 'Đinh Thu Trang', department: 'Marketing', isDepartmentHead: false },
]
