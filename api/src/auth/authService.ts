import { randomBytes } from 'node:crypto'
import { DEPARTMENTS } from '@vtdesk/domain'
import type { DbMember, IDepartmentRepository, IMemberRepository } from '../repositories/interfaces.ts'
import { MockEmailService, type IEmailService } from '../notifications/emailService.ts'
import type { IAttachmentStorage } from '../attachments/attachmentStorage.ts'
import { OtpService } from './otpService.ts'
import type { ISessionService } from './sessionService.ts'
import {
  ResendCooldownError,
  VerificationError,
  VerificationExpiredError,
  VerificationLockedError,
  WrongVerificationCodeError,
} from './verificationErrors.ts'

const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEV_OTP_SECRET_BYTES = 32
const MIN_USERNAME_LENGTH = 2
const MIN_PASSWORD_LENGTH = 6

const AVATAR_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export interface UserProfile {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
  readonly requiresPasswordChange: boolean
  readonly email?: string
  readonly avatarAttachmentId?: string
}

export interface AuthSuccessResult {
  readonly token: string
  readonly user: UserProfile
}

// Projects a member onto the fields a signed-in client may see, leaving credentials behind
export function toUserProfile(member: DbMember): UserProfile {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    department: member.department,
    role: member.role,
    isDepartmentHead: member.isDepartmentHead,
    requiresPasswordChange: member.requiresPasswordChange,
    email: member.email,
    avatarAttachmentId: member.avatarAttachmentId,
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

export class AccountNotVerifiedError extends Error {
  constructor(message: string = 'Tài khoản chưa được xác thực email. Vui lòng kiểm tra hộp thư.') {
    super(message)
    this.name = 'AccountNotVerifiedError'
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

export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistrationValidationError'
  }
}

export interface RegisterInput {
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head'
  readonly email: string
  readonly password: string
}

export interface RegisterResult {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head'
  readonly email: string
  readonly message: string
}

// Lowercases and trims an email so lookups and uniqueness checks are case-insensitive
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT_PATTERN.test(email)
}

export class AuthService {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly sessionService: ISessionService,
    private readonly departmentRepo?: IDepartmentRepository,
    private readonly emailService: IEmailService = new MockEmailService(),
    private readonly otpService: OtpService = new OtpService(randomBytes(DEV_OTP_SECRET_BYTES).toString('hex')),
    private readonly attachmentStorage?: IAttachmentStorage,
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

    // Explicitly reject accounts that have not completed email verification
    if (member.isVerified === false) {
      throw new AccountNotVerifiedError()
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

    return { token, user: toUserProfile(member) }
  }

  // Retrieves member profile by identifier
  async getMember(userId: string): Promise<DbMember | null> {
    return await this.memberRepo.findById(userId)
  }

  // Sets or clears the profile picture; the image must already be uploaded as a small passive image attachment
  async updateAvatar(userId: string, attachmentId: string | null): Promise<DbMember> {
    const member = await this.memberRepo.findById(userId)
    if (!member) {
      throw new AuthenticationError('User not found.')
    }

    if (attachmentId !== null) {
      await this.assertUsableAvatar(attachmentId)
    }

    const updated: DbMember = { ...member, avatarAttachmentId: attachmentId ?? undefined, updatedAt: new Date() }
    await this.memberRepo.save(updated)
    return updated
  }

