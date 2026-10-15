import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { ResendWebhookEvent } from '@localo/types';
import { ENV } from '../../config/env';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';

export async function handleResendWebhook(req: Request, res: Response): Promise<void> {
  const secret = ENV.RESEND_WEBHOOK_SECRET;

  // If in production, require real signature verification via Svix
  if (ENV.NODE_ENV === 'production' && secret) {
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).json({ success: false, error: 'Missing Svix signature headers' });
      return;
    }

    const wh = new Webhook(secret);
    try {
      // Must use raw body for signature verification
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature
      });
    } catch (err: any) {
      console.error('❌ Resend Webhook Signature Verification Failed:', err.message);
      res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }
  }

  const event = req.body as ResendWebhookEvent;
  if (!event || !event.type) {
    res.status(400).json({ success: false, error: 'Malformed webhook event' });
    return;
  }

  const recipients = event.data?.to || [];

  switch (event.type) {
    case 'email.bounced':
      console.warn(`🛑 [Resend Bounce Event] Email bounced for: ${recipients.join(', ')}`);
      for (const email of recipients) {
        await User.updateMany({ email: email.toLowerCase() }, { emailSuppressed: true });
        await AuditLog.create({
          actorUserId: 'SYSTEM_RESEND_WEBHOOK',
          action: 'EMAIL_BOUNCE_SUPPRESSED',
          resourceType: 'User',
          resourceId: email,
          after: { eventType: event.type, emailId: event.data.email_id }
        });
      }
      break;

    case 'email.complained':
      console.warn(`🛑 [Resend Complaint Event] Spam complaint recorded for: ${recipients.join(', ')}`);
      for (const email of recipients) {
        await User.updateMany({ email: email.toLowerCase() }, { emailSuppressed: true });
        await AuditLog.create({
          actorUserId: 'SYSTEM_RESEND_WEBHOOK',
          action: 'EMAIL_COMPLAINT_SUPPRESSED',
          resourceType: 'User',
          resourceId: email,
          after: { eventType: event.type, emailId: event.data.email_id }
        });
      }
      break;

    case 'email.delivered':
      console.log(`📨 [Resend Delivered] Email ${event.data.email_id} successfully reached: ${recipients.join(', ')}`);
      break;

    default:
      // Other events like email.opened, clicked
      break;
  }

  res.status(200).json({ success: true, received: true });
}
