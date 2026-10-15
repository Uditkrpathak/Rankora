import dotenv from 'dotenv';
dotenv.config();

import * as argon2 from 'argon2';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { User } from '../src/models/User';
import { AuditLog } from '../src/models/AuditLog';
import { ARGON2_CONFIG } from '@localo/shared';

export async function seedSuperAdmin(): Promise<void> {
  const rawEmail = process.env.SUPER_ADMIN_EMAIL;
  const rawPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!rawEmail || !rawEmail.trim() || !rawPassword || !rawPassword.trim()) {
    console.error('❌ [Seed SuperAdmin] ERROR: Both SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables are strictly required.');
    process.exit(1);
  }

  const email = rawEmail.toLowerCase().trim();
  const password = rawPassword.trim();
  const name = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

  console.log(`[Seed SuperAdmin] Connecting to database...`);
  await connectDatabase();

  try {
    const existingUser = await User.findOne({ email });

    const passwordHash = await argon2.hash(password, {
      memoryCost: ARGON2_CONFIG.memoryCost,
      timeCost: ARGON2_CONFIG.timeCost,
      parallelism: ARGON2_CONFIG.parallelism,
      type: argon2.argon2id
    });

    if (existingUser) {
      console.log(`[Seed SuperAdmin] User with email ${email} exists. Elevating to SUPER_ADMIN...`);
      existingUser.platformRole = 'SUPER_ADMIN';
      existingUser.status = 'ACTIVE';
      existingUser.isEmailVerified = true;
      existingUser.mustChangePassword = false;
      existingUser.planName = 'Agency Scale';
      existingUser.passwordHash = passwordHash;
      existingUser.permissions = {
        canScan: true,
        canUseChatbot: true,
        canUseGeoGrid: true,
        canUseCompetitorMatrix: true,
        canExportPdf: true,
        canInviteTeam: true,
        canUseApi: true
      };

      await existingUser.save();

      await AuditLog.create({
        actorUserId: existingUser._id.toString(),
        actorRole: 'SUPER_ADMIN',
        targetUserId: existingUser._id.toString(),
        action: 'SUPER_ADMIN_SEEDED_UPDATE',
        after: { email, platformRole: 'SUPER_ADMIN' }
      });

      console.log(`✅ [Seed SuperAdmin] Existing user ${email} successfully promoted to SUPER_ADMIN.`);
    } else {
      console.log(`[Seed SuperAdmin] Creating new SUPER_ADMIN user: ${email}...`);
      const superAdmin = await User.create({
        name,
        email,
        passwordHash,
        platformRole: 'SUPER_ADMIN',
        mustChangePassword: false,
        status: 'ACTIVE',
        isEmailVerified: true,
        planName: 'Agency Scale',
        planStartedAt: new Date(),
        usage: {
          keywordsScannedThisMonth: 0,
          scanCreditsUsed: 0,
          chatbotUsed: 0,
          locationsCount: 0,
          usageResetAt: new Date()
        },
        permissions: {
          canScan: true,
          canUseChatbot: true,
          canUseGeoGrid: true,
          canUseCompetitorMatrix: true,
          canExportPdf: true,
          canInviteTeam: true,
          canUseApi: true
        }
      });

      await AuditLog.create({
        actorUserId: superAdmin._id.toString(),
        actorRole: 'SUPER_ADMIN',
        targetUserId: superAdmin._id.toString(),
        action: 'SUPER_ADMIN_SEEDED_CREATE',
        after: { email: superAdmin.email, platformRole: 'SUPER_ADMIN' }
      });

      console.log(`✅ [Seed SuperAdmin] New SUPER_ADMIN created successfully: ${email}`);
    }
  } catch (err: any) {
    console.error(`❌ [Seed SuperAdmin] Failed:`, err.message || err);
    throw err;
  } finally {
    await disconnectDatabase();
    console.log(`[Seed SuperAdmin] Database disconnected.`);
  }
}

if (require.main === module) {
  seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
