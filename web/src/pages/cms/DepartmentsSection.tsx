// Administrator department catalog: search, create, rename or re-prefix, and delete departments

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../../components/ui/controlStyles.ts'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { FormField } from '../../components/ui/FormField.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { IconButton } from '../../components/ui/IconButton.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { Panel } from '../../components/ui/Panel.tsx'
import { SearchField } from '../../components/ui/SearchField.tsx'
import { apiClient } from '../../lib/apiClient.ts'
import type { CmsDepartment, PageMeta } from '../../lib/apiClient.ts'
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

const DEFAULT_PAGE_SIZE = 20
const EMPTY_PAGE_META: PageMeta = { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 }

interface DepartmentFormState {
  name: string
  codePrefix: string
}

// Null closes the form; 'new' creates; a department name edits that department
type FormTarget = null | 'new' | string

export function DepartmentsSection() {
  const { notify } = useToast()
  const [departments, setDepartments] = useState<CmsDepartment[]>([])
  const [pageMeta, setPageMeta] = useState<PageMeta>(EMPTY_PAGE_META)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const [form, setForm] = useState<DepartmentFormState>({ name: '', codePrefix: '' })
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiClient.cms
      .getDepartments({ page, limit, search: debouncedSearch.trim() })
      .then((res) => {
        if (!active) return
        setDepartments(res.departments)
        setPageMeta({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages })
        if (res.page !== page) setPage(res.page)
      })
      .catch(() => {
        if (active) notify('Không thể tải danh sách phòng ban.', 'error')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [notify, page, limit, debouncedSearch, reloadKey])

  const isEditing = formTarget !== null && formTarget !== 'new'

  function openCreateForm() {
    setForm({ name: '', codePrefix: '' })
    setFormTarget('new')
  }

  function openEditForm(department: CmsDepartment) {
    setForm({ name: department.name, codePrefix: department.codePrefix })
    setPendingDeleteName(null)
    setFormTarget(department.name)
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
    const name = form.name.trim()
    const codePrefix = form.codePrefix.trim()
    const saved = isEditing
      ? await runAction(async () => {
          await apiClient.cms.updateDepartment(formTarget, { name, codePrefix: codePrefix === '' ? undefined : codePrefix })
          return `Đã cập nhật phòng ban ${name}.`
        }, 'Không thể cập nhật phòng ban.')
      : await runAction(async () => {
          await apiClient.cms.createDepartment(name, codePrefix === '' ? undefined : codePrefix)
          return `Đã bổ sung phòng ban ${name} thành công.`
        }, 'Không thể tạo phòng ban.')
    if (saved) closeForm()
  }

  async function handleDelete(department: CmsDepartment) {
    setPendingDeleteName(null)
    await runAction(async () => {
      await apiClient.cms.deleteDepartment(department.name)
      return `Đã xóa phòng ban ${department.name}.`
    }, 'Không thể xóa phòng ban.')
  }

  function renderRowActions(department: CmsDepartment) {
    if (pendingDeleteName === department.name) {
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-medium text-ink">Xóa {department.name}?</span>
          <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => void handleDelete(department)}>
            Xóa
          </Button>
          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setPendingDeleteName(null)}>
            Hủy
          </Button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-end gap-0.5">
        <IconButton icon="pencil" label={`Sửa ${department.name}`} onClick={() => openEditForm(department)} />
        <IconButton
          icon="trash"
          tone="danger"
          label={`Xóa ${department.name}`}
          onClick={() => setPendingDeleteName(department.name)}
        />
      </div>
    )
  }

  return (
    <Panel
      title={`${pageMeta.total} phòng ban`}
      aside={
        <Button className="gap-1.5 py-1.5 whitespace-nowrap" onClick={() => (formTarget === null ? openCreateForm() : closeForm())}>
          <Icon name={formTarget === null ? 'plus' : 'x'} />
          {formTarget === null ? 'Thêm phòng ban' : 'Đóng biểu mẫu'}
        </Button>
      }
    >
      {formTarget !== null && (
        <form onSubmit={handleSubmit} className={`${FORM_PANEL_CLASS} grid gap-3 sm:grid-cols-2`}>
          <h3 className="text-sm font-bold text-ink sm:col-span-2">
            {isEditing ? `Chỉnh sửa ${formTarget}` : 'Thêm phòng ban mới'}
          </h3>
          <FormField id="cms-dept-name" label="Tên phòng ban">
            <input
              id="cms-dept-name"
              required
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField
            id="cms-dept-prefix"
            label="Tiền tố mã yêu cầu"
            hint="2 đến 8 chữ cái hoặc số không dấu. Để trống để tự tạo từ tên phòng ban."
          >
            <input
              id="cms-dept-prefix"
              value={form.codePrefix}
              onChange={(e) => setForm((current) => ({ ...current, codePrefix: e.target.value.toUpperCase() }))}
              className={`${CONTROL_CLASS} uppercase`}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
            <Button variant="secondary" onClick={closeForm}>
              Hủy
            </Button>
            <Button type="submit" className="gap-1.5">
              <Icon name="check" />
              {isEditing ? 'Lưu thay đổi' : 'Thêm phòng ban'}
            </Button>
          </div>
        </form>
      )}

      <div className={TOOLBAR_CLASS}>
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Tìm theo tên phòng ban"
          ariaLabel="Tìm phòng ban"
        />
      </div>

      {departments.length === 0 && !isLoading ? (
        <EmptyState
          title={search ? 'Không có phòng ban phù hợp' : 'Chưa có phòng ban nào'}
          description={search ? 'Thử đổi từ khóa tìm kiếm.' : 'Thêm phòng ban đầu tiên để bắt đầu.'}
        />
      ) : (
        <div className={`overflow-x-auto transition-opacity ${isLoading ? 'opacity-60' : ''}`} aria-busy={isLoading}>
          <table className="w-full text-left text-sm">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Phòng ban</th>
                <th scope="col" className={TABLE_HEAD_CELL_CLASS}>Tiền tố mã</th>
                <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} text-right`}>Thành viên</th>
                <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {departments.map((department) => (
                <tr key={department.name} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_CELL_CLASS}>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-ash-200 text-ash-700"
                      >
                        <Icon name="building" className="size-4" />
                      </span>
                      <span className="font-semibold text-ink">{department.name}</span>
                    </div>
                  </td>
                  <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-ink-muted`}>{department.codePrefix}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right text-ink tabular-nums`}>{department.memberCount}</td>
                  <td className={`${TABLE_CELL_CLASS} min-w-48`}>{renderRowActions(department)}</td>
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
