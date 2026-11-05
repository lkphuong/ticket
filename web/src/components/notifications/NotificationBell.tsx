// In-app notification bell with real-time unread counter, dropdown feed, and optional push registration

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.ts'
import type { AppNotification } from '../../lib/apiClient.ts'
import { formatDateTime } from '../../lib/formatDate.ts'
import { useToast } from '../../lib/toastContext.ts'
import { Button } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'

export function NotificationBell() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushSupported] = useState<boolean>(() => typeof window !== 'undefined' && 'Notification' in window)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'default'
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Synchronizes notification feed and unread counter from the server
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const res = await apiClient.notifications.list()
        if (active) {
          setNotifications(res.notifications)
          setUnreadCount(res.unreadCount)
        }
      } catch {
        // Retain existing state on transient communication failure
      }
    }

    void poll()
    // Poll notifications periodically to reflect incoming alerts
    const timer = setInterval(() => {
      void poll()
    }, 15000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // Dismisses popover when clicking outside the panel container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  async function handleMarkAllAsRead() {
    try {
      await apiClient.notifications.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
      notify('Đã đánh dấu tất cả thông báo là đã đọc.', 'neutral')
    } catch {
      notify('Không thể cập nhật trạng thái thông báo.', 'danger')
    }
  }

  async function handleNotificationClick(item: AppNotification) {
    if (!item.isRead) {
      try {
        await apiClient.notifications.markRead(item.id)
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // Proceed with navigation regardless of read-state failure
      }
    }
    setIsOpen(false)
    if (item.ticketId) {
      navigate(`/tickets/${item.ticketId}`)
    }
  }

  async function handleRequestPushPermission() {
    if (!pushSupported) return
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission === 'granted') {
        // Generate simulated browser device registration token
        const dummyToken = `browser-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        await apiClient.notifications.registerDevice(dummyToken)
        notify('Đã kích hoạt thông báo đẩy trên trình duyệt thành công.', 'success')
      } else if (permission === 'denied') {
        notify('Bạn đã từ chối quyền thông báo đẩy. Bạn vẫn có thể xem danh sách thông báo tại đây.', 'neutral')
      }
    } catch {
      notify('Không thể đăng ký thông báo đẩy trình duyệt.', 'danger')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-label={`Thông báo (${unreadCount} chưa đọc)`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="relative inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus:border-accent-600 focus:outline-none"
      >
        <Icon name="bell" className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick-700 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-0 shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">Thông báo</span>
              {unreadCount > 0 && (
                <span className="rounded bg-mine-100 px-1.5 py-0.5 text-[10px] font-semibold text-mine-800">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-accent-700 hover:underline"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {pushSupported && pushPermission === 'default' && (
            <div className="border-b border-line bg-canvas p-3">
              <p className="text-xs text-ink-muted">Nhận thông báo tức thì khi có yêu cầu mới hoặc cập nhật trạng thái.</p>
              <Button
                variant="secondary"
                className="mt-2 w-full justify-center text-xs py-1"
                onClick={handleRequestPushPermission}
              >
                Bật thông báo đẩy trình duyệt
              </Button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-ink-muted">Không có thông báo nào.</p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`flex w-full flex-col gap-1 p-3 text-left transition-colors hover:bg-canvas ${
                    !item.isRead ? 'bg-accent-100/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs ${!item.isRead ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent-600" aria-label="Chưa đọc" />
                    )}
                  </div>
                  <p className="text-xs text-ink leading-relaxed">{item.body}</p>
                  <span className="text-[10px] text-ink-muted">{formatDateTime(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
