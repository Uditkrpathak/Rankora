// Backend/core-service/src/events/admin-alert.service.ts
import { ENV } from '../config/env';

export interface AdminAlertPayload {
  event: 'PROVIDER_BILLING_ERROR' | 'PROVIDER_AUTH_ERROR' | 'CIRCUIT_BREAKER_OPEN' | 'SPEND_CAP_REACHED' | 'SYSTEM_ERROR' | 'SCAN_DLQ_FAILURE' | string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export class AdminAlertService {
  public static async notify(alert: AdminAlertPayload): Promise<void> {
    const timestamp = alert.timestamp || new Date();
    const payload = {
      event: alert.event,
      severity: alert.severity,
      message: alert.message,
      environment: process.env.NODE_ENV || 'development',
      timestamp: timestamp.toISOString(),
      metadata: alert.metadata || {},
    };

    // 1. Structured logging (always active)
    console.error(`🚨 [ADMIN ALERT | ${alert.severity}] [${alert.event}]: ${alert.message}`, alert.metadata ? JSON.stringify(alert.metadata) : '');

    // 2. Webhook Dispatch (Slack / Discord / PagerDuty / Webhook)
    const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.ADMIN_ALERT_WEBHOOK_URL || process.env.SLACK_ALERT_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *[${alert.severity}] ${alert.event}*\n>${alert.message}\n\`\`\`json\n${JSON.stringify(payload.metadata, null, 2)}\n\`\`\``,
            ...payload,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err: any) {
        console.warn('[Admin Alert] Failed to dispatch webhook alert:', err?.message || err);
      }
    }

    // 3. Email Alert (via Resend if configured)
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY || ENV.RESEND_API_KEY;
    if (adminEmail && resendApiKey) {
      try {
        const { enqueueEmail } = await import('../jobs/email.queue');
        await enqueueEmail({
          to: adminEmail,
          template: 'SECURITY_ALERT',
          data: {
            title: `🚨 [${alert.severity}] ${alert.event}`,
            message: alert.message,
            payloadJson: JSON.stringify(payload, null, 2),
          },
          idempotencyKey: `alert_${alert.event}_${Math.floor(Date.now() / 60000)}`,
        });
      } catch (emailErr) {
        console.warn('[Admin Alert] Failed to enqueue alert email:', emailErr);
      }
    }
  }
}
