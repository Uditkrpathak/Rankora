export interface GeneralAlertData {
  title: string;
  message: string;
  badge?: string;
  details?: Record<string, string>;
  actionUrl?: string;
  actionLabel?: string;
}

export function renderGeneralAlertTemplate(data: GeneralAlertData): { subject: string; html: string; text: string } {
  const subject = `🔔 ${data.title} — Rankora Notification`;

  const detailsHtml = data.details
    ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        ${Object.entries(data.details)
          .map(
            ([key, val]) =>
              `<div style="font-size: 13px; margin-bottom: 6px;"><strong style="color: #475569;">${key}:</strong> <span style="color: #0f172a;">${val}</span></div>`
          )
          .join('')}
       </div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 24px 28px; }
          .brand { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; }
          .content { padding: 28px; }
          .msg { font-size: 15px; line-height: 1.6; color: #334155; }
          .btn-container { text-align: center; margin: 28px 0 12px; }
          .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 13px 32px; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none; }
          .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">Rankora Notifications</div>
            <div class="title">${data.title}</div>
          </div>
          <div class="content">
            <p class="msg">${data.message}</p>
            ${detailsHtml}
            ${
              data.actionUrl
                ? `<div class="btn-container">
                    <a href="${data.actionUrl}" class="btn" target="_blank">${data.actionLabel || 'View on Rankora →'}</a>
                   </div>`
                : ''
            }
          </div>
          <div class="footer">
            You received this notification from your Rankora workspace.
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `${data.title}\n\n${data.message}\n\n${data.actionUrl ? `Visit: ${data.actionUrl}` : ''}`;

  return { subject, html, text };
}
