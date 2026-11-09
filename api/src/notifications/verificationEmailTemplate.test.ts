import { describe, expect, it } from 'bun:test'
import { escapeHtml, renderVerificationEmail } from './verificationEmailTemplate.ts'

const BASE_INPUT = { name: 'Nguyễn Văn A', code: '123456', validityMinutes: 10 }

describe('renderVerificationEmail', () => {
  it('should_include_code_name_and_validity_in_html_and_text_when_rendering', () => {
    const { html, text, subject } = renderVerificationEmail(BASE_INPUT)

    for (const body of [html, text]) {
      expect(body).toContain('123456')
      expect(body).toContain('Nguyễn Văn A')
      expect(body).toContain('10 phút')
    }
    expect(subject).toContain('123456')
  })

  it('should_declare_light_and_dark_color_scheme_support_when_rendering_html', () => {
    const { html } = renderVerificationEmail(BASE_INPUT)

    expect(html).toContain('<meta name="color-scheme" content="light dark">')
    expect(html).toContain('lang="vi"')
    expect(html).toContain('<table')
  })

  it('should_escape_user_supplied_values_when_name_contains_markup', () => {
    const { html, text } = renderVerificationEmail({ ...BASE_INPUT, name: '<script>alert("x")</script> & "Bob"' })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;Bob&quot;')
    // The plain text body is not HTML so it keeps the original characters
    expect(text).toContain('<script>')
  })

  it('should_escape_code_when_code_contains_markup', () => {
    const { html } = renderVerificationEmail({ ...BASE_INPUT, code: '<b>1</b>' })

    expect(html).not.toContain('<b>1</b>')
    expect(html).toContain('&lt;b&gt;1&lt;/b&gt;')
  })

  it('should_not_make_compliance_claims_or_include_links_when_rendering', () => {
    const { html, text } = renderVerificationEmail(BASE_INPUT)

    for (const body of [html, text]) {
      expect(body).not.toMatch(/ISO|SOC/i)
      expect(body).not.toContain('href=')
    }
  })
})

describe('escapeHtml', () => {
  it('should_replace_all_special_characters_when_escaping', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
