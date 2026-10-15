import mongoose from 'mongoose';
import { ReviewDrip, ReviewDripDocument, IDripContact } from '../../models/ReviewDrip';
import { Location } from '../../models/Location';
import { ENV } from '../../config/env';

const TEMPLATE_VARS = (tpl: string, vars: Record<string, string>): string => {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
};

/**
 * Production review-request drip campaign service.
 * Uses Resend API for email. SMS via Twilio only if TWILIO_ACCOUNT_SID is configured.
 * No GBP API, no mocks, no seeds.
 */
export class ReviewDripService {
  // ─── CRUD ──────────────────────────────────────────────────────────────────

  public async upsertCampaign(
    workspaceId: string,
    locationId: string,
    update: Partial<ReviewDripDocument>
  ): Promise<ReviewDripDocument> {
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null }).select('name placeId');
    if (!location) throw Object.assign(new Error('Location not found.'), { statusCode: 404 });

    // Build a sensible default review link if not provided
    const defaultReviewLink = location.placeId
      ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(location.placeId)}`
      : `https://maps.google.com/search/${encodeURIComponent(location.name)}`;

    const doc = await ReviewDrip.findOneAndUpdate(
      { workspaceId, locationId },
      {
        $set: {
          ...update,
          workspaceId,
          locationId,
          reviewLink: update.reviewLink || defaultReviewLink,
        },
      },
      { upsert: true, new: true }
    );

    return doc!;
  }

  public async getCampaign(workspaceId: string, locationId: string): Promise<ReviewDripDocument | null> {
    return ReviewDrip.findOne({ workspaceId, locationId });
  }

  // ─── Contact Management ────────────────────────────────────────────────────

  public async addContacts(
    workspaceId: string,
    locationId: string,
    contacts: Array<{ name: string; email?: string; phone?: string }>
  ): Promise<ReviewDripDocument> {
    const campaign = await this.getCampaign(workspaceId, locationId);
    if (!campaign) {
      throw Object.assign(new Error('No campaign found. Create a campaign first.'), { statusCode: 404 });
    }

    const newContacts: IDripContact[] = contacts.map((c) => ({
      name: c.name.trim(),
      email: c.email?.trim().toLowerCase(),
      phone: c.phone?.trim(),
      addedAt: new Date().toISOString(),
    }));

    // Filter duplicates by email / phone
    const existingEmails = new Set(campaign.contacts.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(campaign.contacts.map((c) => c.phone).filter(Boolean));

    const toAdd = newContacts.filter(
      (c) =>
        (!c.email || !existingEmails.has(c.email)) &&
        (!c.phone || !existingPhones.has(c.phone))
    );

    if (toAdd.length === 0) {
      throw Object.assign(new Error('All provided contacts are already enrolled.'), { statusCode: 409 });
    }

    const updated = await ReviewDrip.findByIdAndUpdate(
      campaign._id,
      { $push: { contacts: { $each: toAdd } } },
      { new: true }
    );

    return updated!;
  }

  public async markReviewed(workspaceId: string, locationId: string, contactId: string): Promise<void> {
    await ReviewDrip.updateOne(
      { workspaceId, locationId, 'contacts._id': new mongoose.Types.ObjectId(contactId) },
      { $set: { 'contacts.$.reviewedAt': new Date().toISOString() } }
    );
  }

  public async optOutContact(workspaceId: string, locationId: string, contactId: string): Promise<void> {
    await ReviewDrip.updateOne(
      { workspaceId, locationId, 'contacts._id': new mongoose.Types.ObjectId(contactId) },
      { $set: { 'contacts.$.optedOutAt': new Date().toISOString() } }
    );
  }

  // ─── Drip Processor ───────────────────────────────────────────────────────

  /**
   * Processes all due drip steps across all campaigns in a workspace.
   * Called from a BullMQ cron-style job every hour.
   */
  public async processDueSteps(workspaceId?: string): Promise<{ processed: number; sent: number }> {
    const query = workspaceId ? { workspaceId, enabled: true } : { enabled: true };
    const campaigns = await ReviewDrip.find(query);

    let processed = 0;
    let sent = 0;

    for (const campaign of campaigns) {
      const location = await Location.findOne({ _id: campaign.locationId, workspaceId: campaign.workspaceId, deletedAt: null }).select('name');
      if (!location) continue;

      const templateVars: Record<string, string> = {
        businessName: location.name,
        reviewLink: campaign.reviewLink,
      };

      let updated = false;
      const contacts = campaign.contacts as any[];

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        if (contact.optedOutAt || contact.reviewedAt) continue;

        const addedAt = new Date(contact.addedAt).getTime();
        const nowMs = Date.now();

        // Step 1: Initial request
        if (!contact.step1SentAt) {
          const dueAt = addedAt + campaign.step1DelayHours * 60 * 60 * 1000;
          if (nowMs >= dueAt) {
            const vars = { ...templateVars, name: contact.name };
            const subject = TEMPLATE_VARS(campaign.step1SubjectTemplate, vars);
            const body = TEMPLATE_VARS(campaign.step1BodyTemplate, vars);
            const success = await this.sendEmail(contact.email, subject, body);
            if (success) {
              contacts[i] = { ...contact, step1SentAt: new Date().toISOString() };
              updated = true;
              sent++;
            }
          }
        }
        // Step 2: Follow-up reminder (only after step 1 was sent and no review yet)
        else if (!contact.step2SentAt) {
          const step1SentAt = new Date(contact.step1SentAt).getTime();
          const dueAt = step1SentAt + campaign.step2DelayHours * 60 * 60 * 1000;
          if (nowMs >= dueAt) {
            const vars = { ...templateVars, name: contact.name };
            const subject = TEMPLATE_VARS(campaign.step2SubjectTemplate, vars);
            const body = TEMPLATE_VARS(campaign.step2BodyTemplate, vars);
            const success = await this.sendEmail(contact.email, subject, body);
            if (success) {
              contacts[i] = { ...contact, step2SentAt: new Date().toISOString() };
              updated = true;
              sent++;
            }
          }
        }

        processed++;
      }

      if (updated) {
        await ReviewDrip.findByIdAndUpdate(campaign._id, {
          $set: { contacts, totalSent: contacts.filter((c: any) => c.step1SentAt).length },
        });
      }
    }

    return { processed, sent };
  }

  // ─── Immediate send for a specific contact ────────────────────────────────

  public async sendTestEmail(
    workspaceId: string,
    locationId: string,
    contactEmail: string,
    contactName: string
  ): Promise<{ sent: boolean }> {
    const campaign = await ReviewDrip.findOne({ workspaceId, locationId });
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null }).select('name');
    if (!campaign || !location) return { sent: false };

    const vars = {
      name: contactName,
      businessName: location.name,
      reviewLink: campaign.reviewLink,
    };
    const subject = TEMPLATE_VARS(campaign.step1SubjectTemplate, vars);
    const body = TEMPLATE_VARS(campaign.step1BodyTemplate, vars);
    const sent = await this.sendEmail(contactEmail, subject, body);
    return { sent };
  }

  // ─── Email via Resend ─────────────────────────────────────────────────────

  private async sendEmail(to: string | undefined, subject: string, body: string): Promise<boolean> {
    if (!to) return false;
    const resendKey = ENV.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('[ReviewDrip] RESEND_API_KEY not configured — email skipped.');
      return false;
    }

    // Convert plain text body to basic HTML
    const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 30px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 520px; margin: 0 auto; padding: 28px; }
  .btn { display: inline-block; margin-top: 20px; background: #3b82f6; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; }
  p { color: #334155; line-height: 1.7; font-size: 14px; }
  .footer { margin-top: 20px; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
</style></head>
<body><div class="card">
${body
  .split('\n')
  .map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('http')) {
      return `<a href="${trimmed}" class="btn">Leave a Review ⭐</a>`;
    }
    return trimmed ? `<p>${trimmed}</p>` : '';
  })
  .join('\n')}
<div class="footer">You received this because you are a valued customer. <a href="${ENV.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(to)}">Unsubscribe</a></div>
</div></body></html>`;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: ENV.EMAIL_FROM,
          to: [to],
          subject,
          html: htmlBody,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.warn('[ReviewDrip] Email failed:', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[ReviewDrip] Email send error:', err?.message);
      return false;
    }
  }
}

export const reviewDripService = new ReviewDripService();
