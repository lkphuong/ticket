// Administrative CMS console for managing enterprise members, departments, request templates, and SLAs

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { FormField } from '../components/ui/FormField.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Panel } from '../components/ui/Panel.tsx'
import { Select } from '../components/ui/Select.tsx'
import { PRIORITY_LABELS, TICKET_PRIORITIES } from '../domain/ticket.ts'
import type { TicketPriority } from '../domain/ticket.ts'
import { apiClient } from '../lib/apiClient.ts'
import type { CmsAuditLog, CmsMember, CmsSla, CmsTemplate } from '../lib/apiClient.ts'
import { formatDateTime } from '../lib/formatDate.ts'
import { useToast } from '../lib/toastContext.ts'
import { getViewerRole } from '../lib/viewerRole.ts'
import { useAuth } from '../state/useAuth.ts'

type CmsTab = 'members' | 'departments' | 'templates' | 'slas' | 'audit'

const TAB_OPTIONS: { id: CmsTab; label: string }[] = [
  { id: 'members', label: 'Thành viên' },
  { id: 'departments', label: 'Phòng ban' },
  { id: 'templates', label: 'Mẫu yêu cầu' },
  { id: 'slas', label: 'SLA mặc định' },
  { id: 'audit', label: 'Nhật ký kiểm toán' },
]

export function CmsPage() {
  const { viewer } = useAuth()
  const [activeTab, setActiveTab] = useState<CmsTab>('members')

  // Access guard: strictly allow Administrator role only
  const isAdmin = viewer ? getViewerRole(viewer) === 'admin' : false
  if (!isAdmin) {
    return (
      <main className="rounded-lg border border-brick-500/30 bg-brick-100/30 p-8 text-center">
        <h1 className="text-base font-bold text-brick-700">Truy cập bị từ chối</h1>
        <p className="mt-2 text-xs text-ink-muted">Chỉ Quản trị viên hệ thống mới có quyền truy cập vào màn hình quản lý CMS.</p>
      </main>
    )
  }

  return (
    <>
      <PageHeader
        title="Quản trị hệ thống (CMS)"
        description="Quản lý thành viên, danh mục phòng ban, biểu mẫu yêu cầu chuẩn và cấu hình cam kết SLA toàn doanh nghiệp."
      />

      <div className="mb-6 border-b border-line">
        <nav className="-mb-px flex gap-2 overflow-x-auto" aria-label="Phân hệ quản trị">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-accent-600 text-ink'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'members' && <MembersSection />}
      {activeTab === 'departments' && <DepartmentsSection />}
      {activeTab === 'templates' && <TemplatesSection />}
      {activeTab === 'slas' && <SlasSection />}
      {activeTab === 'audit' && <AuditSection />}
    </>
  )
}

