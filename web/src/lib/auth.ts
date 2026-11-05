import { MEMBERS } from '../data/members.ts'
import type { Member } from '../data/members.ts'
import type { Viewer } from '../domain/ticket.ts'

// Shared demo password standing in for the future authentication API
export const MOCK_PASSWORD = 'ticket123'

function toViewer(member: Member): Viewer {
  return {
    name: member.name,
    department: member.department,
    isDepartmentHead: member.isDepartmentHead,
    isExecutive: member.isExecutive,
  }
}

export function authenticate(username: string, password: string): Viewer | null {
  const member = MEMBERS.find((candidate) => candidate.username === username.trim().toLowerCase())
  if (!member || password !== MOCK_PASSWORD) return null
  return toViewer(member)
}

export function findViewerByName(name: string): Viewer | null {
  const member = MEMBERS.find((candidate) => candidate.name === name)
  return member ? toViewer(member) : null
}
