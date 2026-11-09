// Firebase Cloud Messaging browser integration: token registration and foreground message delivery

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

export interface FirebaseWebConfig {
  readonly apiKey: string
  readonly projectId: string
  readonly messagingSenderId: string
  readonly appId: string
  readonly vapidKey: string
}

export interface ForegroundPushMessage {
  readonly title: string
  readonly body: string
  readonly ticketId?: string
}

const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js'

// Returns the web configuration only when every required value is present
export function readFirebaseWebConfig(env: Record<string, string | undefined>): FirebaseWebConfig | undefined {
  const apiKey = env.VITE_FIREBASE_API_KEY?.trim()
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim()
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = env.VITE_FIREBASE_APP_ID?.trim()
  const vapidKey = env.VITE_FIREBASE_VAPID_KEY?.trim()
  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) return undefined
  return { apiKey, projectId, messagingSenderId, appId, vapidKey }
}

const firebaseWebConfig = readFirebaseWebConfig(import.meta.env)

// True when the browser supports push and the deployment provides Firebase configuration
export async function isPushAvailable(): Promise<boolean> {
  if (!firebaseWebConfig) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

function getFirebaseApp(config: FirebaseWebConfig) {
  return (
    getApps()[0] ??
    initializeApp({
      apiKey: config.apiKey,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    })
  )
}

// Registers the service worker and returns this browser's FCM registration token
export async function requestPushToken(): Promise<string> {
  if (!firebaseWebConfig) throw new Error('Firebase web configuration is missing.')
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH)
  const token = await getToken(getMessaging(getFirebaseApp(firebaseWebConfig)), {
    vapidKey: firebaseWebConfig.vapidKey,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error('Firebase did not return a registration token.')
  return token
}

// Listens for pushes arriving while the tab is open; returns an unsubscribe function
export function subscribeToForegroundPush(handler: (message: ForegroundPushMessage) => void): () => void {
  if (!firebaseWebConfig) return () => {}
  return onMessage(getMessaging(getFirebaseApp(firebaseWebConfig)), (payload) => {
    handler({
      title: payload.notification?.title ?? '',
      body: payload.notification?.body ?? '',
      ticketId: payload.data?.ticketId,
    })
  })
}
