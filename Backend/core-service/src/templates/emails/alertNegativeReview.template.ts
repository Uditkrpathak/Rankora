export interface NegativeReviewAlertData {
  businessName: string;
  reviewerName: string;
  numericRating: number;
  reviewComment?: string;
  reviewDate?: string;
  actionUrl: string;
}

export function renderNegativeReviewAlertTemplate(data: NegativeReviewAlertData): { subject: string; html: string; text: string } {
  const stars = '★'.repeat(Math.max(1, Math.min(5, data.numericRating))) + '☆'.repeat(Math.max(0, 5 - data.numericRating));
  const reviewer = data.reviewerName || 'A customer';
  const comment = data.reviewComment ? `"${data.reviewComment}"` : '(No written comment provided)';
  const dateStr = data.reviewDate || 'Recently';

  const subject = `⚠️ Alert: New ${data.numericRating}★ Review for ${data.businessName} — Response Recommended`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .header { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #ffffff; padding: 24px 28px; }
          .brand { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 14px; opacity: 0.9; margin: 4px 0 0; }
          .content { padding: 28px; }
          .stars-box { font-size: 24px; color: #f59e0b; margin-bottom: 12px; letter-spacing: 2px; }
          .reviewer-info { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
          .date-info { font-size: 12px; color: #64748b; margin-bottom: 16px; }
          .quote-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 16px; color: #334155; font-size: 14px; line-height: 1.6; font-style: italic; }
          .impact-pill { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 16px; }
          .btn-container { text-align: center; margin: 28px 0 12px; }
          .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 13px 32px; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(79,70,229,0.25); }
          .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">Rankora Real-Time Alerts</div>
            <div class="title">⚠️ New Negative Review Detected</div>
            <div class="subtitle">${data.businessName}</div>
          </div>
          <div class="content">
            <div class="stars-box">${stars}</div>
            <div class="reviewer-info">${reviewer}</div>
            <div class="date-info">Published: ${dateStr}</div>
            <div class="quote-box">${comment}</div>
            <div class="impact-pill">Priority: Low Rating (${data.numericRating}/5 Stars)</div>
            <p style="font-size: 13px; color: #64748b; margin-top: 18px; line-height: 1.5;">
              Responding promptly to negative reviews within 24 hours significantly reduces public churn and boosts local SEO ranking signals.
            </p>
            <div class="btn-container">
              <a href="${data.actionUrl}" class="btn" target="_blank">Generate AI Response on Rankora →</a>
            </div>
          </div>
          <div class="footer">
            You received this notification because your negative review alert threshold is active on Rankora.
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `⚠️ New Negative Review Alert for ${data.businessName}\n\nRating: ${stars} (${data.numericRating}/5)\nReviewer: ${reviewer}\nDate: ${dateStr}\nReview: ${comment}\n\nRespond promptly to protect your local reputation:\n${data.actionUrl}`;

  return { subject, html, text };
}
