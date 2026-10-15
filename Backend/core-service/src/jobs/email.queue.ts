import { Queue } from 'bullmq';
import { EmailJobPayload } from '@localo/types';
import { ENV } from '../config/env';

// Connection details for BullMQ
export const redisBullOptions = {
  connection: {
    url: ENV.REDIS_URL,
    maxRetriesPerRequest: null
  }
};

let emailQueue: Queue<EmailJobPayload> | null = null;

function getEmailQueue(): Queue<EmailJobPayload> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobPayload>('email-queue', redisBullOptions);
    emailQueue.on('error', (err) => {
      console.error('[Email Queue] Redis error:', err.message);
    });
  }
  return emailQueue;
}

export async function enqueueEmail(payload: EmailJobPayload): Promise<void> {
  const { redisClient } = await import('../config/redis');

  if (redisClient.status === 'ready') {
    try {
      await getEmailQueue().add('send-email', payload, {
        jobId: payload.idempotencyKey ? payload.idempotencyKey.replace(/:/g, '-') : undefined, // Guarantees BullMQ idempotency
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: {
          count: 1000,
          age: 7 * 24 * 3600,
        }
      });
      return;
    } catch (err: any) {
      console.warn(`⚠️ Could not enqueue to Redis. Sending directly via provider:`, err.message);
    }
  }

  // Direct fallback if Redis is unavailable in dev
  try {
    const { emailProvider } = await import('../providers/email.provider');
    if (payload.template === 'VERIFY_EMAIL') {
      await emailProvider.sendVerificationEmail(payload.to, payload.data.userName, payload.data.verificationLink, payload.idempotencyKey);
    } else if (payload.template === 'PASSWORD_RESET') {
      await emailProvider.sendPasswordResetEmail(payload.to, payload.data.userName, payload.data.resetLink, payload.idempotencyKey);
    } else if (payload.template === 'WORKSPACE_INVITE') {
      await emailProvider.sendWorkspaceInviteEmail(payload.to, payload.data.inviterName, payload.data.workspaceName, payload.data.role, payload.data.inviteLink, payload.idempotencyKey);
    } else if (payload.template === 'SECURITY_ALERT') {
      await emailProvider.sendSecurityAlert(payload.to, payload.data.userName, payload.data.action, payload.data.details, payload.idempotencyKey);
    }
  } catch (err: any) {
    console.warn(`[Email Delivery Warning] Could not deliver ${payload.template}:`, err?.message || err);
  }
}
