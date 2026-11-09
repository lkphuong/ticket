// Administrator member directory: search, filter, create, edit, lock, reset password and delete accounts

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../../components/ui/controlStyles.ts'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { FormField } from '../../components/ui/FormField.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { IconButton } from '../../components/ui/IconButton.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { Panel } from '../../components/ui/Panel.tsx'
import { SearchField } from '../../components/ui/SearchField.tsx'
import { Select } from '../../components/ui/Select.tsx'
import { apiClient } from '../../lib/apiClient.ts'
import type { CmsMember, PageMeta } from '../../lib/apiClient.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useDebouncedValue } from '../../lib/useDebouncedValue.ts'
import {
  FORM_PANEL_CLASS,
  SEARCH_DEBOUNCE_MS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
  TOOLBAR_CLASS,
} from './cmsStyles.ts'

type MemberRole = CmsMember['role']
type StatusFilter = 'all' | 'active' | 'locked'

const ALL_VALUE = 'all'
const DEFAULT_TEMP_PASSWORD = 'ticket123'
const DEFAULT_PAGE_SIZE = 20

const ROLE_LABELS: Record<MemberRole, string> = {
  staff: 'Nhân viên',
  head: 'Trưởng phòng',
  admin: 'Quản trị viên',
}

const ROLE_TONES: Record<MemberRole, string> = {
  staff: 'bg-ash-200 text-ash-700',
  head: 'bg-sea-100 text-sea-700',
  admin: 'bg-blue-100 text-blue-700',
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => ({ value: role, label: ROLE_LABELS[role] }))

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đã khóa' },
]

interface MemberFormState {
  username: string
  name: string
  department: string
  role: MemberRole
  email: string
  tempPassword: string
}

const EMPTY_FORM: MemberFormState = {
  username: '',
  name: '',
  department: '',
  role: 'staff',
  email: '',
  tempPassword: DEFAULT_TEMP_PASSWORD,
}

const EMPTY_PAGE_META: PageMeta = { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 }

// Null closes the form; 'new' creates; a member id edits that member
type FormTarget = null | 'new' | string

// Destructive row actions ask for an inline confirmation instead of opening a dialog
interface PendingConfirmation {
  memberId: string
  kind: 'lock' | 'delete'
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
        isActive ? 'bg-moss-100 text-moss-700' : 'bg-brick-100 text-brick-700'
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {isActive ? 'Hoạt động' : 'Đã khóa'}
    </span>
  )
}

