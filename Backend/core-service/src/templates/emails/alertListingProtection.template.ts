export interface ListingProtectionAlertData {
  businessName: string;
  incidentType: string;
  field: string;
  previousValue: string;
  currentValue: string;
  severity: 'CRITICAL' | 'WARNING';
  actionUrl: string;
  timestamp?: string;
}

export function renderListingProtectionAlertTemplate(data: ListingProtectionAlertData): { subject: string; html: string; text: string } {
  const isCritical = data.severity === 'CRITICAL';
  const bannerGradient = isCritical
    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
    : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
  const badgeBg = isCritical ? '#fee2e2' : '#fef3c7';
  const badgeColor = isCritical ? '#991b1b' : '#92400e';

  const subject = `🛡️ [${data.severity}] Google Maps Listing Change Detected — ${data.businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .header { background: ${bannerGradient}; color: #ffffff; padding: 24px 28px; }
          .brand { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 14px; opacity: 0.9; margin: 4px 0 0; }
          .content { padding: 28px; }
          .badge { display: inline-block; background: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
          .diff-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
          .diff-row { margin-bottom: 10px; }
          .diff-row:last-child { margin-bottom: 0; }
          .diff-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
          .val-old { color: #dc2626; text-decoration: line-through; background: #fee2e2; padding: 2px 6px; border-radius: 4px; display: inline-block; }
          .val-new { color: #16a34a; font-weight: 600; background: #dcfce7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; }
          .alert-explainer { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1e40af; margin-top: 20px; line-height: 1.5; }
          .btn-container { text-align: center; margin: 28px 0 12px; }
          .btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; padding: 13px 32px; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none; }
          .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">Rankora 24/7 Listing Protection</div>
            <div class="title">🛡️ Google Listing Drift / Sabotage Alert</div>
            <div class="subtitle">${data.businessName}</div>
          </div>
          <div class="content">
            <span class="badge">Severity: ${data.severity} (${data.incidentType})</span>
            <p style="font-size: 15px; margin: 0 0 14px; line-height: 1.5;">
              Rankora's watchdog detected an unverified change to your Google Business Profile on Google Maps. If this was not performed by your team, your listing may have been edited by a competitor or public suggestion.
            </p>

            <div class="diff-box">
              <div class="diff-row">
                <div class="diff-label">Target Field</div>
                <div style="font-weight: 700; color: #0f172a;">${data.field.toUpperCase()}</div>
              </div>
              <div class="diff-row">
                <div class="diff-label">Baseline (Expected Value)</div>
                <div class="val-old">${data.previousValue || '(None)'}</div>
              </div>
              <div class="diff-row">
                <div class="diff-label">Current Live Google Value</div>
                <div class="val-new">${data.currentValue || '(Missing / Blank)'}</div>
              </div>
            </div>

            <div class="alert-explainer">
              <strong>Why this matters:</strong> Unchecked phone or website edits on Google Maps divert calls, leads, and foot traffic away from your business.
            </div>

            <div class="btn-container">
              <a href="${data.actionUrl}" class="btn" target="_blank">Review & Restore Protection Baseline →</a>
            </div>
          </div>
          <div class="footer">
            24/7 Listing Protection Watchdog by Rankora. Real-time integrity surveillance.
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `[${data.severity}] Google Listing Change Detected for ${data.businessName}\n\nField: ${data.field}\nPrevious: ${data.previousValue}\nLive Google Value: ${data.currentValue}\n\nReview & revert this change on Rankora immediately:\n${data.actionUrl}`;

  return { subject, html, text };
}
