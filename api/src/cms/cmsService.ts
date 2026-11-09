import { randomUUID } from 'node:crypto'
import { deriveDepartmentCodePrefix } from '@vtdesk/domain'
import type { Department, Ticket } from '@vtdesk/domain'
import { normalizeSearchText, paginate } from './pagination.ts'
import type { Page, PageRequest } from './pagination.ts'
import type { SessionData } from '../auth/sessionService.ts'
import type { DbAuditLog, DbMember, DbRequestTemplate, ITicketStore } from '../repositories/interfaces.ts'

const CODE_PREFIX_PATTERN = /^[A-Z0-9]{2,8}$/

export interface CreateMemberInput {
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly tempPassword?: string
  readonly email?: string
}

export interface MemberListFilters {
  readonly search?: string
  readonly department?: string
  readonly role?: DbMember['role']
  readonly status?: 'active' | 'locked'
}

export interface DepartmentSummary {
  readonly name: string
  readonly codePrefix: string
  readonly memberCount: number
}

export interface UpdateDepartmentInput {
  readonly name?: string
  readonly codePrefix?: string
}

export interface UpdateMemberInput {
  readonly name?: string
  readonly department?: string
  readonly role?: 'staff' | 'head' | 'admin'
  readonly email?: string
}

export class CmsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CmsValidationError'
  }
}

// Administrative business logic orchestrator for members and departments
export class CmsService {
  constructor(private readonly store: ITicketStore) {}

  async listDepartments(): Promise<string[]> {
    return this.store.departments.findAll()
  }

  async createDepartment(actor: SessionData, nameRaw: string, codePrefixRaw?: string): Promise<void> {
    const name = nameRaw?.trim()
    if (!name) {
      throw new CmsValidationError('Tên phòng ban không được để trống.')
    }

    const existing = await this.store.departments.findAllWithPrefix()
    if (existing.some((department) => department.name === name)) {
      throw new CmsValidationError('Phòng ban đã tồn tại.')
    }

    // Prefix defaults to the department initials so administrators are not forced to invent one
    const codePrefix = (codePrefixRaw?.trim() || deriveDepartmentCodePrefix(name)).toUpperCase()
    if (!CODE_PREFIX_PATTERN.test(codePrefix)) {
      throw new CmsValidationError('Tiền tố mã phải gồm 2 đến 8 chữ cái hoặc số không dấu.')
    }
    if (existing.some((department) => department.codePrefix === codePrefix)) {
      throw new CmsValidationError('Tiền tố mã đã được phòng ban khác sử dụng.')
    }

    await this.store.departments.create(name, codePrefix)
    await this.recordAuditLog(actor, 'create_department', 'department', name, { name, codePrefix })
  }

  async updateDepartment(actor: SessionData, currentName: string, updates: UpdateDepartmentInput): Promise<void> {
    const existing = await this.store.departments.findAllWithPrefix()
    const current = existing.find((department) => department.name === currentName)
    if (!current) {
      throw new CmsValidationError('Không tìm thấy phòng ban.')
    }

    const nextName = updates.name !== undefined ? updates.name.trim() : currentName
    if (!nextName) {
      throw new CmsValidationError('Tên phòng ban không được để trống.')
    }
    if (nextName !== currentName && existing.some((department) => department.name === nextName)) {
      throw new CmsValidationError('Phòng ban đã tồn tại.')
    }

    const nextPrefix = (updates.codePrefix?.trim() || current.codePrefix).toUpperCase()
    if (!CODE_PREFIX_PATTERN.test(nextPrefix)) {
      throw new CmsValidationError('Tiền tố mã phải gồm 2 đến 8 chữ cái hoặc số không dấu.')
    }
    if (existing.some((department) => department.name !== currentName && department.codePrefix === nextPrefix)) {
      throw new CmsValidationError('Tiền tố mã đã được phòng ban khác sử dụng.')
    }

    await this.store.departments.update(currentName, { name: nextName, codePrefix: nextPrefix })
    await this.recordAuditLog(actor, 'update_department', 'department', nextName, {
      previousName: currentName,
      name: nextName,
      codePrefix: nextPrefix,
    })
  }

