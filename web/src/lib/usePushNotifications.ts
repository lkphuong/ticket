// Browser push opt-in: permission, device registration and a per-browser off switch the user controls

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from './apiClient.ts'
import { isPushAvailable, requestPushToken } from './firebaseMessaging.ts'
import { useToast } from './toastContext.ts'

const PUSH_DISABLED_KEY = 'vtdesk.push.disabled'
const DISABLED_VALUE = '1'

export interface PushNotificationControls {
  readonly isSupported: boolean
  readonly permission: NotificationPermission
  // True while permission is granted and the user has not switched notifications off in this browser
  readonly isEnabled: boolean
  readonly isBusy: boolean
  enable: () => Promise<void>
  disable: () => Promise<void>
}

function readPermission(): NotificationPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
}

function readDisabledByUser(): boolean {
  try {
    return localStorage.getItem(PUSH_DISABLED_KEY) === DISABLED_VALUE
  } catch {
    // Restricted storage contexts simply cannot remember the choice
    return false
  }
}

function writeDisabledByUser(isDisabled: boolean): void {
  try {
    if (isDisabled) localStorage.setItem(PUSH_DISABLED_KEY, DISABLED_VALUE)
    else localStorage.removeItem(PUSH_DISABLED_KEY)
  } catch {
    // Restricted storage contexts simply cannot remember the choice
  }
}

export function usePushNotifications(): PushNotificationControls {
  const { notify } = useToast()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(readPermission)
  const [isDisabledByUser, setIsDisabledByUser] = useState(readDisabledByUser)
  const [isBusy, setIsBusy] = useState(false)

  // Once support is known, refreshes the device token of a browser that already opted in
  useEffect(() => {
    let active = true
    void isPushAvailable().then(async (available) => {
      if (!active || !available) return
      setIsSupported(true)
      if (readPermission() !== 'granted' || readDisabledByUser()) return
      try {
        await apiClient.notifications.registerDevice(await requestPushToken())
      } catch (error: unknown) {
        console.warn('Push device token could not be refreshed', error)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const enable = useCallback(async (): Promise<void> => {
    if (!isSupported) return
    setIsBusy(true)
    try {
      const result = readPermission() === 'granted' ? 'granted' : await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') {
        notify('Trình duyệt đang chặn thông báo. Hãy cho phép thông báo cho trang này trong cài đặt trình duyệt.', 'info')
        return
      }
      await apiClient.notifications.registerDevice(await requestPushToken())
      writeDisabledByUser(false)
      setIsDisabledByUser(false)
      notify('Đã bật thông báo đẩy trên trình duyệt này.', 'success')
    } catch (error: unknown) {
      console.error('Push notifications could not be enabled', error)
      notify('Không thể bật thông báo đẩy trên trình duyệt này.', 'error')
    } finally {
      setIsBusy(false)
    }
  }, [isSupported, notify])

  const disable = useCallback(async (): Promise<void> => {
    setIsBusy(true)
    try {
      await apiClient.notifications.unregisterDevice(await requestPushToken())
      writeDisabledByUser(true)
      setIsDisabledByUser(true)
      notify('Đã tắt thông báo đẩy trên trình duyệt này.', 'info')
    } catch (error: unknown) {
      console.error('Push notifications could not be disabled', error)
      notify('Không thể tắt thông báo đẩy lúc này.', 'error')
    } finally {
      setIsBusy(false)
    }
  }, [notify])

  return {
    isSupported,
    permission,
    isEnabled: isSupported && permission === 'granted' && !isDisabledByUser,
    isBusy,
    enable,
    disable,
  }
}