function MembersSection() {
  const { notify } = useToast()
  const [members, setMembers] = useState<CmsMember[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newName, setNewName] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [newRole, setNewRole] = useState<'staff' | 'head' | 'admin'>('staff')
  const [newEmail, setNewEmail] = useState('')
  const [newTempPassword, setNewTempPassword] = useState('ticket123')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([apiClient.cms.getMembers(), apiClient.cms.getDepartments()])
      .then(([membersRes, deptsRes]) => {
        if (!active) return
        setMembers(membersRes.members)
        setDepartments(deptsRes.departments)
        if (deptsRes.departments.length > 0 && !newDepartment) {
          setNewDepartment(deptsRes.departments[0])
        }
      })
      .catch(() => {
        if (active) {
          notify('Không thể tải danh sách thành viên.', 'danger')
        }
      })

    return () => {
      active = false
    }
  }, [notify, newDepartment, reloadKey])

  async function handleCreateMember(e: FormEvent) {
    e.preventDefault()
    try {
      await apiClient.cms.createMember({
        username: newUsername,
        name: newName,
        department: newDepartment,
        role: newRole,
        isDepartmentHead: newRole === 'head',
        email: newEmail.trim() === '' ? undefined : newEmail.trim(),
        tempPassword: newTempPassword,
      })
      notify(`Đã khởi tạo thành công tài khoản cho ${newName}.`, 'success')
      setIsCreating(false)
      setNewUsername('')
      setNewName('')
      setNewEmail('')
      setReloadKey((k) => k + 1)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể tạo thành viên.', 'danger')
    }
  }

  async function handleLock(member: CmsMember) {
    try {
      const res = await apiClient.cms.lockMember(member.id)
      notify(`Đã khóa thành viên ${member.name}. ${res.reassignedTicketsCount} yêu cầu đã chuyển về hàng đợi phòng.`, 'neutral')
      setReloadKey((k) => k + 1)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể khóa thành viên.', 'danger')
    }
  }

  async function handleUnlock(member: CmsMember) {
    try {
      await apiClient.cms.unlockMember(member.id)
      notify(`Đã mở khóa tài khoản cho ${member.name}.`, 'success')
      setReloadKey((k) => k + 1)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể mở khóa thành viên.', 'danger')
    }
  }

  async function handleResetPassword(member: CmsMember) {
    try {
      const res = await apiClient.cms.resetPassword(member.id)
      notify(`Đã đặt lại mật khẩu cho ${member.name}. Mật khẩu tạm: ${res.temporaryPassword}`, 'success')
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.', 'danger')
    }
  }

  return (
    <Panel title={`Danh sách nhân sự (${members.length})`}>
      <div className="flex justify-between items-center px-4 py-3 border-b border-line bg-canvas">
        <span className="text-xs text-ink-muted">Toàn bộ nhân viên, trưởng phòng và quản trị viên</span>
        <Button onClick={() => setIsCreating((prev) => !prev)}>
          {isCreating ? 'Đóng biểu mẫu' : 'Thêm thành viên mới'}
        </Button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateMember} className="border-b border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
          <FormField id="cms-member-user" label="Tên đăng nhập">
            <input
              id="cms-member-user"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField id="cms-member-name" label="Họ và tên">
            <input
              id="cms-member-name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField id="cms-member-dept" label="Phòng ban">
            <Select
              id="cms-member-dept"
              value={newDepartment}
              options={departments.map((d) => ({ value: d, label: d }))}
              onChange={(val) => setNewDepartment(val)}
            />
          </FormField>
          <FormField id="cms-member-role" label="Vai trò hệ thống">
            <Select
              id="cms-member-role"
              value={newRole}
              options={[
                { value: 'staff', label: 'Nhân viên' },
                { value: 'head', label: 'Trưởng phòng' },
                { value: 'admin', label: 'Quản trị viên' },
              ]}
              onChange={(val) => setNewRole(val as any)}
            />
          </FormField>
          <FormField id="cms-member-email" label="Email (tùy chọn)">
            <input
              id="cms-member-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField id="cms-member-pass" label="Mật khẩu tạm">
            <input
              id="cms-member-pass"
              required
              value={newTempPassword}
              onChange={(e) => setNewTempPassword(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsCreating(false)}>
              Hủy
            </Button>
            <Button type="submit">Khởi tạo tài khoản</Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs divide-y divide-line">
          <thead className="bg-canvas text-ink-muted uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-2.5">Họ và tên</th>
              <th className="px-4 py-2.5">Tài khoản</th>
              <th className="px-4 py-2.5">Phòng ban</th>
              <th className="px-4 py-2.5">Vai trò</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-canvas">
                <td className="px-4 py-2.5 font-medium text-ink">{m.name}</td>
                <td className="px-4 py-2.5 text-ink-muted">{m.username}</td>
                <td className="px-4 py-2.5 text-ink">{m.department}</td>
                <td className="px-4 py-2.5 text-ink">
                  {m.role === 'admin' ? 'Quản trị viên' : m.role === 'head' ? 'Trưởng phòng' : 'Nhân viên'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      m.isActive ? 'bg-moss-100 text-moss-800' : 'bg-brick-100 text-brick-800'
                    }`}
                  >
                    {m.isActive ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right space-x-1.5">
                  {m.isActive ? (
                    <button
                      type="button"
                      onClick={() => handleLock(m)}
                      className="text-brick-700 hover:underline font-medium"
                    >
                      Khóa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnlock(m)}
                      className="text-moss-700 hover:underline font-medium"
                    >
                      Mở khóa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResetPassword(m)}
                    className="text-accent-700 hover:underline font-medium"
                  >
                    Đặt lại MK
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function DepartmentsSection() {
  const { notify } = useToast()
  const [departments, setDepartments] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    apiClient.cms
      .getDepartments()
      .then((res) => {
        if (active) {
          setDepartments(res.departments)
        }
      })
      .catch(() => {
        if (active) {
          notify('Không thể tải danh sách phòng ban.', 'danger')
        }
      })

    return () => {
      active = false
    }
  }, [notify, reloadKey])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await apiClient.cms.createDepartment(newName.trim())
      notify(`Đã bổ sung phòng ban ${newName.trim()} thành công.`, 'success')
      setNewName('')
      setReloadKey((k) => k + 1)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể tạo phòng ban.', 'danger')
    }
  }

  return (
    <Panel title={`Danh mục phòng ban (${departments.length})`}>
      <form onSubmit={handleCreate} className="flex gap-2 p-4 border-b border-line bg-canvas">
        <input
          type="text"
          required
          placeholder="Nhập tên phòng ban mới..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={`${CONTROL_CLASS} max-w-sm`}
        />
        <Button type="submit">Thêm phòng ban</Button>
      </form>
      <ul className="divide-y divide-line text-xs">
        {departments.map((dept) => (
          <li key={dept} className="flex items-center justify-between px-4 py-3 hover:bg-canvas">
            <span className="font-semibold text-ink">{dept}</span>
            <span className="text-ink-muted">Chính thức</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function TemplatesSection() {
  const { notify } = useToast()
  const [templates, setTemplates] = useState<CmsTemplate[]>([])

  useEffect(() => {
    let active = true
    apiClient.cms
      .getTemplates()
      .then((res) => {
        if (active) {
          setTemplates(res.templates)
        }
      })
      .catch(() => {
        if (active) {
          notify('Không thể tải danh mục mẫu yêu cầu.', 'danger')
        }
      })

    return () => {
      active = false
    }
  }, [notify])

  return (
    <Panel title={`Mẫu yêu cầu hỗ trợ chuẩn (${templates.length})`}>
      <ul className="divide-y divide-line text-xs">
        {templates.map((tpl) => (
          <li key={tpl.id} className="p-4 flex flex-col gap-1 hover:bg-canvas">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">{tpl.name}</span>
              <span className="rounded bg-line px-1.5 py-0.5 text-[10px] text-ink-muted">
                Phòng tiếp nhận: {tpl.targetDepartment} · SLA đề xuất: {tpl.suggestedDays} ngày
              </span>
            </div>
            <p className="text-ink-muted">{tpl.description}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function SlasSection() {
  const { notify } = useToast()
  const [slas, setSlas] = useState<CmsSla[]>([])
  const [editingPriority, setEditingPriority] = useState<TicketPriority | null>(null)
  const [editResponseHours, setEditResponseHours] = useState(24)
  const [editResolutionHours, setEditResolutionHours] = useState(72)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    apiClient.cms
      .getSlas()
      .then((res) => {
        if (active) {
          setSlas(res.slas)
        }
      })
      .catch(() => {
        if (active) {
          notify('Không thể tải cấu hình SLA mặc định.', 'danger')
        }
      })

    return () => {
      active = false
    }
  }, [notify, reloadKey])

  async function handleSaveSla(priority: TicketPriority) {
    try {
      await apiClient.cms.updateSla(priority, editResponseHours, editResolutionHours)
      notify(`Đã cập nhật SLA mức ${PRIORITY_LABELS[priority]} thành công.`, 'success')
      setEditingPriority(null)
      setReloadKey((k) => k + 1)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể cập nhật SLA.', 'danger')
    }
  }

  return (
    <Panel title="Thời hạn cam kết SLA mặc định theo mức ưu tiên">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs divide-y divide-line">
          <thead className="bg-canvas text-ink-muted uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-2.5">Mức độ ưu tiên</th>
              <th className="px-4 py-2.5">Thời hạn phản hồi (giờ)</th>
              <th className="px-4 py-2.5">Thời hạn hoàn thành (giờ)</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {TICKET_PRIORITIES.map((priority) => {
              const current = slas.find((s) => s.priority === priority)
              const isEditing = editingPriority === priority

              return (
                <tr key={priority} className="hover:bg-canvas">
                  <td className="px-4 py-2.5 font-bold text-ink">{PRIORITY_LABELS[priority]}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        value={editResponseHours}
                        onChange={(e) => setEditResponseHours(Number(e.target.value))}
                        className={`${CONTROL_CLASS} w-24 py-1 text-xs`}
                      />
                    ) : (
                      `${current?.responseHours ?? '–'} giờ`
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        value={editResolutionHours}
                        onChange={(e) => setEditResolutionHours(Number(e.target.value))}
                        className={`${CONTROL_CLASS} w-24 py-1 text-xs`}
                      />
                    ) : (
                      `${current?.resolutionHours ?? '–'} giờ`
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <div className="space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveSla(priority)}
                          className="text-accent-700 font-bold hover:underline"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPriority(null)}
                          className="text-ink-muted hover:underline"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriority(priority)
                          setEditResponseHours(current?.responseHours ?? 24)
                          setEditResolutionHours(current?.resolutionHours ?? 72)
                        }}
                        className="text-accent-700 font-medium hover:underline"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function AuditSection() {
  const { notify } = useToast()
  const [logs, setLogs] = useState<CmsAuditLog[]>([])

  useEffect(() => {
    let active = true
    apiClient.cms
      .getAuditLogs()
      .then((res) => {
        if (active) {
          setLogs(res.auditLogs)
        }
      })
      .catch(() => {
        if (active) {
          notify('Không thể tải nhật ký kiểm toán.', 'danger')
        }
      })
    return () => {
      active = false
    }
  }, [notify])

  return (
    <Panel title={`Nhật ký kiểm toán hệ thống (${logs.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs divide-y divide-line">
          <thead className="bg-canvas text-ink-muted uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-2.5">Thời điểm</th>
              <th className="px-4 py-2.5">Người thao tác</th>
              <th className="px-4 py-2.5">Hành động</th>
              <th className="px-4 py-2.5">Đối tượng</th>
              <th className="px-4 py-2.5">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Chưa ghi nhận nhật ký kiểm toán nào.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{log.actorName} ({log.actorUsername})</td>
                  <td className="px-4 py-2.5 text-ink font-semibold">{log.action}</td>
                  <td className="px-4 py-2.5 text-ink">{log.targetType}: {log.targetId}</td>
                  <td className="px-4 py-2.5 text-ink-muted truncate max-w-xs">
                    {log.details ? JSON.stringify(log.details) : '–'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
