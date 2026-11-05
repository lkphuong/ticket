import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState.tsx'

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-line bg-surface shadow-lift">
      <EmptyState
        title="Không tìm thấy trang hoặc yêu cầu"
        description="Đường dẫn truy cập không chính xác hoặc yêu cầu này không còn tồn tại trên hệ thống."
      />
      <p className="pb-8 text-center">
        <Link to="/tickets" className="text-sm font-semibold text-accent-700 underline-offset-4 hover:underline">
          Quay lại danh sách yêu cầu hỗ trợ
        </Link>
      </p>
    </div>
  )
}