  async deleteDepartment(actor: SessionData, name: string): Promise<void> {
    const existing = await this.store.departments.findAll()
    if (!existing.includes(name)) {
      throw new CmsValidationError('Không tìm thấy phòng ban.')
    }

    // A department that is still referenced would orphan members, tickets or templates
    const [memberCounts, ticketCount, templates] = await Promise.all([
      this.store.members.countByDepartment(),
      this.store.tickets.countByDepartment(name),
      this.store.templates.findByDepartment(name),
    ])
    const memberCount = memberCounts[name] ?? 0
    if (memberCount > 0) {
      throw new CmsValidationError(`Phòng "${name}" còn ${memberCount} thành viên. Hãy chuyển hoặc xóa thành viên trước.`)
    }
    if (ticketCount > 0) {
      throw new CmsValidationError(`Phòng "${name}" đã có ${ticketCount} yêu cầu liên quan nên không thể xóa.`)
    }
    if (templates.length > 0) {
      throw new CmsValidationError(`Phòng "${name}" còn ${templates.length} mẫu yêu cầu. Hãy chuyển hoặc xóa mẫu trước.`)
    }

    await this.store.departments.delete(name)
    await this.recordAuditLog(actor, 'delete_department', 'department', name, { name })
  }

  async listMembers(): Promise<DbMember[]> {
    return this.store.members.findAll()
  }

  async listMembersPage(filters: MemberListFilters, request: PageRequest): Promise<Page<DbMember>> {
    const needle = normalizeSearchText(filters.search ?? '')
    const members = (await this.store.members.findAll())
      .filter((m) => !filters.department || m.department === filters.department)
      .filter((m) => !filters.role || m.role === filters.role)
      .filter((m) => !filters.status || m.isActive === (filters.status === 'active'))
      .filter((m) => !needle || normalizeSearchText(`${m.name} ${m.username} ${m.email ?? ''}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return paginate(members, request)
  }

  async listDepartmentSummaries(search: string | undefined, request: PageRequest): Promise<Page<DepartmentSummary>> {
    const needle = normalizeSearchText(search ?? '')
    const [departments, memberCounts] = await Promise.all([
      this.store.departments.findAllWithPrefix(),
      this.store.members.countByDepartment(),
    ])
    const summaries = departments
      .filter((department) => !needle || normalizeSearchText(department.name).includes(needle))
      .map((department) => ({ ...department, memberCount: memberCounts[department.name] ?? 0 }))
    summaries.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return paginate(summaries, request)
  }

  async createMember(actor: SessionData, input: CreateMemberInput): Promise<DbMember> {
    const username = input.username?.trim().toLowerCase()
    if (!username) {
      throw new CmsValidationError('Tên đăng nhập không được để trống.')
    }

    const name = input.name?.trim()
    if (!name) {
      throw new CmsValidationError('Họ và tên không được để trống.')
    }

    // Verify username uniqueness
    const existing = await this.store.members.findByUsername(username)
    if (existing) {
      throw new CmsValidationError(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống.`)
    }

    // Validate department exists
    const departments = await this.store.departments.findAll()
    if (!departments.includes(input.department)) {
      throw new CmsValidationError(`Phòng ban "${input.department}" không tồn tại.`)
    }

    // Enforce strictly one active department head per department
    const isHead = input.role === 'head'
    if (isHead) {
      const departmentHeads = await this.store.members.findHeads([input.department])
      const existingHead = departmentHeads.find((m) => m.role === 'head' && m.isActive)
      if (existingHead) {
        throw new CmsValidationError(`Phòng "${input.department}" đã có Trưởng phòng (${existingHead.name}). Mỗi phòng luôn có đúng một Trưởng phòng.`)
      }
    }

    const tempPassword = input.tempPassword || 'ticket123'
    const passwordHash = await Bun.password.hash(tempPassword, { algorithm: 'bcrypt', cost: 10 })

    const newMember: DbMember = {
      id: randomUUID(),
      username,
      name,
      department: input.department,
      role: input.role,
      isDepartmentHead: isHead,
      isActive: true,
      passwordHash,
      requiresPasswordChange: true,
      email: input.email?.trim().toLowerCase() || undefined,
      receiveEmailNotifications: false,
    }

    await this.store.members.save(newMember)

    // Audit log without exposing password or hash
    await this.recordAuditLog(actor, 'create_member', 'member', newMember.id, {
      username: newMember.username,
      name: newMember.name,
      department: newMember.department,
      role: newMember.role,
      isDepartmentHead: newMember.isDepartmentHead,
      email: newMember.email,
    })

    return newMember
  }

