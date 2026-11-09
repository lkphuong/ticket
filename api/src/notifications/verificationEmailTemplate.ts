// Verification email content: subject, branded table based HTML with explicit light and dark palettes, and a plain text twin

export interface VerificationEmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface VerificationEmailTemplateInput {
  readonly name: string;
  readonly code: string;
  readonly validityMinutes: number;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Neutralizes markup so user supplied values can never inject HTML into the message
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

const FONT_STACK = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'SF Mono',Menlo,Consolas,monospace";

// Light palette is inlined for every client; the dark palette overrides it only where prefers-color-scheme is honored
const PAGE_STYLE = `margin:0;padding:32px 12px;background-color:#f1f5f9;font-family:${FONT_STACK};color:#0f172a;`;
const CARD_STYLE =
  "max-width:520px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;";
const HEADER_STYLE = `padding:20px 32px;background-color:#0f172a;border-radius:12px 12px 0 0;font-size:20px;font-weight:700;letter-spacing:0.5px;color:#ffffff;`;
const HEADING_STYLE =
  "padding:32px 32px 8px 32px;font-size:22px;line-height:30px;font-weight:700;color:#0f172a;";
const BODY_STYLE =
  "padding:0 32px;font-size:15px;line-height:24px;color:#334155;";
const CODE_CELL_STYLE = "padding:24px 32px;";
const CODE_STYLE = `display:inline-block;padding:16px 28px;background-color:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;font-family:${MONO_STACK};font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:#0f172a;`;
const VALIDITY_STYLE =
  "padding:0 32px 24px 32px;font-size:14px;line-height:22px;color:#475569;";
const DIVIDER_STYLE = "padding:0 32px;";
const NOTICE_STYLE =
  "padding:20px 32px 32px 32px;font-size:13px;line-height:20px;color:#64748b;";
const FOOTER_STYLE =
  "padding:16px 12px 0 12px;font-size:12px;line-height:18px;color:#94a3b8;text-align:center;";
const PREHEADER_STYLE =
  "display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;";

const DARK_MODE_CSS = `@media (prefers-color-scheme: dark) {
  .vt-page { background-color: #020617 !important; }
  .vt-card { background-color: #0f172a !important; border-color: #1e293b !important; }
  .vt-header { background-color: #1e293b !important; }
  .vt-heading { color: #f8fafc !important; }
  .vt-body { color: #cbd5e1 !important; }
  .vt-code { background-color: #1e293b !important; border-color: #475569 !important; color: #f8fafc !important; }
  .vt-muted { color: #94a3b8 !important; }
  .vt-divider { border-top-color: #1e293b !important; }
}`;

// Renders the verification email for one recipient; every interpolated value is escaped for HTML
export function renderVerificationEmail(
  input: VerificationEmailTemplateInput,
): VerificationEmailContent {
  const name = escapeHtml(input.name);
  const code = escapeHtml(input.code);
  const subject = `${input.code} là mã xác thực VTDesk của bạn`;
  const preheader = `Mã xác thực của bạn có hiệu lực trong ${input.validityMinutes} phút.`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Mã xác thực VTDesk</title>
<style>${DARK_MODE_CSS}</style>
</head>
<body class="vt-page" style="${PAGE_STYLE}">
<div style="${PREHEADER_STYLE}">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center">
<table role="presentation" class="vt-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="${CARD_STYLE}">
<tr><td class="vt-header" style="${HEADER_STYLE}">VTDesk</td></tr>
<tr><td class="vt-heading" style="${HEADING_STYLE}">Xác thực địa chỉ email</td></tr>
<tr><td class="vt-body" style="${BODY_STYLE}">Xin chào ${name},<br>Nhập mã dưới đây để xác thực email và hoàn tất đăng ký tài khoản VTDesk của bạn.</td></tr>
<tr><td align="center" style="${CODE_CELL_STYLE}"><span class="vt-code" style="${CODE_STYLE}">${code}</span></td></tr>
<tr><td align="center" class="vt-muted" style="${VALIDITY_STYLE}">Mã có hiệu lực trong <strong>${input.validityMinutes} phút</strong>.</td></tr>
<tr><td style="${DIVIDER_STYLE}"><div class="vt-divider" style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td class="vt-muted" style="${NOTICE_STYLE}">Vì lý do bảo mật, không chia sẻ mã này với bất kỳ ai, kể cả nhân viên VTDesk. Nếu bạn không đăng ký tài khoản VTDesk, hãy bỏ qua email này.</td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
<tr><td class="vt-muted" style="${FOOTER_STYLE}">Đây là email tự động từ VTDesk, vui lòng không trả lời email này.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Xin chào ${input.name},`,
    "",
    "Nhập mã dưới đây để xác thực email và hoàn tất đăng ký tài khoản VTDesk của bạn:",
    "",
    input.code,
    "",
    `Mã có hiệu lực trong ${input.validityMinutes} phút.`,
    "Vì lý do bảo mật, không chia sẻ mã này với bất kỳ ai, kể cả nhân viên VTDesk. Nếu bạn không đăng ký tài khoản VTDesk, hãy bỏ qua email này.",
    "",
    "Đây là email tự động từ VTDesk, vui lòng không trả lời email này.",
  ].join("\n");

  return { subject, html, text };
}
