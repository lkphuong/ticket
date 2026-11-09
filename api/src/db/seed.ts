import { DEPARTMENTS, DEPARTMENT_CODE_PREFIXES, ENTERPRISE_TEMPLATES, MEMBERS, buildMockTickets, deterministicUuid } from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'

export const DEFAULT_SLAS = [
  { priority: 'urgent', responseHours: 1, resolutionHours: 4 },
  { priority: 'high', responseHours: 4, resolutionHours: 24 },
  { priority: 'medium', responseHours: 8, resolutionHours: 72 },
  { priority: 'low', responseHours: 24, resolutionHours: 120 },
] as const

// Seeds baseline enterprise master data and realistic relative mock dataset
export async function seedDatabase(store: ITicketStore, now: Date = new Date()): Promise<void> {
  // 1. Seed canonical departments
  for (const dept of DEPARTMENTS) {
    await store.departments.create(dept, DEPARTMENT_CODE_PREFIXES[dept])
  }

  // Existing rows are never overwritten so re-running the seed keeps live data intact
  const existingUsernames = new Set((await store.members.findAll()).map((member) => member.username))
  const existingTemplateIds = new Set((await store.templates.findAll()).map((template) => template.id))
  const existingSlaPriorities = new Set((await store.slas.findAll()).map((sla) => sla.priority))

  // 2. Hash standard demo password using Bun bcrypt implementation
  const passwordHash = await Bun.password.hash('ticket123', { algorithm: 'bcrypt', cost: 10 })

  // 3. Seed organizational members (Head + Staff for all departments)
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i]
    if (existingUsernames.has(m.username)) continue
    await store.members.save({
      id: deterministicUuid(`member:${m.username}`),
      username: m.username,
      name: m.name,
      department: m.department,
      role: m.isDepartmentHead ? 'head' : 'staff',
      isDepartmentHead: m.isDepartmentHead,
      isActive: true,
      passwordHash,
      requiresPasswordChange: false,
      receiveEmailNotifications: false,
      isVerified: true,
    })
  }

  // 4. Seed system Administrator account
  if (!existingUsernames.has('admin')) {
    await store.members.save({
      id: deterministicUuid('member:admin'),
      username: 'admin',
      name: 'Quản trị viên Hệ thống',
      department: 'Công nghệ thông tin',
      role: 'admin',
      isDepartmentHead: false,
      isActive: true,
      passwordHash,
      requiresPasswordChange: false,
      email: 'admin@vtdesk.vn',
      receiveEmailNotifications: false,
      isVerified: true,
    })
  }

  // 5. Seed request templates
  for (let i = 0; i < ENTERPRISE_TEMPLATES.length; i++) {
    const t = ENTERPRISE_TEMPLATES[i]
    if (existingTemplateIds.has(deterministicUuid(`template:${t.id}`))) continue
    await store.templates.save({
      id: deterministicUuid(`template:${t.id}`),
      targetDepartment: t.targetDepartment,
      title: t.name,
      description: t.values.description,
      purpose: t.values.purpose,
      expectedResult: t.values.expectedResult,
      defaultPriority: t.values.priority,
      isActive: true,
    })
  }

  // 6. Seed default SLA parameters per priority
  for (const sla of DEFAULT_SLAS) {
    if (!existingSlaPriorities.has(sla.priority)) await store.slas.save(sla)
  }

  // 7. Seed mock tickets with relative dates covering every department, status and priority
  for (const ticket of buildMockTickets(now)) {
    if (!(await store.tickets.findById(ticket.id))) await store.tickets.save(ticket)
  }
}
