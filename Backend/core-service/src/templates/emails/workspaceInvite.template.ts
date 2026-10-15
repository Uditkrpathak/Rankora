import { escapeHtml } from './escapeHtml';

export interface WorkspaceInviteData {
  inviterName: string;
  workspaceName: string;
  role: string;
  inviteLink: string;
}

export function renderWorkspaceInviteTemplate(data: WorkspaceInviteData): { subject: string; html: string; text: string } {
  const safeInviter = escapeHtml(data.inviterName);
  const safeWorkspace = escapeHtml(data.workspaceName);
  const safeRole = escapeHtml(data.role);
  const safeLink = escapeHtml(data.inviteLink);

  const subject = `You've been invited to join ${data.workspaceName} on Localo`;
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
          <div class="heading">You're Invited!</div>
          <p><strong>${safeInviter}</strong> has invited you to collaborate on <strong>${safeWorkspace}</strong> as a <strong>${safeRole}</strong>.</p>
          <div style="text-align: center;">
            <a href="${safeLink}" class="btn" target="_blank">Accept Invitation</a>
          </div>
          <p style="font-size: 13px; color: #475569;">Or paste this link into your browser:<br><a href="${safeLink}" style="color: #4f46e5; word-break: break-all;">${safeLink}</a></p>
          <div class="footer">
            <p>This invitation will expire in 7 days.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const text = `${data.inviterName} has invited you to join ${data.workspaceName} on Localo as a ${data.role}.\n\nAccept here:\n${data.inviteLink}\n\nExpires in 7 days.`;
  return { subject, html, text };
}
