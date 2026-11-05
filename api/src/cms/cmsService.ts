import { randomUUID } from 'node:crypto'
import { deriveDepartmentCodePrefix } from '@vtdesk/domain'
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

    const existing = await this.store.departments.findAll()
    if (existing.includes(name)) {
      throw new CmsValidationError('Phòng ban đã tồn tại.')
    }

    // Prefix defaults to the department initials so administrators are not forced to invent one
    const codePrefix = (codePrefixRaw?.trim() || deriveDepartmentCodePrefix(name)).toUpperCase()
    if (!CODE_PREFIX_PATTERN.test(codePrefix)) {
      throw new CmsValidationError('Tiền tố mã phải gồm 2 đến 8 chữ cái hoặc số không dấu.')
    }
    const prefixOwners = await Promise.all(existing.map((department) => this.store.departments.findCodePrefix(department)))
    if (prefixOwners.includes(codePrefix)) {
      throw new CmsValidationError('Tiền tố mã đã được phòng ban khác sử dụng.')
    }

    await this.store.departments.create(name, codePrefix)
    await this.recordAuditLog(actor, 'create_department', 'department', name, { name, codePrefix })
  }

  async listMembers(): Promise<DbMember[]> {
    return this.store.members.findAll()
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
      const allMembers = await this.store.members.findAll()
      const existingHead = allMembers.find(
        (m) => m.department === input.department && m.role === 'head' && m.isActive,
      )
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
      email: input.email?.trim() || undefined,
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
      const allMembers = await this.store.members.findAll()
      const existingHead = allMembers.find(
        (m) => m.id !== member.id && m.department === nextDepartment && m.role === 'head' && m.isActive,
      )
      if (existingHead) {
        throw new CmsValidationError(`Phòng "${nextDepartment}" đã có Trưởng phòng (${existingHead.name}). Mỗi phòng luôn có đúng một Trưởng phòng.`)
      }
    }

    // Prevent removing the sole department head without replacement
    if (member.isDepartmentHead && !nextIsHead) {
      const allMembers = await this.store.members.findAll()
      const otherHeads = allMembers.filter(
        (m) => m.id !== member.id && m.department === member.department && m.role === 'head' && m.isActive,
      )
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
      email: updates.email !== undefined ? updates.email.trim() || undefined : member.email,
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

  async lockMember(actor: SessionData, id: string): Promise<{ reassignedTicketsCount: number }> {
    const member = await this.store.members.findById(id)
    if (!member) {
      throw new CmsValidationError('Không tìm thấy thành viên.')
    }

    // Prevent locking sole active department head
    if (member.isDepartmentHead && member.isActive) {
      const allMembers = await this.store.members.findAll()
      const otherHeads = allMembers.filter(
        (m) => m.id !== member.id && m.department === member.department && m.role === 'head' && m.isActive,
      )
      if (otherHeads.length === 0) {
        throw new CmsValidationError(`Không thể khóa Trưởng phòng duy nhất của phòng "${member.department}". Vui lòng chỉ định Trưởng phòng mới trước.`)
      }
    }

    await this.store.members.save({
      ...member,
      isActive: false,
    })

    // Return active assigned tickets of locked member back to department queue
    const allTickets = await this.store.tickets.findAll()
    const activeStatuses = ['open', 'in_progress', 'waiting']
    let reassignedCount = 0

    for (const ticket of allTickets) {
      if (ticket.assigneeName === member.name && activeStatuses.includes(ticket.status)) {
        const nowIso = new Date().toISOString()
        const previousStatus = ticket.status
        const nextStatus = previousStatus === 'in_progress' ? 'open' : previousStatus

        const assignmentHistory = ticket.assignmentHistory ? [...ticket.assignmentHistory] : []
        assignmentHistory.push({
          from: member.name,
          to: 'Chưa phân công',
          at: nowIso,
          actor: { name: actor.name, department: actor.department as any },
        })

        const statusHistory = ticket.statusHistory ? [...ticket.statusHistory] : []
        if (previousStatus !== nextStatus) {
          statusHistory.push({
            status: nextStatus,
            at: nowIso,
            reason: `Thành viên ${member.name} bị khóa tài khoản`,
            actor: { name: actor.name, department: actor.department as any },
          })
        }

        await this.store.tickets.save({
          ...ticket,
          assigneeName: undefined,
          status: nextStatus,
          assignmentHistory,
          statusHistory,
          updatedAt: nowIso,
        })
        reassignedCount++
      }
    }

    await this.recordAuditLog(actor, 'lock_member', 'member', member.id, {
      username: member.username,
      reassignedTicketsCount: reassignedCount,
    })

    return { reassignedTicketsCount: reassignedCount }
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