export function MembersSection() {
  const { notify } = useToast()
  const [members, setMembers] = useState<CmsMember[]>([])
  const [pageMeta, setPageMeta] = useState<PageMeta>(EMPTY_PAGE_META)
  const [departmentNames, setDepartmentNames] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE)
  const [roleFilter, setRoleFilter] = useState(ALL_VALUE)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const [form, setForm] = useState<MemberFormState>(EMPTY_FORM)
  const [pending, setPending] = useState<PendingConfirmation | null>(null)

  useEffect(() => {
    let active = true
    apiClient.cms
      .getDepartmentOptions()
      .then((res) => {
        if (active) setDepartmentNames(res.departments)
      })
      .catch(() => {
        if (active) notify('Không thể tải danh sách phòng ban.', 'error')
      })
    return () => {
      active = false
    }
  }, [notify, reloadKey])

  useEffect(() => {
    let active = true
    apiClient.cms
      .getMembers({
        page,
        limit,
        search: debouncedSearch.trim(),
        department: departmentFilter === ALL_VALUE ? undefined : departmentFilter,
        role: roleFilter === ALL_VALUE ? undefined : (roleFilter as MemberRole),
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      .then((res) => {
        if (!active) return
        setMembers(res.members)
        setPageMeta({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages })
        // The server clamps out-of-range pages, so follow its answer
        if (res.page !== page) setPage(res.page)
      })
      .catch(() => {
        if (active) notify('Không thể tải danh sách thành viên.', 'error')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [notify, page, limit, debouncedSearch, departmentFilter, roleFilter, statusFilter, reloadKey])

  const isEditing = formTarget !== null && formTarget !== 'new'
  const hasActiveFilters = search !== '' || departmentFilter !== ALL_VALUE || roleFilter !== ALL_VALUE || statusFilter !== 'all'
  const departmentFilterOptions = [
    { value: ALL_VALUE, label: 'Mọi phòng ban' },
    ...departmentNames.map((name) => ({ value: name, label: name })),
  ]
  const roleFilterOptions = [{ value: ALL_VALUE, label: 'Mọi vai trò' }, ...ROLE_OPTIONS]

  // Any change to the result set sends the viewer back to the first page
  function applyFilter(change: () => void) {
    change()
    setPage(1)
  }

  function resetFilters() {
    setSearch('')
    setDepartmentFilter(ALL_VALUE)
    setRoleFilter(ALL_VALUE)
    setStatusFilter('all')
    setPage(1)
  }

  function updateForm(patch: Partial<MemberFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function openCreateForm() {
    setForm({ ...EMPTY_FORM, department: departmentNames[0] ?? '' })
    setFormTarget('new')
  }

  function openEditForm(member: CmsMember) {
    setForm({
      username: member.username,
      name: member.name,
      department: member.department,
      role: member.role,
      email: member.email ?? '',
      tempPassword: DEFAULT_TEMP_PASSWORD,
    })
    setPending(null)
    setFormTarget(member.id)
  }

  function closeForm() {
    setFormTarget(null)
  }

  async function runAction(action: () => Promise<string>, failureMessage: string): Promise<boolean> {
    try {
      notify(await action(), 'success')
      setReloadKey((key) => key + 1)
      return true
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : failureMessage, 'error')
      return false
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const email = form.email.trim()
    const saved = isEditing
      ? await runAction(async () => {
          await apiClient.cms.updateMember(formTarget, { name: form.name, department: form.department, role: form.role, email })
          return `Đã cập nhật thông tin ${form.name}.`
        }, 'Không thể cập nhật thành viên.')
      : await runAction(async () => {
          await apiClient.cms.createMember({
            username: form.username,
            name: form.name,
            department: form.department,
            role: form.role,
            isDepartmentHead: form.role === 'head',
            email: email === '' ? undefined : email,
            tempPassword: form.tempPassword,
          })
          return `Đã khởi tạo thành công tài khoản cho ${form.name}.`
        }, 'Không thể tạo thành viên.')
    if (saved) closeForm()
  }

  async function handleConfirm(member: CmsMember, kind: PendingConfirmation['kind']) {
    setPending(null)
    if (kind === 'lock') {
      await runAction(async () => {
        const res = await apiClient.cms.lockMember(member.id)
        return `Đã khóa ${member.name}. ${res.reassignedTicketsCount} yêu cầu đã chuyển về hàng đợi phòng.`
      }, 'Không thể khóa thành viên.')
      return
    }
    await runAction(async () => {
      await apiClient.cms.deleteMember(member.id)
      return `Đã xóa thành viên ${member.name}.`
    }, 'Không thể xóa thành viên.')
  }

  async function handleUnlock(member: CmsMember) {
    await runAction(async () => {
      await apiClient.cms.unlockMember(member.id)
      return `Đã mở khóa tài khoản cho ${member.name}.`
    }, 'Không thể mở khóa thành viên.')
  }

  async function handleResetPassword(member: CmsMember) {
    try {
      const res = await apiClient.cms.resetPassword(member.id)
      notify(`Đã đặt lại mật khẩu cho ${member.name}. Mật khẩu tạm: ${res.temporaryPassword}`, 'success')
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.', 'error')
    }
  }

  function renderRowActions(member: CmsMember) {
    if (pending?.memberId === member.id) {
      const verb = pending.kind === 'delete' ? 'Xóa' : 'Khóa'
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-medium text-ink">{verb} {member.name}?</span>
          <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => void handleConfirm(member, pending.kind)}>
            {verb}
          </Button>
          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setPending(null)}>
            Hủy
          </Button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-end gap-0.5">
        <IconButton icon="pencil" label={`Sửa ${member.name}`} onClick={() => openEditForm(member)} />
        <IconButton icon="key" label={`Đặt lại mật khẩu cho ${member.name}`} onClick={() => void handleResetPassword(member)} />
        {member.isActive ? (
          <IconButton
            icon="lock"
            tone="danger"
            label={`Khóa ${member.name}`}
            onClick={() => setPending({ memberId: member.id, kind: 'lock' })}
          />
        ) : (
          <IconButton icon="unlock" tone="success" label={`Mở khóa ${member.name}`} onClick={() => void handleUnlock(member)} />
        )}
        <IconButton
          icon="trash"
          tone="danger"
          label={`Xóa ${member.name}`}
          onClick={() => setPending({ memberId: member.id, kind: 'delete' })}
        />
      </div>
    )
  }

  return (
    <Panel
      title={`${pageMeta.total} thành viên`}
      aside={
        <Button className="gap-1.5 py-1.5 whitespace-nowrap" onClick={() => (formTarget === null ? openCreateForm() : closeForm())}>
          <Icon name={formTarget === null ? 'plus' : 'x'} />
          {formTarget === null ? 'Thêm thành viên' : 'Đóng biểu mẫu'}
        </Button>
      }
    >
      {formTarget !== null && (
        <form onSubmit={handleSubmit} className={`${FORM_PANEL_CLASS} grid gap-3 sm:grid-cols-2`}>
          <h3 className="text-sm font-bold text-ink sm:col-span-2">
            {isEditing ? `Chỉnh sửa ${form.name || 'thành viên'}` : 'Thêm thành viên mới'}
          </h3>
          <FormField id="cms-member-user" label="Tên đăng nhập">
            <input
              id="cms-member-user"
              required
              disabled={isEditing}
              value={form.username}
              onChange={(e) => updateForm({ username: e.target.value })}
              className={`${CONTROL_CLASS} disabled:bg-canvas disabled:text-ink-muted`}
            />
          </FormField>
          <FormField id="cms-member-name" label="Họ và tên">
            <input
              id="cms-member-name"
              required
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField id="cms-member-dept" label="Phòng ban">
            <Select
              id="cms-member-dept"
              value={form.department}
              options={departmentNames.map((name) => ({ value: name, label: name }))}
              onChange={(value) => updateForm({ department: value })}
            />
          </FormField>
          <FormField id="cms-member-role" label="Vai trò hệ thống">
            <Select
              id="cms-member-role"
              value={form.role}
              options={ROLE_OPTIONS}
              onChange={(value) => updateForm({ role: value })}
            />
          </FormField>
          <FormField id="cms-member-email" label="Email (tùy chọn)">
            <input
              id="cms-member-email"
              type="email"
              value={form.email}
              onChange={(e) => updateForm({ email: e.target.value })}
              className={CONTROL_CLASS}
            />
          </FormField>
          {!isEditing && (
            <FormField id="cms-member-pass" label="Mật khẩu tạm" hint="Thành viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.">
              <input
                id="cms-member-pass"
                required
                value={form.tempPassword}
                onChange={(e) => updateForm({ tempPassword: e.target.value })}
                className={CONTROL_CLASS}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
            <Button variant="secondary" onClick={closeForm}>
              Hủy
            </Button>
            <Button type="submit" className="gap-1.5">
              <Icon name="check" />
              {isEditing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      )}

      <div className={TOOLBAR_CLASS}>
        <SearchField
          value={search}
          onChange={(value) => applyFilter(() => setSearch(value))}
          placeholder="Tìm tên, tài khoản, email"
          ariaLabel="Tìm thành viên"
        />
        <Select
          compact
          ariaLabel="Lọc theo phòng ban"
          value={departmentFilter}
          options={departmentFilterOptions}
          onChange={(value) => applyFilter(() => setDepartmentFilter(value))}
        />
        <Select
          compact
          ariaLabel="Lọc theo vai trò"
          value={roleFilter}
          options={roleFilterOptions}
          onChange={(value) => applyFilter(() => setRoleFilter(value))}
        />
        <Select
          compact
          ariaLabel="Lọc theo trạng thái"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(value) => applyFilter(() => setStatusFilter(value))}
        />
        {hasActiveFilters && (
          <Button variant="secondary" className="gap-1.5 py-1.5 text-xs" onClick={resetFilters}>
            <Icon name="x" className="size-3.5" />
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {members.length === 0 && !isLoading ? (
        <EmptyState
          title={hasActiveFilters ? 'Không có thành viên phù hợp' : 'Chưa có thành viên nào'}
          description={hasActiveFilters ? 'Thử đổi từ khóa hoặc xóa bớt bộ lọc.' : 'Thêm thành viên đầu tiên để bắt đầu.'}
        />
      ) : (
        <div className={`overflow-x-auto transition-opacity ${isLoading ? 'opacity-60' : ''}`} aria-busy={isLoading}>
          <table className="w-full text-left text-sm">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Thành viên</th>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Phòng ban</th>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Vai trò</th>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Trạng thái</th>
                <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((member) => (
                <tr key={member.id} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_CELL_CLASS}>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ash-200 text-ash-700"
                      >
                        <Icon name="user" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{member.name}</p>
                        <p className="truncate text-xs text-ink-muted">{member.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className={`${TABLE_CELL_CLASS} text-ink`}>{member.department}</td>
                  <td className={TABLE_CELL_CLASS}>
                    <Badge label={ROLE_LABELS[member.role]} toneClass={ROLE_TONES[member.role]} />
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    <StatusBadge isActive={member.isActive} />
                  </td>
                  <td className={`${TABLE_CELL_CLASS} min-w-48`}>{renderRowActions(member)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={pageMeta.page}
        limit={pageMeta.limit}
        total={pageMeta.total}
        totalPages={pageMeta.totalPages}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value)
          setPage(1)
        }}
      />
    </Panel>
  )
}
