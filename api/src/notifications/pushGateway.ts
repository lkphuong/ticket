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

// Subset of the Firebase Admin messaging API used for multicast delivery
export interface FcmMulticastSender {
  sendEachForMulticast(message: {
    tokens: string[]
    notification: { title: string; body: string }
    data?: Record<string, string>
    webpush?: { fcmOptions?: { link?: string } }
  }): Promise<{ responses: Array<{ success: boolean; error?: { code?: string } }> }>
}

export interface FirebaseCredentials {
  readonly projectId: string
  readonly clientEmail: string
  readonly privateKey: string
}

export type FcmSenderFactory = (credentials: FirebaseCredentials) => FcmMulticastSender

// Error codes meaning the registration token will never be deliverable again
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

// Builds the production sender backed by firebase-admin, imported lazily so unconfigured environments never load it
const createAdminSender: FcmSenderFactory = (credentials) => {
  let sender: Promise<FcmMulticastSender> | undefined
  const resolve = (): Promise<FcmMulticastSender> => {
    sender ??= (async () => {
      const [{ cert, getApps, initializeApp }, { getMessaging }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/messaging'),
      ])
      const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
      return getMessaging(app)
    })()
    return sender
  }
  return { sendEachForMulticast: async (message) => (await resolve()).sendEachForMulticast(message) }
}

// Firebase Cloud Messaging delivery gateway utilizing service credentials from environment
export class FirebasePushGateway implements IPushGateway {
  private readonly credentials?: FirebaseCredentials
  private readonly sender?: FcmMulticastSender

  constructor(
    env: Record<string, string | undefined> = process.env,
    createSender: FcmSenderFactory = createAdminSender,
  ) {
    // Read credentials strictly from environment variables without hardcoded defaults
    const projectId = env.FIREBASE_PROJECT_ID?.trim()
    const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim()
    // Environment files store the key on one line with escaped newlines
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    if (projectId && clientEmail && privateKey) {
      this.credentials = { projectId, clientEmail, privateKey }
      this.sender = createSender(this.credentials)
    }
  }

  // Delivers a multicast push message, or skips silently when Firebase is not configured
  async sendToDevices(tokens: string[], payload: PushMessagePayload): Promise<PushSendResult> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] }
    }

    // In environments lacking Firebase credentials, skip real network delivery safely
    if (!this.sender || !this.credentials) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] }
    }

    try {
      const batch = await this.sender.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        webpush: payload.data?.ticketId ? { fcmOptions: { link: `/tickets/${payload.data.ticketId}` } } : undefined,
      })
      const invalidTokens = tokens.filter((_, index) => {
        const code = batch.responses[index]?.error?.code
        return code !== undefined && INVALID_TOKEN_ERROR_CODES.has(code)
      })
      const successCount = batch.responses.filter((response) => response.success).length
      return { successCount, failureCount: tokens.length - successCount, invalidTokens }
    } catch (err: unknown) {
      // Redact and contextually log errors without disclosing cryptographic key material
      console.error('[FirebasePushGateway] Multicast dispatch failed for project:', this.credentials.projectId, {
        tokenCount: tokens.length,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}
