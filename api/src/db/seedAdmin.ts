import { deterministicUuid } from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'
import { DEFAULT_SLAS } from './seed.ts'

export const ADMIN_USERNAME = 'admin'
export const ADMIN_DISPLAY_NAME = 'Quản trị viên Hệ thống'
// Members require a department, so the bootstrap admin sits in a neutral one outside the departments collection
export const ADMIN_DEPARTMENT_LABEL = 'Quản trị hệ thống'
export const MIN_ADMIN_PASSWORD_LENGTH = 8

// Seeds only the system administrator and default SLAs so the admin configures departments, members and content
export async function seedAdminOnly(store: ITicketStore, initialPassword: string | undefined): Promise<void> {
  if (!initialPassword || initialPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_INITIAL_PASSWORD must be set to at least ${MIN_ADMIN_PASSWORD_LENGTH} characters in api/.env.`)
  }

  // An existing admin is never overwritten so re-running keeps the password the admin already chose
  if (!(await store.members.findByUsername(ADMIN_USERNAME))) {
    await store.members.save({
      id: deterministicUuid(`member:${ADMIN_USERNAME}`),
      username: ADMIN_USERNAME,
      name: ADMIN_DISPLAY_NAME,
      department: ADMIN_DEPARTMENT_LABEL,
      role: 'admin',
      isDepartmentHead: false,
      isActive: true,
      passwordHash: await Bun.password.hash(initialPassword, { algorithm: 'bcrypt', cost: 10 }),
      requiresPasswordChange: true,
      isVerified: true,
    })
  }

  const existingSlaPriorities = new Set((await store.slas.findAll()).map((sla) => sla.priority))
  for (const sla of DEFAULT_SLAS) {
    if (!existingSlaPriorities.has(sla.priority)) await store.slas.save(sla)
  }
}
