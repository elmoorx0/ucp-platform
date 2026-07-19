/**
 * Email SMTP Provider
 * Sends transactional emails via SMTP (Nodemailer-compatible).
 *
 * In production: install nodemailer and pass real SMTP credentials.
 * In sandbox/dev: we simulate the SMTP send and write the email body
 * to console + a log file for inspection.
 */

import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'
import { randomUUID } from 'crypto'

export class EmailSmtpProvider extends BaseProvider {
  readonly name: ProviderName = 'email_smtp'
  readonly displayName = 'Email (SMTP)'
  readonly capabilities: ProviderCapabilities = {
    channels: ['email'],
    supportsBatch: false,
    supportsTemplate: true,
    supportsScheduled: true,
    maxRatePerSecond: 10,
  }

  private host = ''
  private port = 587
  private secure = false
  private username = ''
  private fromAddress = ''
  private useSimulation = true

  protected async onInitialize(): Promise<void> {
    this.host = (this.credentials.host as string) || ''
    this.port = (this.credentials.port as number) || 587
    this.secure = (this.credentials.secure as boolean) || this.port === 465
    this.username = (this.credentials.username as string) || ''
    this.fromAddress = (this.config.fromAddress as string) || `no-reply@${this.host || 'example.com'}`
    this.useSimulation = !this.host || !this.username
  }

  protected async onValidateCredentials(): Promise<boolean> {
    if (this.useSimulation) return true
    return !!(this.host && this.username && this.fromAddress)
  }

  async send(request: SendRequest): Promise<SendResult> {
    const to = request.email || (typeof request.to === 'string' ? request.to : undefined)
    if (!to) {
      return {
        success: false,
        error: { code: 'MISSING_RECIPIENT', message: 'Email requires a recipient email address', retryable: false },
      }
    }

    const emailPayload = {
      from: this.fromAddress,
      to,
      subject: request.title,
      html: this.renderEmailHtml(request.title, request.body, request.imageUrl),
      text: request.body,
      ...(request.data || {}),
    }

    if (this.useSimulation) {
      // Simulate SMTP — log the email body
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 50))
      console.log(`[EmailProvider:SIM] To=${to} Subject="${request.title}"`)
      return {
        success: true,
        providerMessageId: `email_sim_${randomUUID()}`,
        metadata: { simulated: true, ...emailPayload },
      }
    }

    // Real SMTP implementation (requires nodemailer):
    // const nodemailer = require('nodemailer')
    // const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    // const info = await transporter.sendMail(emailPayload)
    // return { success: true, providerMessageId: info.messageId }
    return {
      success: false,
      error: {
        code: 'SMTP_NOT_CONFIGURED',
        message: 'nodemailer is not installed. Add the dependency and configure SMTP credentials.',
        retryable: false,
      },
    }
  }

  private renderEmailHtml(title: string, body: string, imageUrl?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:0;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${imageUrl ? `<tr><td><img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;max-height:260px;object-fit:cover;display:block;"></td></tr>` : ''}
        <tr><td style="padding:32px 40px 8px 40px;">
          <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:600;color:#0f172a;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <p style="margin:0;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(body)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Sent via Universal Communication Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