  private async assertUsableAvatar(attachmentId: string): Promise<void> {
    if (!this.attachmentStorage) {
      throw new Error('Attachment storage is not configured for avatar updates.')
    }
    const stored = await this.attachmentStorage.find(attachmentId)
    if (!stored) {
      throw new ProfileValidationError('Ảnh đại diện không tồn tại. Vui lòng tải ảnh lên lại.')
    }
    if (!AVATAR_MIME_TYPES.includes(stored.mimeType)) {
      throw new ProfileValidationError('Ảnh đại diện phải là tệp PNG, JPEG, WebP hoặc GIF.')
    }
    if (stored.sizeBytes > MAX_AVATAR_BYTES) {
      throw new ProfileValidationError('Ảnh đại diện không được vượt quá 2 MB.')
    }
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

  // Registers self-service user account with strict department, role, and email constraints
  async register(input: RegisterInput): Promise<RegisterResult> {
    const username = input.username?.trim().toLowerCase()
    const name = input.name?.trim()
    const department = input.department?.trim()
    const role = input.role
    const email = input.email ? normalizeEmail(input.email) : undefined
    const password = input.password

    if (!username || username.length < MIN_USERNAME_LENGTH) {
      throw new RegistrationValidationError('Tên tài khoản (mã nhân viên) phải có ít nhất 2 ký tự.')
    }

    const existingUser = await this.memberRepo.findByUsername(username)
    // Overwrite unverified account when customer abandoned previous registration attempt
    if (existingUser && existingUser.isVerified !== false) {
      throw new RegistrationValidationError('Tên tài khoản (mã nhân viên) đã tồn tại.')
    }

    if (!name || name.length === 0) {
      throw new RegistrationValidationError('Họ và tên không được để trống.')
    }

    if (role !== 'staff' && role !== 'head') {
      throw new RegistrationValidationError('Vai trò không hợp lệ.')
    }

    if (!department) {
      throw new RegistrationValidationError('Phòng ban không được để trống.')
    }

    // Verify department against registered departments or canonical domain catalog
    if (this.departmentRepo) {
      const departments = await this.departmentRepo.findAll()
      if (departments.length > 0 && !departments.includes(department)) {
        throw new RegistrationValidationError(`Phòng ban "${department}" không tồn tại.`)
      }
    } else if (!DEPARTMENTS.includes(department as any)) {
      throw new RegistrationValidationError(`Phòng ban "${department}" không tồn tại.`)
    }

    // Algorithm enforcing the strict constraint of at most one active verified manager per department
    if (role === 'head') {
      const departmentHeads = await this.memberRepo.findHeads([department])
      const existingHead = departmentHeads.find(
        (m) =>
          m.isActive &&
          m.isVerified !== false &&
          m.id !== existingUser?.id,
      )
      if (existingHead) {
        throw new RegistrationValidationError(
          `Phòng ban "${department}" đã có quản lý (${existingHead.name}). Mỗi phòng ban chỉ được có 1 quản lý.`,
        )
      }
    }

    if (!email || !isValidEmailFormat(email)) {
      throw new RegistrationValidationError('Email không đúng định dạng.')
    }

    const existingEmail = await this.memberRepo.findByEmail(email)
    // Allow overwrite if previous registration was abandoned prior to email verification
    if (existingEmail && existingEmail.isVerified !== false) {
      throw new RegistrationValidationError('Địa chỉ email này đã được sử dụng.')
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new RegistrationValidationError('Mật khẩu phải có ít nhất 6 ký tự.')
    }

    // Purge duplicate abandoned record if user previously registered with different username but same unverified email
    if (existingEmail && existingUser && existingEmail.id !== existingUser.id && existingEmail.isVerified === false) {
      await this.memberRepo.delete(existingEmail.id)
    }

    const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })

    const memberId =
      existingUser && existingUser.isVerified === false
        ? existingUser.id
        : existingEmail && existingEmail.isVerified === false
          ? existingEmail.id
          : crypto.randomUUID()
    const { code, otp } = this.otpService.issue(memberId)

    const newMember: DbMember = {
      id: memberId,
      username,
      name,
      department,
      role,
      isDepartmentHead: role === 'head',
      isActive: true,
      passwordHash,
      requiresPasswordChange: false,
      email,
      isVerified: false,
      otp,
      createdAt: existingUser?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    await this.memberRepo.save(newMember)
    await this.deliverVerificationCode(email, name, code)

    return {
      id: newMember.id,
      username: newMember.username,
      name: newMember.name,
      department: newMember.department,
      role: newMember.role as 'staff' | 'head',
      email: newMember.email!,
      message: 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để lấy mã xác thực trước khi đăng nhập.',
    }
  }

