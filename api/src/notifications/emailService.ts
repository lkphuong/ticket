// Third-party email verification dispatch contract and service abstractions

import { OTP_TTL_MS } from '../auth/otpService.ts'
import { renderVerificationEmail } from './verificationEmailTemplate.ts'

const MILLISECONDS_PER_MINUTE = 60 * 1000

export interface VerificationEmailPayload {
  readonly to: string
  readonly name: string
  readonly token: string
}

// Email delivery interface abstracting SMTP or transactional email providers
export interface IEmailService {
  sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>
}

// In-memory test spy email service providing zero-IO email recording
export class MockEmailService implements IEmailService {
  readonly sentEmails: VerificationEmailPayload[] = []
  private shouldFailWithNetworkError = false

  setSimulateFailure(fail: boolean): void {
    this.shouldFailWithNetworkError = fail
  }

  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    if (this.shouldFailWithNetworkError) {
      throw new Error('Email delivery connection failed')
    }
    this.sentEmails.push({ ...payload })
  }

  clear(): void {
    this.sentEmails.length = 0
    this.shouldFailWithNetworkError = false
  }
}

// Console email service for local development logging verification codes
export class ConsoleEmailService implements IEmailService {
  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    // Log verification details clearly for development auditing
    console.log(`[EmailService] Verification email sent to: ${payload.to}`)
    console.log(`[EmailService] Recipient name: ${payload.name}`)
    console.log(`[EmailService] Verification OTP code: ${payload.token}`)
  }
}

// Resend transactional email delivery service communicating directly with the official Resend API
export class ResendEmailService implements IEmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string = 'VTDesk <onboarding@resend.dev>',
  ) {}

  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    const content = renderVerificationEmail({
      name: payload.name,
      code: payload.token,
      validityMinutes: OTP_TTL_MS / MILLISECONDS_PER_MINUTE,
    })

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [payload.to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[ResendEmailService] HTTP ${response.status}: ${errorBody}`)
      throw new Error(`Resend email delivery failed with status ${response.status}: ${errorBody}`)
    }

    const data: any = await response.json().catch(() => null)
    console.log(`[ResendEmailService] Email successfully delivered to ${payload.to} [id=${data?.id || 'unknown'}]`)
  }
}
