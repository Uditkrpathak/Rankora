import { Worker, Job } from 'bullmq';
import { EmailJobPayload } from '@localo/types';
import { redisBullOptions } from './email.queue';
import { redisClient } from '../config/redis';
import { emailProvider } from '../providers/email.provider';
import { User } from '../models/User';
import { queueFailedJobs } from '../monitoring/metrics';

let emailWorker: Worker<EmailJobPayload> | null = null;

export function startEmailWorker(): Worker<EmailJobPayload> | null {
  if (emailWorker) return emailWorker;
  if (redisClient.status !== 'ready') {
    console.warn('[Email Worker] Redis is not ready; email queue worker was not started.');
    return null;
  }
  try {
    emailWorker = new Worker<EmailJobPayload>(
      'email-queue',
      async (job: Job<EmailJobPayload>) => {
        const { to, template, data, idempotencyKey, userId } = job.data;

        // Check if recipient is suppressed due to previous bounces
        if (userId) {
          const user = await User.findById(userId).lean();
          if (user?.emailSuppressed) {
            console.warn(`🛑 Skipping email to ${to}: address is marked suppressed due to previous bounce/complaint.`);
            return { skipped: true, reason: 'SUPPRESSED' };
          }
        }

        switch (template) {
          case 'VERIFY_EMAIL':
            await emailProvider.sendVerificationEmail(to, data.userName, data.verificationLink, idempotencyKey);
            break;
          case 'PASSWORD_RESET':
            await emailProvider.sendPasswordResetEmail(to, data.userName, data.resetLink, idempotencyKey);
            break;
          case 'WORKSPACE_INVITE':
            await emailProvider.sendWorkspaceInviteEmail(to, data.inviterName, data.workspaceName, data.role, data.inviteLink, idempotencyKey);
            break;
          case 'SECURITY_ALERT':
            await emailProvider.sendSecurityAlert(to, data.userName, data.action, data.details, idempotencyKey);
            break;
          default:
            console.error(`Unknown email template: ${template}`);
        }

        return { sent: true };
      },
      redisBullOptions
    );

    emailWorker.on('completed', (job) => {
      console.log(`✅ [Email Worker] Dispatched ${job.data.template} (job ${job.id})`);
    });

    emailWorker.on('failed', (job, err) => {
      queueFailedJobs.inc({ queue: 'email' });
      console.error(`❌ [Email Worker] Job ${job?.id} failed:`, err.message);
    });

    emailWorker.on('error', (err) => {
      console.error('[Email Worker] Redis queue error:', err.message);
    });

    return emailWorker;
  } catch (err: any) {
    console.warn('⚠️ Could not start BullMQ email worker (Redis might be offline):', err.message);
    return null;
  }
}

export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
}
