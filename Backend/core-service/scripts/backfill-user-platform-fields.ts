import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { User } from '../src/models/User';
import { WorkspaceMember } from '../src/models/WorkspaceMember';
import { Workspace } from '../src/models/Workspace';
import { Location } from '../src/models/Location';
import { normalizePlanName, PLAN_DEFAULTS } from '@localo/shared';

export async function backfillUserPlatformFields(): Promise<void> {
  console.log(`[Backfill Users] Connecting to database...`);
  await connectDatabase();

  try {
    const users = await User.find({});
    console.log(`[Backfill Users] Found ${users.length} total users to inspect.`);

    let updatedCount = 0;

    for (const user of users) {
      let needsUpdate = false;

      // 1. platformRole
      if (!user.platformRole) {
        user.platformRole = 'USER';
        needsUpdate = true;
      }

      // 2. planName
      if (!user.planName) {
        // Try to infer from active workspace membership
        const membership = await WorkspaceMember.findOne({ userId: user._id, role: 'owner' });
        let inferredPlan = 'Trial';
        if (membership) {
          const ws = await Workspace.findById(membership.workspaceId);
          if (ws?.plan?.key) {
            inferredPlan = normalizePlanName(ws.plan.key);
          }
        }
        user.planName = inferredPlan as any;
        user.planStartedAt = user.planStartedAt || user.createdAt || new Date();
        needsUpdate = true;
      }

      const planDef = PLAN_DEFAULTS[normalizePlanName(user.planName)] || PLAN_DEFAULTS['Trial'];

      // 3. mustChangePassword
      if (user.mustChangePassword === undefined || user.mustChangePassword === null) {
        user.mustChangePassword = false;
        needsUpdate = true;
      }

      // 4. usage counters
      if (!user.usage || !user.usage.usageResetAt) {
        let locCount = 0;
        try {
          locCount = await Location.countDocuments({
            createdByUserId: user._id.toString(),
            status: { $ne: 'DELETED' }
          });
        } catch {}

        user.usage = {
          keywordsScannedThisMonth: user.usage?.keywordsScannedThisMonth ?? 0,
          scanCreditsUsed: user.usage?.scanCreditsUsed ?? 0,
          chatbotUsed: user.usage?.chatbotUsed ?? 0,
          locationsCount: user.usage?.locationsCount ?? locCount,
          usageResetAt: user.usage?.usageResetAt ?? new Date()
        };
        needsUpdate = true;
      }

      // 5. permissions
      if (!user.permissions || user.permissions.canScan === undefined) {
        user.permissions = {
          canScan: user.permissions?.canScan ?? planDef.permissions.canScan,
          canUseChatbot: user.permissions?.canUseChatbot ?? planDef.permissions.canUseChatbot,
          canUseGeoGrid: user.permissions?.canUseGeoGrid ?? planDef.permissions.canUseGeoGrid,
          canUseCompetitorMatrix: user.permissions?.canUseCompetitorMatrix ?? planDef.permissions.canUseCompetitorMatrix,
          canExportPdf: user.permissions?.canExportPdf ?? planDef.permissions.canExportPdf,
          canInviteTeam: user.permissions?.canInviteTeam ?? planDef.permissions.canInviteTeam,
          canUseApi: user.permissions?.canUseApi ?? planDef.permissions.canUseApi
        };
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        updatedCount++;
      }
    }

    console.log(`✅ [Backfill Users] Successfully checked ${users.length} users; updated ${updatedCount} users.`);
  } catch (err: any) {
    console.error(`❌ [Backfill Users] Error:`, err.message || err);
    throw err;
  } finally {
    await disconnectDatabase();
    console.log(`[Backfill Users] Database disconnected.`);
  }
}

if (require.main === module) {
  backfillUserPlatformFields()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
