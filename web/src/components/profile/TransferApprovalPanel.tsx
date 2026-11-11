// Department head queue of members asking to leave the department; approving moves them, rejecting needs a reason

import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiClient } from '../../lib/apiClient.ts'
import type { DepartmentTransfer } from '../../lib/apiClient.ts'
import { formatDateTime } from '../../lib/formatDate.ts'
import { useToast } from '../../lib/toastContext.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Panel } from '../ui/Panel.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'

export function TransferApprovalPanel() {
  const { notify } = useToast()
  const [transfers, setTransfers] = useState<DepartmentTransfer[]>([])
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await apiClient.departmentTransfers.incoming()
    setTransfers(res.transfers)
  }, [])

  useEffect(() => {
    let isActive = true
    apiClient.departmentTransfers
      .incoming()
      .then((res) => {
        if (isActive) setTransfers(res.transfers)
      })
      .catch((err: unknown) => console.warn('Incoming transfer requests could not be loaded', err))
    return () => {
      isActive = false
    }
  }, [])

  async function decide(transfer: DepartmentTransfer, action: () => Promise<unknown>, successMessage: string) {
    setBusyId(transfer.id)
    try {
      await action()
      notify(successMessage, 'success')
      setRejectingId(null)
      setReason('')
    } catch (err: unknown) {
      notify(err instanceof ApiError ? err.message : 'Không thể xử lý yêu cầu luân chuyển.', 'error')
    } finally {
      setBusyId(null)
      await load().catch((err: unknown) => console.warn('Incoming transfer requests could not be reloaded', err))
    }
  }

  return (
    <Panel title={`Yêu cầu luân chuyển phòng ban (${transfers.length})`}>
      {transfers.length === 0 ? (
        <EmptyState title="Không có yêu cầu luân chuyển" description="Khi nhân viên xin chuyển khỏi phòng, yêu cầu sẽ chờ bạn xác nhận tại đây." />
      ) : (
        <ul className="divide-y divide-line">
          {transfers.map((transfer) => (
            <li key={transfer.id} className="flex flex-col gap-2 px-4 py-3">
              <p className="text-sm text-ink">
                <span className="font-semibold">{transfer.memberName}</span> xin chuyển từ {transfer.fromDepartment} sang{' '}
                <span className="font-semibold">{transfer.toDepartment}</span>
              </p>
              <p className="text-xs text-ink-muted">Gửi lúc {formatDateTime(transfer.requestedAt)}</p>

              {rejectingId === transfer.id ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor={`reject-reason-${transfer.id}`} className="text-xs font-medium text-ink">
                    Lý do từ chối
                  </label>
                  <input
                    id={`reject-reason-${transfer.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    className={CONTROL_CLASS}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      disabled={busyId === transfer.id || reason.trim() === ''}
                      onClick={() => void decide(transfer, () => apiClient.departmentTransfers.reject(transfer.id, reason.trim()), 'Đã từ chối yêu cầu luân chuyển.')}
                    >
                      Xác nhận từ chối
                    </Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setRejectingId(null)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="px-3 py-1.5 text-xs"
                    disabled={busyId === transfer.id}
                    onClick={() => void decide(transfer, () => apiClient.departmentTransfers.approve(transfer.id), 'Đã duyệt luân chuyển.')}
                  >
                    Duyệt luân chuyển
                  </Button>
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busyId === transfer.id} onClick={() => setRejectingId(transfer.id)}>
                    Từ chối
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
