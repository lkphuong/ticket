// Verification email content: subject, table based HTML that adapts to light and dark clients, and a plain text twin

export interface VerificationEmailContent {
  readonly subject: string
  readonly html: string
  readonly text: string
}

export interface VerificationEmailTemplateInput {
  readonly name: string
  readonly code: string
  readonly validityMinutes: number
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

// Neutralizes markup so user supplied values can never inject HTML into the message
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

// Inline styles only use colors that stay legible when a client inverts the palette for dark mode
const PAGE_STYLE = "margin:0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
const CARD_STYLE = 'max-width:480px;border:1px solid #cbd5e1;border-radius:8px;'
const CODE_STYLE =
  "padding:12px 20px;border:1px solid #94a3b8;border-radius:6px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;"

// Renders the verification email for one recipient; every interpolated value is escaped for HTML
export function renderVerificationEmail(input: VerificationEmailTemplateInput): VerificationEmailContent {
  const name = escapeHtml(input.name)
  const code = escapeHtml(input.code)
  const subject = `${input.code} là mã xác thực VTDesk của bạn`

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Mã xác thực VTDesk</title>
</head>
<body style="${PAGE_STYLE}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${CARD_STYLE}">
<tr><td style="padding:24px 24px 8px 24px;font-size:18px;font-weight:700;">VTDesk</td></tr>
<tr><td style="padding:8px 24px;font-size:15px;line-height:22px;">Xin chào ${name},<br>Dùng mã dưới đây để xác thực email và hoàn tất đăng ký tài khoản.</td></tr>
<tr><td align="center" style="padding:16px 24px;"><span style="${CODE_STYLE}">${code}</span></td></tr>
<tr><td style="padding:0 24px 8px 24px;font-size:14px;line-height:20px;">Mã có hiệu lực trong ${input.validityMinutes} phút.</td></tr>
<tr><td style="padding:8px 24px 24px 24px;font-size:13px;line-height:19px;opacity:0.8;">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không đăng ký tài khoản VTDesk, hãy bỏ qua email này.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    `Xin chào ${input.name},`,
    '',
    'Dùng mã dưới đây để xác thực email và hoàn tất đăng ký tài khoản VTDesk:',
    '',
    input.code,
    '',
    `Mã có hiệu lực trong ${input.validityMinutes} phút.`,
    'Không chia sẻ mã này với bất kỳ ai. Nếu bạn không đăng ký tài khoản VTDesk, hãy bỏ qua email này.',
  ].join('\n')

  return { subject, html, text }
}