  // Verifies the one-time code sent to the email address, locking the code after too many wrong attempts
  async verifyEmail(tokenRaw: string, identifierRaw?: string): Promise<{ username: string; email: string }> {
    const code = tokenRaw?.trim()
    const identifier = identifierRaw?.trim().toLowerCase()
    if (!code || !identifier) {
      throw new VerificationError('Vui lòng cung cấp email và mã xác thực.')
    }

    const member = await this.findMemberByIdentifier(identifier)
    // One message for unknown, already verified and code-less accounts so the response reveals nothing
    if (!member || member.isVerified !== false || !member.otp) {
      throw new VerificationError('Mã xác thực không đúng hoặc tài khoản đã được xác thực trước đó.')
    }

    const result = this.otpService.check(member.id, member.otp, code)
    if (result.status === 'expired') {
      throw new VerificationExpiredError()
    }
    if (result.status === 'wrong' || result.status === 'locked') {
      await this.memberRepo.save({ ...member, otp: { ...member.otp, attempts: result.nextAttempts } })
      throw result.status === 'locked'
        ? new VerificationLockedError()
        : new WrongVerificationCodeError(result.remainingAttempts)
    }

    const updated: DbMember = { ...member, isVerified: true, otp: undefined, updatedAt: new Date() }
    await this.memberRepo.save(updated)

    return {
      username: updated.username,
      email: updated.email ?? '',
    }
  }

  // Sends a fresh code to a pending registration, enforcing the resend cooldown on the server
  async resendVerification(rawIdentifier: string): Promise<void> {
    const identifier = rawIdentifier?.trim().toLowerCase()
    if (!identifier) {
      throw new VerificationError('Vui lòng cung cấp tên tài khoản hoặc email.')
    }

    const member = await this.findMemberByIdentifier(identifier)

    // Silently terminate without disclosing whether the identifier exists in the directory
    if (!member || member.isVerified !== false) {
      return
    }

    const cooldownSeconds = member.otp ? this.otpService.remainingCooldownSeconds(member.otp) : 0
    if (cooldownSeconds > 0) {
      throw new ResendCooldownError(cooldownSeconds)
    }

    const { code, otp } = this.otpService.issue(member.id)
    await this.memberRepo.save({ ...member, otp, updatedAt: new Date() })

    if (member.email) {
      await this.deliverVerificationCode(member.email, member.name, code)
    }
  }

  // Identifiers containing an at sign are emails; anything else is a username
  private async findMemberByIdentifier(identifier: string): Promise<DbMember | null> {
    return identifier.includes('@') ? this.memberRepo.findByEmail(identifier) : this.memberRepo.findByUsername(identifier)
  }

  // A delivery failure must not undo registration, so it is logged and the member can request a resend
  private async deliverVerificationCode(to: string, name: string, code: string): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail({ to, name, token: code })
    } catch (err: unknown) {
      console.error('[AuthService] Verification email dispatch failed:', err instanceof Error ? err.message : String(err))
    }
  }

  // Exposes available departments for registration pickers
  async getPublicDepartments(): Promise<string[]> {
    if (this.departmentRepo) {
      const list = await this.departmentRepo.findAll()
      if (list.length > 0) return list
    }
    return [...DEPARTMENTS]
  }

  // Resolves departments that currently have an active verified manager assigned
  async getDepartmentHeadStatus(): Promise<Record<string, string>> {
    const heads = await this.memberRepo.findHeads()
    const headMap: Record<string, string> = {}
    for (const m of heads) {
      if (m.isActive && m.isVerified !== false) {
        headMap[m.department] = m.name
      }
    }
    return headMap
  }
}
