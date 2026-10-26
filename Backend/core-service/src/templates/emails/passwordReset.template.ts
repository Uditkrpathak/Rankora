import { escapeHtml } from './escapeHtml';

export interface PasswordResetData {
  userName: string;
  resetLink: string;
}

export function renderPasswordResetTemplate(data: PasswordResetData): { subject: string; html: string; text: string } {
  const safeUserName = escapeHtml(data.userName);
  const safeLink = escapeHtml(data.resetLink);
  const subject = 'Reset your Rankora account password';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .logo { font-size: 22px; font-weight: 800; color: #2E3192; margin-bottom: 24px; letter-spacing: -0.5px; }
          .heading { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
          .btn { display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff !important; padding: 13px 32px; font-weight: 600; font-size: 15px; border-radius: 10px; text-decoration: none; margin: 20px 0; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">⚡ Rankora</div>
          <div class="heading">Password Reset Request</div>
          <p>Hello ${safeUserName}, we received a request to reset your password. Click the button below to choose a new password.</p>
          <div style="text-align: center;">
            <a href="${safeLink}" class="btn" target="_blank">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #475569;">Or paste this link into your browser:<br><a href="${safeLink}" style="color: #dc2626; word-break: break-all;">${safeLink}</a></p>
          <div class="footer">
            <p><strong>This link is single-use and will expire in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const text = `Hello ${data.userName},\n\nWe received a password reset request for your Rankora account.\nReset your password here:\n${data.resetLink}\n\nThis link expires in 1 hour.`;
  return { subject, html, text };
}
