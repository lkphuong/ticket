import { DEPARTMENTS, ENTERPRISE_TEMPLATES, MEMBERS, buildMockTickets } from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'

// Seeds baseline enterprise master data and realistic relative mock dataset
export async function seedDatabase(store: ITicketStore, now: Date = new Date()): Promise<void> {
  // 1. Seed canonical departments
  for (const dept of DEPARTMENTS) {
    await store.departments.create(dept)
  }

  // 2. Hash standard demo password using Bun bcrypt implementation
  const passwordHash = await Bun.password.hash('ticket123', { algorithm: 'bcrypt', cost: 10 })

  // 3. Seed organizational members (Head + Staff for all departments)
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i]
    await store.members.save({
      id: `usr-${m.username}`,
      username: m.username,
      name: m.name,
      department: m.department,
      role: m.isDepartmentHead ? 'head' : 'staff',
      isDepartmentHead: m.isDepartmentHead,
      isActive: true,
      passwordHash,
      requiresPasswordChange: false,
      receiveEmailNotifications: false,
    })
  }

  // 4. Seed system Administrator account
  await store.members.save({
    id: 'usr-admin',
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
  })

  // 5. Seed request templates
  for (let i = 0; i < ENTERPRISE_TEMPLATES.length; i++) {
    const t = ENTERPRISE_TEMPLATES[i]
    await store.templates.save({
      id: t.id,
      targetDepartment: t.targetDepartment,
      title: t.name,
      description: t.values.description,
      purpose: t.values.purpose,
      expectedResult: t.values.expectedResult,
      defaultPriority: t.values.priority,
      isActive: true,
    })
  }

  // 6. Seed mock tickets with relative dates covering every department, status and priority
  const mockTickets = buildMockTickets(now)
  for (const ticket of mockTickets) {
    await store.tickets.save(ticket)
  }
}
