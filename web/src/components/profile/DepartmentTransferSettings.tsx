// Shows the member's department and lets staff ask to move; the move only happens once the current head approves

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiClient } from '../../lib/apiClient.ts'
import type { DepartmentTransfer } from '../../lib/apiClient.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useAuth } from '../../state/useAuth.ts'
import { useRegistrationDirectory } from '../auth/useRegistrationDirectory.ts'
import { Button } from '../ui/Button.tsx'
import { Select } from '../ui/Select.tsx'

function describeLatestRequest(transfer: DepartmentTransfer): string | null {
  if (transfer.status === 'rejected') {
    return `Yêu cầu chuyển sang phòng ${transfer.toDepartment} đã bị từ chối. Lý do: ${transfer.rejectReason ?? 'không có'}`
  }
  return null
}

export function DepartmentTransferSettings() {
  const { viewer } = useAuth()
  const { notify } = useToast()
  const { departments } = useRegistrationDirectory()
  const [latest, setLatest] = useState<DepartmentTransfer | null>(null)
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const isStaff = viewer?.role === 'staff'

  const loadLatest = useCallback(async () => {
    const res = await apiClient.departmentTransfers.mine()
    setLatest(res.transfer)
  }, [])

  useEffect(() => {
    if (!isStaff) return
    let isActive = true
    apiClient.departmentTransfers
      .mine()
      .then((res) => {
        if (isActive) setLatest(res.transfer)
      })
      .catch((err: unknown) => console.warn('Department transfer status could not be loaded', err))
    return () => {
      isActive = false
    }
  }, [isStaff])

  const options = useMemo(
    () => departments.filter((name) => name !== viewer?.department).map((name) => ({ value: name, label: name })),
    [departments, viewer?.department],
  )

  if (!viewer) return null

  async function run(action: () => Promise<void>, successMessage: string) {
    setError('')
    setIsBusy(true)
    try {
      await action()
      notify(successMessage, 'success')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Không thể xử lý yêu cầu luân chuyển.')
    } finally {
      setIsBusy(false)
    }
  }

  const submitRequest = () =>
    run(async () => {
      const res = await apiClient.departmentTransfers.request(target)
      setLatest(res.transfer)
      setTarget('')
    }, 'Đã gửi yêu cầu luân chuyển, chờ Trưởng phòng xác nhận.')

  const cancelRequest = () =>
    run(async () => {
      await apiClient.departmentTransfers.cancelMine()
      await loadLatest()
    }, 'Đã hủy yêu cầu luân chuyển.')

  const isPending = latest?.status === 'pending'
  const lastDecision = latest && !isPending ? describeLatestRequest(latest) : null

  return (
    <section aria-labelledby="profile-department-heading" className="flex flex-col gap-2">
      <h3 id="profile-department-heading" className="text-xs font-bold tracking-wider text-ink uppercase">
        Phòng ban
      </h3>
      <p className="text-sm text-ink">
        Hiện tại: <span className="font-semibold">{viewer.department}</span>
      </p>

      {!isStaff && (
        <p className="text-xs text-ink-muted">Trưởng phòng và Quản trị được chuyển phòng ban bởi Quản trị trong mục Quản trị hệ thống.</p>
      )}

      {isStaff && isPending && latest && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-canvas p-3 text-xs">
          <p className="text-ink">
            Đang chờ Trưởng phòng {latest.fromDepartment} xác nhận chuyển sang phòng <span className="font-semibold">{latest.toDepartment}</span>.
          </p>
          <div>
            <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={isBusy} onClick={() => void cancelRequest()}>
              Hủy yêu cầu
            </Button>
          </div>
        </div>
      )}

      {isStaff && !isPending && (
        <>
          {lastDecision && <p className="text-xs text-brick-700">{lastDecision}</p>}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                id="profile-transfer-target"
                ariaLabel="Phòng ban muốn chuyển đến"
                value={target}
                options={options}
                placeholder="Chọn phòng ban muốn chuyển đến"
                onChange={setTarget}
              />
            </div>
            <Button className="px-3 py-2 text-xs" disabled={isBusy || target === ''} onClick={() => void submitRequest()}>
              Gửi yêu cầu
            </Button>
          </div>
          <p className="text-xs text-ink-muted">Việc chuyển phòng chỉ có hiệu lực sau khi Trưởng phòng hiện tại xác nhận.</p>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs text-brick-700">
          {error}
        </p>
      )}
    </section>
  )
}
