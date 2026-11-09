// Administrative CMS console for managing enterprise members, departments, request templates, and SLAs

import { useEffect, useState } from 'react'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import type { IconName } from '../components/ui/Icon.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import { Panel } from '../components/ui/Panel.tsx'
import { PRIORITY_LABELS, TICKET_PRIORITIES } from '../domain/ticket.ts'
import type { TicketPriority } from '../domain/ticket.ts'
import { apiClient } from '../lib/apiClient.ts'
import type { CmsAuditLog, CmsSla, CmsTemplate, PageMeta } from '../lib/apiClient.ts'
import { formatDateTime } from '../lib/formatDate.ts'
import { useToast } from '../lib/toastContext.ts'
import { getViewerRole } from '../lib/viewerRole.ts'
import { useAuth } from '../state/useAuth.ts'
import { TABLE_CELL_CLASS, TABLE_HEAD_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_ROW_CLASS } from './cms/cmsStyles.ts'
import { DepartmentsSection } from './cms/DepartmentsSection.tsx'
import { MembersSection } from './cms/MembersSection.tsx'

type CmsTab = 'members' | 'departments' | 'templates' | 'slas' | 'audit'

const TAB_OPTIONS: { id: CmsTab; label: string; icon: IconName }[] = [
  { id: 'members', label: 'Thành viên', icon: 'users' },
  { id: 'departments', label: 'Phòng ban', icon: 'building' },
  { id: 'templates', label: 'Mẫu yêu cầu', icon: 'file' },
  { id: 'slas', label: 'SLA mặc định', icon: 'clock' },
  { id: 'audit', label: 'Nhật ký kiểm toán', icon: 'shield' },
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

      <div className="mb-5 border-b border-line">
        <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Phân hệ quản trị">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 ${
                activeTab === tab.id
                  ? 'border-accent-600 text-ink'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <Icon name={tab.icon} />
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
          notify('Không thể tải danh mục mẫu yêu cầu.', 'error')
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
          notify('Không thể tải cấu hình SLA mặc định.', 'error')
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
      notify(err instanceof Error ? err.message : 'Không thể cập nhật SLA.', 'error')
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

const AUDIT_PAGE_SIZE = 20

function AuditSection() {
  const { notify } = useToast()
  const [logs, setLogs] = useState<CmsAuditLog[]>([])
  const [pageMeta, setPageMeta] = useState<PageMeta>({ total: 0, page: 1, limit: AUDIT_PAGE_SIZE, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(AUDIT_PAGE_SIZE)

  useEffect(() => {
    let active = true
    apiClient.cms
      .getAuditLogs({ page, limit })
      .then((res) => {
        if (!active) return
        setLogs(res.auditLogs)
        setPageMeta({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages })
        if (res.page !== page) setPage(res.page)
      })
      .catch(() => {
        if (active) notify('Không thể tải nhật ký kiểm toán.', 'error')
      })
    return () => {
      active = false
    }
  }, [notify, page, limit])

  return (
    <Panel title="Nhật ký kiểm toán">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Thời điểm</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Người thao tác</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Hành động</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Đối tượng</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  Chưa ghi nhận nhật ký kiểm toán nào.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className={TABLE_ROW_CLASS}>
                  <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-ink-muted tabular-nums`}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className={`${TABLE_CELL_CLASS} font-medium text-ink`}>{log.actorUsername}</td>
                  <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-ink`}>{log.action}</td>
                  <td className={`${TABLE_CELL_CLASS} text-ink`}>{log.entityType}</td>
                  <td className={`${TABLE_CELL_CLASS} max-w-xs truncate font-mono text-xs text-ink-muted`} title={log.details}>
                    {log.details || '–'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
