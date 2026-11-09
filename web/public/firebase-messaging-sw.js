// Displays FCM pushes received while no tab is focused and routes clicks to the related ticket

self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  const notification = payload.notification ?? {}
  event.waitUntil(
    self.registration.showNotification(notification.title ?? 'VTDesk', {
      body: notification.body ?? '',
      icon: '/favicon.svg',
      data: { ticketId: payload.data?.ticketId },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ticketId = event.notification.data?.ticketId
  const target = ticketId ? `/tickets/${ticketId}` : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client)
      if (open) {
        return open.focus().then((client) => client.navigate(target))
      }
      return self.clients.openWindow(target)
    }),
  )
})
