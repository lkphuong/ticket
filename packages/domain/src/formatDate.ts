const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(isoOrDateOnly: string): string {
  return dateFormatter.format(new Date(isoOrDateOnly))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}
