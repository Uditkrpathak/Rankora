export interface RankDropAlertData {
  businessName: string;
  keyword: string;
  previousRank: number;
  currentRank: number;
  dropCount: number;
  searchCity?: string;
  actionUrl: string;
}

export function renderRankDropAlertTemplate(data: RankDropAlertData): { subject: string; html: string; text: string } {
  const subject = `📉 Rank Alert: "${data.keyword}" dropped ${data.dropCount} positions for ${data.businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); color: #ffffff; padding: 24px 28px; }
          .brand { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 14px; opacity: 0.9; margin: 4px 0 0; }
          .content { padding: 28px; }
          .rank-card { display: flex; align-items: center; justify-content: space-around; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
          .rank-val { font-size: 28px; font-weight: 800; color: #0f172a; }
          .rank-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
          .rank-delta { font-size: 18px; font-weight: 700; color: #dc2626; }
          .keyword-pill { display: inline-block; background: #ede9fe; color: #5b21b6; padding: 6px 14px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
          .btn-container { text-align: center; margin: 28px 0 12px; }
          .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 13px 32px; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none; }
          .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">Rankora Keyword Tracking</div>
            <div class="title">📉 Local Rank Position Drop</div>
            <div class="subtitle">${data.businessName}</div>
          </div>
          <div class="content">
            <div class="keyword-pill">Keyword: "${data.keyword}"</div>
            ${data.searchCity ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Target Geo: <strong>${data.searchCity}</strong></div>` : ''}

            <div class="rank-card">
              <div>
                <div class="rank-val" style="color: #64748b;">#${data.previousRank}</div>
                <div class="rank-label">Previous</div>
              </div>
              <div class="rank-delta">
                → -${data.dropCount}
              </div>
              <div>
                <div class="rank-val" style="color: #dc2626;">#${data.currentRank}</div>
                <div class="rank-label">Current Rank</div>
              </div>
            </div>

            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              A ranking change of this size may indicate competitor movement, new local citations, or recent Google Local pack updates. Run a fresh audit on Rankora to identify what optimizations are needed.
            </p>

            <div class="btn-container">
              <a href="${data.actionUrl}" class="btn" target="_blank">View Heatmap & Geo-Grid Ranking →</a>
            </div>
          </div>
          <div class="footer">
            You received this notification because your keyword rank drop threshold is enabled in Rankora.
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Rank Drop Alert for ${data.businessName}\n\nKeyword: "${data.keyword}"\nPrevious: #${data.previousRank}\nCurrent: #${data.currentRank} (-${data.dropCount} positions)\n\nView details on Rankora:\n${data.actionUrl}`;

  return { subject, html, text };
}
