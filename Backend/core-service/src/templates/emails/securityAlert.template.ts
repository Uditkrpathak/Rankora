import { escapeHtml } from './escapeHtml';

export interface SecurityAlertData {
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export function renderSecurityAlertTemplate(data: SecurityAlertData): { subject: string; html: string; text: string } {
  const safeUserName = escapeHtml(data.userName);
  const safeAction = escapeHtml(data.action);
  const safeDetails = escapeHtml(data.details);
  const safeTimestamp = escapeHtml(data.timestamp);

  const subject = `Security Notice: ${data.action} on your Localo account`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .logo { font-size: 22px; font-weight: 700; color: #4338ca; margin-bottom: 24px; letter-spacing: -0.5px; }
          .heading { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
          .box { background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">📍 Localo</div>
          <div class="heading">Security Alert: ${safeAction}</div>
          <p>Hello ${safeUserName}, we noticed security activity on your Localo account:</p>
          <div class="box">
            <strong>Activity:</strong> ${safeAction}<br>
            <strong>Details:</strong> ${safeDetails}<br>
            <strong>Time:</strong> ${safeTimestamp}
          </div>
          <p>If you authorized this action, no further steps are necessary. If you did not authorize this, please immediately reset your password and revoke active sessions.</p>
          <div class="footer">
            <p>Localo Security Team</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const text = `Security Alert: ${data.action}\n\nHello ${data.userName},\nActivity: ${data.action}\nDetails: ${data.details}\nTime: ${data.timestamp}\n\nIf you did not authorize this, please reset your password immediately.`;
  return { subject, html, text };
}
