import { Audit } from '../models/Audit';
import { auditService } from '../modules/audits/audit.service';

/**
 * Fired when a location is created or imported from GBP.
 * Automatically runs the 17-point SEO audit with a 5-minute idempotency guard.
 */
export async function onLocationConnected(
  locationId: string,
  workspaceId: string,
  actorUserId?: string
): Promise<void> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingRecentAudit = await Audit.findOne({
      locationId,
      createdAt: { $gt: fiveMinutesAgo },
    });

    if (existingRecentAudit) {
      console.log(`[Auto-Audit Hook] Skipping duplicate audit for location ${locationId} (already ran within 5m)`);
      return;
    }

    console.log(`🚀 [Auto-Audit Hook] Auto-triggering 17-Point Audit for newly connected location: ${locationId}`);
    
    const audit = await auditService.runAudit(
      locationId,
      workspaceId
    );
    console.log(`✅ [Auto-Audit Hook] Auto-audit completed for location: ${locationId}`);

    try {
      const { notificationService } = await import('../modules/notifications/notification.service');
      const { Location } = await import('../models/Location');
      const location = await Location.findById(locationId).select('name');
      const locName = location?.name || 'Business Location';

      await notificationService.createNotification({
        workspaceId,
        userId: actorUserId,
        type: 'AUDIT_COMPLETED',
        severity: (audit?.score || 100) < 50 ? 'WARNING' : 'INFO',
        title: `SEO Audit Completed: ${locName}`,
        message: `17-point SEO audit completed with an audit score of ${audit?.score ?? 0}/100.`,
        link: `/locations/${locationId}/profile`,
        metadata: {
          locationId,
          score: audit?.score,
          rulesVersion: audit?.rulesVersion,
        },
      });
    } catch (notifErr: any) {
      console.warn(`[Auto-Audit Hook] Audit notification failed:`, notifErr?.message || notifErr);
    }
  } catch (err: any) {
    console.error(`[Auto-Audit Hook Error]`, err.message);
  }
}
