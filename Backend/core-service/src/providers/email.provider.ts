import { Resend } from 'resend';
import { ENV } from '../config/env';
import { renderVerifyEmailTemplate } from '../templates/emails/verifyEmail.template';
import { renderPasswordResetTemplate } from '../templates/emails/passwordReset.template';
import { renderWorkspaceInviteTemplate } from '../templates/emails/workspaceInvite.template';
import { renderSecurityAlertTemplate } from '../templates/emails/securityAlert.template';

export class EmailProvider {
  private getResendInstance(): { client: Resend | null; from: string; isDev: boolean } {
    const apiKey = (process.env.RESEND_API_KEY || ENV.RESEND_API_KEY || '').trim();
    const isDev = !apiKey || apiKey.startsWith('re_mock') || process.env.NODE_ENV === 'test';
    const rawFrom = (process.env.EMAIL_FROM || ENV.EMAIL_FROM || 'onboarding@resend.dev').trim();
    const from = rawFrom.replace(/^["']|["']$/g, '');

    return {
      client: !isDev && apiKey ? new Resend(apiKey) : null,
      from,
      isDev,
    };
  }

  public async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; id?: string }> {
    const toFormatted = Array.isArray(params.to) ? params.to : [params.to];
    if (toFormatted.length === 0) {
      return { success: false };
    }

    const { client, from, isDev } = this.getResendInstance();

    if (isDev || !client) {
      const maskedRecipients = toFormatted.map((e) => {
        const [u, d] = e.split('@');
        return u ? (u.length <= 2 ? u[0] + '*@' + (d || '') : u.slice(0, 2) + '***@' + (d || '')) : '***';
      });
      console.log('---------------------------------------------------------');
      console.log(`📨 [MOCK EMAIL SENT via Resend Provider]`);
      console.log(`To:      ${maskedRecipients.join(', ')}`);
      console.log(`Subject: ${params.subject}`);
      console.log(`Idempotency: ${params.idempotencyKey ? 'set' : 'none'}`);
      console.log('---------------------------------------------------------');
      return { success: true, id: `mock_${Date.now()}` };
    }

    try {
      const { data, error } = await client.emails.send({
        from,
        to: toFormatted,
        subject: params.subject,
        html: params.html,
        text: params.text,
        headers: params.idempotencyKey ? { 'X-Entity-Ref-ID': params.idempotencyKey } : undefined
      });

      if (error) {
        // Handle Resend sandbox account limitation in development mode gracefully
        const isSandboxAddressError =
          error.message?.includes('You can only send testing emails to your own email address') ||
          (error as any).statusCode === 403;

        if (isSandboxAddressError && process.env.NODE_ENV !== 'production') {
          console.warn(`⚠️ [Resend Sandbox Limitation] Live send blocked for unverified address: ${toFormatted.join(', ')}`);
          console.warn('💡 Resend sandbox accounts only deliver to account owner. In dev, falling back to console mock.');
          console.log('---------------------------------------------------------');
          console.log(`📨 [DEV FALLBACK EMAIL DISPATCHED]`);
          console.log(`To:      ${toFormatted.join(', ')}`);
          console.log(`Subject: ${params.subject}`);
          console.log(`Text Body:\n${params.text}`);
          console.log('---------------------------------------------------------');
          return { success: true, id: `dev_sandbox_fallback_${Date.now()}` };
        }

        console.error('❌ Resend API Error:', error);
        throw new Error(`Resend Error: ${error.message}`);
      }

      return { success: true, id: data?.id };
    } catch (err: any) {
      if (
        err?.message?.includes('You can only send testing emails to your own email address') &&
        process.env.NODE_ENV !== 'production'
      ) {
        console.warn('⚠️ [Resend Sandbox Limitation] Handled in dev fallback.');
        return { success: true, id: `dev_sandbox_fallback_${Date.now()}` };
      }
      console.error('❌ Failed to dispatch email via Resend:', err.message);
      throw err;
    }
  }

  public async sendVerificationEmail(to: string, userName: string, link: string, idempotencyKey?: string) {
    const { subject, html, text } = renderVerifyEmailTemplate({ userName, verificationLink: link });
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendPasswordResetEmail(to: string, userName: string, link: string, idempotencyKey?: string) {
    const { subject, html, text } = renderPasswordResetTemplate({ userName, resetLink: link });
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendWorkspaceInviteEmail(to: string, inviterName: string, workspaceName: string, role: string, link: string, idempotencyKey?: string) {
    const { subject, html, text } = renderWorkspaceInviteTemplate({ inviterName, workspaceName, role, inviteLink: link });
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendSecurityAlert(to: string, userName: string, action: string, details: string, idempotencyKey?: string) {
    const { subject, html, text } = renderSecurityAlertTemplate({
      userName,
      action,
      details,
      timestamp: new Date().toUTCString()
    });
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendNegativeReviewAlert(to: string | string[], data: import('../templates/emails/alertNegativeReview.template').NegativeReviewAlertData, idempotencyKey?: string) {
    const { renderNegativeReviewAlertTemplate } = await import('../templates/emails/alertNegativeReview.template');
    const { subject, html, text } = renderNegativeReviewAlertTemplate(data);
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendListingProtectionAlert(to: string | string[], data: import('../templates/emails/alertListingProtection.template').ListingProtectionAlertData, idempotencyKey?: string) {
    const { renderListingProtectionAlertTemplate } = await import('../templates/emails/alertListingProtection.template');
    const { subject, html, text } = renderListingProtectionAlertTemplate(data);
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendRankDropAlert(to: string | string[], data: import('../templates/emails/alertRankDrop.template').RankDropAlertData, idempotencyKey?: string) {
    const { renderRankDropAlertTemplate } = await import('../templates/emails/alertRankDrop.template');
    const { subject, html, text } = renderRankDropAlertTemplate(data);
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }

  public async sendGeneralAlert(to: string | string[], data: import('../templates/emails/alertGeneral.template').GeneralAlertData, idempotencyKey?: string) {
    const { renderGeneralAlertTemplate } = await import('../templates/emails/alertGeneral.template');
    const { subject, html, text } = renderGeneralAlertTemplate(data);
    return this.sendEmail({ to, subject, html, text, idempotencyKey });
  }
}

export const emailProvider = new EmailProvider();