  async updateMember(actor: SessionData, id: string, updates: UpdateMemberInput): Promise<DbMember> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }

    const nextDepartment = updates.department ?? member.department
    const nextRole = updates.role ?? member.role
    const nextIsHead = nextRole === 'head'

    // Verify department exists if changed
    if (updates.department) {
      const departments = await this.store.departments.findAll()
      if (!departments.includes(updates.department)) {
        throw new CmsValidationError(`Phòng ban "${updates.department}" không tồn tại.`)
      }
    }

    // Validate single department head rule when promoting or moving
    if (nextIsHead && (!member.isDepartmentHead || member.department !== nextDepartment)) {
      const departmentHeads = await this.store.members.findHeads([nextDepartment])
      const existingHead = departmentHeads.find((m) => m.id !== member.id && m.role === 'head' && m.isActive)
      if (existingHead) {
        throw new CmsValidationError(`Phòng "${nextDepartment}" đã có Trưởng phòng (${existingHead.name}). Mỗi phòng luôn có đúng một Trưởng phòng.`)
      }
    }

    // Prevent removing the sole department head without replacement
    if (member.isDepartmentHead && !nextIsHead) {
      const departmentHeads = await this.store.members.findHeads([member.department])
      const otherHeads = departmentHeads.filter((m) => m.id !== member.id && m.role === 'head' && m.isActive)
      if (otherHeads.length === 0) {
        throw new CmsValidationError(`Không thể giáng chức Trưởng phòng duy nhất của phòng "${member.department}" khi chưa có Trưởng phòng thay thế.`)
      }
    }

    const updated: DbMember = {
      ...member,
      name: updates.name ? updates.name.trim() : member.name,
      department: nextDepartment,
      role: nextRole,
      isDepartmentHead: nextIsHead,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() || undefined : member.email,
    }

    await this.store.members.save(updated)

    await this.recordAuditLog(actor, 'update_member', 'member', updated.id, {
      name: updated.name,
      department: updated.department,
      role: updated.role,
      isDepartmentHead: updated.isDepartmentHead,
      email: updated.email,
    })

    return updated
  }

  async deleteMember(actor: SessionData, id: string): Promise<void> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }
    if (member.id === actor.userId) {
      throw new CmsValidationError('Không thể xóa chính tài khoản đang đăng nhập.')
    }

    if (member.isDepartmentHead && member.isActive) {
      const departmentHeads = await this.store.members.findHeads([member.department])
      const hasOtherHead = departmentHeads.some(
        (m) => m.id !== member.id && m.department === member.department && m.role === 'head' && m.isActive,
      )
      if (!hasOtherHead) {
        throw new CmsValidationError(`Không thể xóa Trưởng phòng duy nhất của phòng "${member.department}". Vui lòng chỉ định Trưởng phòng mới trước.`)
      }
    }

    // Tickets keep requester and assignee by name, so a member with history is locked instead of deleted
    const involvedCount = await this.store.tickets.countInvolvingMember(member.name)
    if (involvedCount > 0) {
      throw new CmsValidationError(`Thành viên "${member.name}" đã tham gia ${involvedCount} yêu cầu nên không thể xóa. Hãy khóa tài khoản thay thế.`)
    }

    await this.store.members.delete(member.id)
    await this.recordAuditLog(actor, 'delete_member', 'member', member.id, {
      username: member.username,
      name: member.name,
      department: member.department,
    })
  }

  async lockMember(actor: SessionData, id: string): Promise<{ reassignedTicketsCount: number }> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }

    // Prevent locking sole active department head
    if (member.isDepartmentHead && member.isActive) {
      const departmentHeads = await this.store.members.findHeads([member.department])
      const otherHeads = departmentHeads.filter((m) => m.id !== member.id && m.role === 'head' && m.isActive)
      if (otherHeads.length === 0) {
        throw new CmsValidationError(`Không thể khóa Trưởng phòng duy nhất của phòng "${member.department}". Vui lòng chỉ định Trưởng phòng mới trước.`)
      }
    }

    await this.store.members.save({
      ...member,
      isActive: false,
    })

    // Return active assigned tickets of locked member back to department queue in one bulk write
    const assignedTickets = await this.store.tickets.findActiveByAssignee(member.name)
    const nowIso = new Date().toISOString()
    const releasedTickets = assignedTickets.map((ticket) => this.releaseTicketFromMember(ticket, member.name, actor, nowIso))
    await this.store.tickets.saveMany(releasedTickets)
    const reassignedCount = releasedTickets.length

    await this.recordAuditLog(actor, 'lock_member', 'member', member.id, {
      username: member.username,
      reassignedTicketsCount: reassignedCount,
    })

    return { reassignedTicketsCount: reassignedCount }
  }

  // Returns a ticket to the department queue, recording the handoff and reopening work that was in progress
  private releaseTicketFromMember(ticket: Ticket, memberName: string, actor: SessionData, nowIso: string): Ticket {
    const actorRef = { name: actor.name, department: actor.department as Department }
    const nextStatus = ticket.status === 'in_progress' ? 'open' : ticket.status
    const statusHistory = [...(ticket.statusHistory ?? [])]
    if (ticket.status !== nextStatus) {
      statusHistory.push({
        status: nextStatus,
        at: nowIso,
        reason: `Thành viên ${memberName} bị khóa tài khoản`,
        actor: actorRef,
      })
    }
    return {
      ...ticket,
      assigneeName: undefined,
      status: nextStatus,
      assignmentHistory: [...(ticket.assignmentHistory ?? []), { from: memberName, to: 'Chưa phân công', at: nowIso, actor: actorRef }],
      statusHistory,
      updatedAt: nowIso,
    }
  }

  async unlockMember(actor: SessionData, id: string): Promise<void> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }

    await this.store.members.save({
      ...member,
      isActive: true,
    })

    await this.recordAuditLog(actor, 'unlock_member', 'member', member.id, {
      username: member.username,
    })
  }

  async resetPassword(actor: SessionData, id: string, tempPasswordRaw?: string): Promise<string> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }

    const tempPassword = tempPasswordRaw || 'ticket123'
    const passwordHash = await Bun.password.hash(tempPassword, { algorithm: 'bcrypt', cost: 10 })

    await this.store.members.save({
      ...member,
      passwordHash,
      requiresPasswordChange: true,
    })

    await this.recordAuditLog(actor, 'reset_password', 'member', member.id, {
      username: member.username,
      requiresPasswordChange: true,
    })

    return tempPassword
  }

  async listAuditLogs(): Promise<DbAuditLog[]> {
    return this.store.auditLogs.findAll()
  }

  async listAuditLogsPage(request: PageRequest): Promise<Page<DbAuditLog>> {
    const logs = await this.store.auditLogs.findAll()
    const newestFirst = [...logs].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    return paginate(newestFirst, request)
  }

  // Template management operations
  async listTemplates(targetDepartment?: string, includeInactive: boolean = false): Promise<DbRequestTemplate[]> {
    const all = targetDepartment
      ? await this.store.templates.findByDepartment(targetDepartment)
      : await this.store.templates.findAll()
    if (includeInactive) return all
    return all.filter((t) => t.isActive)
  }

  async createTemplate(
    actor: SessionData,
    input: { targetDepartment: string; title: string; description: string; purpose: string; expectedResult: string; defaultPriority: string },
  ): Promise<DbRequestTemplate> {
    const departments = await this.store.departments.findAll()
    if (!departments.includes(input.targetDepartment)) {
      throw new CmsValidationError(`Phòng ban đích "${input.targetDepartment}" không hợp lệ.`)
    }

    if (!input.title?.trim() || !input.description?.trim()) {
      throw new CmsValidationError('Tiêu đề và mô tả mẫu không được để trống.')
    }

    const template: DbRequestTemplate = {
      id: randomUUID(),
      targetDepartment: input.targetDepartment,
      title: input.title.trim(),
      description: input.description.trim(),
      purpose: input.purpose?.trim() || input.title.trim(),
      expectedResult: input.expectedResult?.trim() || 'Hoàn thành theo yêu cầu.',
      defaultPriority: input.defaultPriority || 'medium',
      isActive: true,
    }

    await this.store.templates.save(template)
    await this.recordAuditLog(actor, 'create_template', 'request_template', template.id, {
      title: template.title,
      targetDepartment: template.targetDepartment,
      defaultPriority: template.defaultPriority,
    })

    return template
  }

  async updateTemplate(
    actor: SessionData,
    id: string,
    updates: Partial<Omit<DbRequestTemplate, 'id'>>,
  ): Promise<DbRequestTemplate> {
    const all = await this.store.templates.findAll()
    const existing = all.find((t) => t.id === id)
    if (!existing) {
      throw new CmsValidationError('Không tìm thấy mẫu yêu cầu.')
    }

    if (updates.targetDepartment) {
      const departments = await this.store.departments.findAll()
      if (!departments.includes(updates.targetDepartment)) {
        throw new CmsValidationError(`Phòng ban đích "${updates.targetDepartment}" không hợp lệ.`)
      }
    }

    const updated: DbRequestTemplate = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      purpose: updates.purpose !== undefined ? updates.purpose.trim() : existing.purpose,
      expectedResult: updates.expectedResult !== undefined ? updates.expectedResult.trim() : existing.expectedResult,
    }

    await this.store.templates.save(updated)
    await this.recordAuditLog(actor, 'update_template', 'request_template', id, {
      updates,
    })

    return updated
  }

  // SLA management operations
  async listDefaultSlas(): Promise<Array<{ priority: string; responseHours: number; resolutionHours: number }>> {
    return this.store.slas.findAll()
  }

  async updateDefaultSla(
    actor: SessionData,
    priority: string,
    responseHours: number,
    resolutionHours: number,
  ): Promise<{ priority: string; responseHours: number; resolutionHours: number }> {
    const normalizedPriority = priority.toLowerCase()
    if (!['low', 'medium', 'high', 'urgent'].includes(normalizedPriority)) {
      throw new CmsValidationError(`Mức độ ưu tiên "${priority}" không hợp lệ.`)
    }

    if (responseHours <= 0 || resolutionHours <= 0) {
      throw new CmsValidationError('Thời gian SLA phải lớn hơn 0 giờ.')
    }

    const record = {
      priority: normalizedPriority,
      responseHours,
      resolutionHours,
    }

    await this.store.slas.save(record)
    await this.recordAuditLog(actor, 'update_default_sla', 'default_sla', normalizedPriority, {
      responseHours,
      resolutionHours,
    })

    return record
  }

  private async recordAuditLog(
    actor: SessionData,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.store.auditLogs.save({
      id: randomUUID(),
      actorUsername: actor.username,
      action,
      entityType,
      entityId,
      details: JSON.stringify(details),
    })
  }
}
