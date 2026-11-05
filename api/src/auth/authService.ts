import type { DbMember, IMemberRepository } from '../repositories/interfaces.ts'
import type { ISessionService } from './sessionService.ts'

export interface AuthSuccessResult {
  readonly token: string
  readonly user: {
    readonly id: string
    readonly username: string
    readonly name: string
    readonly department: string
    readonly role: 'staff' | 'head' | 'admin'
    readonly isDepartmentHead: boolean
    readonly requiresPasswordChange: boolean
    readonly email?: string
    readonly receiveEmailNotifications: boolean
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Invalid username or password') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AccountLockedError extends Error {
  constructor(message: string = 'Account is locked. Contact your administrator.') {
    super(message)
    this.name = 'AccountLockedError'
  }
}

export class PasswordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PasswordValidationError'
  }
}

export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileValidationError'
  }
}

export interface UpdateProfileInput {
  readonly email?: string | null
  readonly receiveEmailNotifications?: boolean
}

export class AuthService {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly sessionService: ISessionService,
  ) {}

  async login(usernameRaw: string, passwordRaw: string): Promise<AuthSuccessResult> {
    const username = usernameRaw?.trim().toLowerCase()
    if (!username || !passwordRaw) {
      throw new AuthenticationError()
    }

    const member = await this.memberRepo.findByUsername(username)
    if (!member) {
      throw new AuthenticationError()
    }

    // Verify bcrypt hash without revealing account existence
    let isPasswordValid = false
    try {
      isPasswordValid = await Bun.password.verify(passwordRaw, member.passwordHash)
    } catch {
      throw new AuthenticationError()
    }

    if (!isPasswordValid) {
      throw new AuthenticationError()
    }

    // Explicitly reject locked accounts
    if (!member.isActive) {
      throw new AccountLockedError()
    }

    const token = await this.sessionService.createSession({
      userId: member.id,
      username: member.username,
      name: member.name,
      department: member.department,
      role: member.role,
      isDepartmentHead: member.isDepartmentHead,
      requiresPasswordChange: member.requiresPasswordChange,
    })

    return {
      token,
      user: {
        id: member.id,
        username: member.username,
        name: member.name,
        department: member.department,
        role: member.role,
        isDepartmentHead: member.isDepartmentHead,
        requiresPasswordChange: member.requiresPasswordChange,
        email: member.email,
        receiveEmailNotifications: member.receiveEmailNotifications ?? false,
      },
    }
  }

  // Retrieves member profile by identifier
  async getMember(userId: string): Promise<DbMember | null> {
    return await this.memberRepo.findById(userId)
  }

  // Updates optional email address and notification subscription preference
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<DbMember> {
    const member = await this.memberRepo.findById(userId)
    if (!member) {
      throw new AuthenticationError('User not found.')
    }

    let validatedEmail = member.email
    let receiveEmail = input.receiveEmailNotifications ?? member.receiveEmailNotifications ?? false

    if (input.email !== undefined) {
      if (input.email === null || input.email.trim() === '') {
        validatedEmail = undefined
        // Reset notification preference when email is cleared
        receiveEmail = false
      } else {
        const trimmed = input.email.trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmed)) {
          throw new ProfileValidationError('Email không đúng định dạng.')
        }
        validatedEmail = trimmed
      }
    }

    // Default flag to false if uninitialized or when email is absent
    const finalReceiveEmail = validatedEmail ? Boolean(receiveEmail) : false

    const updated: DbMember = {
      ...member,
      email: validatedEmail,
      receiveEmailNotifications: finalReceiveEmail,
      updatedAt: new Date(),
    }

    await this.memberRepo.save(updated)
    return updated
  }

  async changePassword(userId: string, currentPasswordRaw: string, newPasswordRaw: string): Promise<void> {
    if (!newPasswordRaw || newPasswordRaw.length < 6) {
      throw new PasswordValidationError('New password must contain at least 6 characters.')
    }

    const member = await this.memberRepo.findById(userId)
    if (!member) {
      throw new AuthenticationError('User not found.')
    }

    const isCurrentValid = await Bun.password.verify(currentPasswordRaw, member.passwordHash)
    if (!isCurrentValid) {
      throw new AuthenticationError('Current password is incorrect.')
    }

    const newHash = await Bun.password.hash(newPasswordRaw, { algorithm: 'bcrypt', cost: 10 })
    await this.memberRepo.save({
      ...member,
      passwordHash: newHash,
      requiresPasswordChange: false,
    })
  }

  async logout(token: string): Promise<void> {
    await this.sessionService.destroySession(token)
  }
}
