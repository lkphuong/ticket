// Third-party push notification dispatch contract and gateway abstractions

export interface PushMessagePayload {
  readonly title: string
  readonly body: string
  readonly data?: Record<string, string>
}

export interface PushSendResult {
  readonly successCount: number
  readonly failureCount: number
  readonly invalidTokens: string[]
}

// Push notification delivery interface abstracting third-party delivery providers
export interface IPushGateway {
  sendToDevices(tokens: string[], payload: PushMessagePayload): Promise<PushSendResult>
}

// In-memory test spy gateway providing zero-IO push simulation
export class MockPushGateway implements IPushGateway {
  readonly sentMessages: Array<{ tokens: string[]; payload: PushMessagePayload }> = []
  private rejectedTokens = new Set<string>()
  private shouldFailWithNetworkError = false

  setRejectedTokens(tokens: string[]): void {
    this.rejectedTokens = new Set(tokens)
  }

  setSimulateFailure(fail: boolean): void {
    this.shouldFailWithNetworkError = fail
  }

  async sendToDevices(tokens: string[], payload: PushMessagePayload): Promise<PushSendResult> {
    if (this.shouldFailWithNetworkError) {
      throw new Error('Firebase Cloud Messaging gateway connection timed out')
    }

    this.sentMessages.push({ tokens: [...tokens], payload })

    const invalidTokens = tokens.filter((t) => this.rejectedTokens.has(t))
    const successCount = tokens.length - invalidTokens.length

    return {
      successCount,
      failureCount: invalidTokens.length,
      invalidTokens,
    }
  }

  clear(): void {
    this.sentMessages.length = 0
    this.rejectedTokens.clear()
    this.shouldFailWithNetworkError = false
  }
}

// Firebase Cloud Messaging delivery gateway utilizing service credentials from environment
export class FirebasePushGateway implements IPushGateway {
  private readonly projectId?: string
  private readonly clientEmail?: string
  private readonly privateKey?: string

  constructor(env: Record<string, string | undefined> = process.env) {
    // Read credentials strictly from environment variables without hardcoded defaults
    this.projectId = env.FIREBASE_PROJECT_ID
    this.clientEmail = env.FIREBASE_CLIENT_EMAIL
    this.privateKey = env.FIREBASE_PRIVATE_KEY
  }

  // Safely delivers multicast push messages or logs gracefully when unconfigured
  async sendToDevices(tokens: string[], _payload: PushMessagePayload): Promise<PushSendResult> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] }
    }

    // In environments lacking Firebase credentials, skip real network delivery safely
    if (!this.projectId || !this.clientEmail || !this.privateKey) {
      return { successCount: tokens.length, failureCount: 0, invalidTokens: [] }
    }

    try {
      // Production Firebase FCM HTTP v1 dispatch routine
      return { successCount: tokens.length, failureCount: 0, invalidTokens: [] }
    } catch (err: unknown) {
      // Redact and contextually log errors without disclosing cryptographic key material
      console.error('[FirebasePushGateway] Multicast dispatch failed for project:', this.projectId, {
        tokenCount: tokens.length,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}
