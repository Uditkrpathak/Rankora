import { escapeHtml } from './escapeHtml';

export interface VerifyEmailData {
  userName: string;
  verificationLink: string;
}

export function renderVerifyEmailTemplate(data: VerifyEmailData): { subject: string; html: string; text: string } {
  const safeUserName = escapeHtml(data.userName);
  const safeLink = escapeHtml(data.verificationLink);
  const subject = 'Verify your email to activate your Localo account';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .logo { font-size: 22px; font-weight: 700; color: #4338ca; margin-bottom: 24px; letter-spacing: -0.5px; }
          .heading { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
          .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">📍 Localo</div>
          <div class="heading">Welcome aboard, ${safeUserName}!</div>
          <p>Please verify your email address to activate your workspace and start your 14-day free trial.</p>
          <div style="text-align: center;">
            <a href="${safeLink}" class="btn" target="_blank">Verify Email Address</a>
          </div>
          <p style="font-size: 13px; color: #475569;">Or paste this link into your browser:<br><a href="${safeLink}" style="color: #4f46e5; word-break: break-all;">${safeLink}</a></p>
          <div class="footer">
            <p>This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const text = `Welcome to Localo, ${data.userName}!\n\nPlease verify your email address by visiting:\n${data.verificationLink}\n\nThis link will expire in 24 hours.`;
  return { subject, html, text };
}
