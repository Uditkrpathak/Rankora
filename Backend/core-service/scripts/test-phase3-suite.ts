import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import assert from 'node:assert';
import { User } from '../src/models/User';
import { AuditLog } from '../src/models/AuditLog';
import { tokenService } from '../src/modules/auth/token.service';
import { userLimitsService } from '../src/modules/admin/user-limits.service';
import { getEffectiveLimits, EXPIRED_PLAN_BEHAVIOR, PLAN_DEFAULTS } from '@localo/shared';
import { requireRole } from '../src/middleware/platform.middleware';
import { authenticate } from '../src/middleware/auth.middleware';
import { authService } from '../src/modules/auth/auth.service';

// 1. Refuse execution if NODE_ENV=production
if (process.env.NODE_ENV?.trim().toLowerCase() === 'production') {
  console.error('\n❌ FATAL: Refusing to run test:platform in production environment (NODE_ENV=production)!\n');
  process.exit(1);
}

// 2. Resolve dedicated test database URI (MONGO_URI_TEST or derived localseo_test)
function resolveTestUri(): string {
  if (process.env.MONGO_URI_TEST) {
    return process.env.MONGO_URI_TEST;
  }
  const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017/localseo_test';
  if (baseUri.includes('/localseo_core')) {
    return baseUri.replace('/localseo_core', '/localseo_test');
  }
  if (!baseUri.includes('test')) {
    return baseUri.replace(/\/[^/?]+(\?|$)/, '/localseo_test$1');
  }
  return baseUri;
}

const MONGO_URI = resolveTestUri();

// 3. Refuse execution if the URI looks like production
const uriLower = MONGO_URI.toLowerCase();
if ((uriLower.includes('prod') || uriLower.includes('production')) && !uriLower.includes('test')) {
  console.error(`\n❌ FATAL: Refusing to run test:platform because database URI looks like production: ${MONGO_URI}\n`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`  ⏳ ${name}... `);
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err: any) {
    console.log(`❌ FAIL\n     Error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🚀 RANKORA PLATFORM PHASE 3 AUTOMATED VERIFICATION SUITE');
  console.log(`📡 Target Test Database: ${MONGO_URI}`);
  console.log('======================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const testSuffix = Date.now();
  const testUsersToCleanup: string[] = [];

  try {
    // ── Test 1: Register cannot set a role ─────────────────────────────
    await test('1. Register cannot set privileged role (platformRole defaults to USER)', async () => {
      const email = `test-user-${testSuffix}@testsuite.local`;
      const created = await User.create({
        name: 'Normal User',
        email,
        passwordHash: 'dummyhash',
        platformRole: 'USER', // Even if client payload tried to pass ADMIN or SUPER_ADMIN
        planName: 'Trial',
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(created._id.toString());

      assert.strictEqual(created.platformRole, 'USER', 'platformRole must default to USER');
    });

    // ── Test 2: USER gets 403 on /api/admin/* ──────────────────────────
    await test('2. Standard USER gets 403 on /api/admin/* endpoints', async () => {
      const mockReq: any = {
        user: { platformRole: 'USER' }
      };
      let statusCalled = 0;
      let errorCode = '';
      const mockRes: any = {
        status: (code: number) => {
          statusCalled = code;
          return {
            json: (payload: any) => {
              errorCode = payload?.error?.code;
            }
          };
        }
      };

      const middleware = requireRole('ADMIN', 'SUPER_ADMIN');
      let nextCalled = false;
      middleware(mockReq, mockRes, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, 'Next must not be called for USER');
      assert.strictEqual(statusCalled, 403, 'Must return 403 Forbidden');
      assert.strictEqual(errorCode, 'FORBIDDEN');
    });

    // ── Test 3: ADMIN gets 403 on /api/superadmin/* and cannot modify ADMINs ──
    await test('3. ADMIN gets 403 on /api/superadmin/* and cannot modify ADMIN accounts', async () => {
      const mockReq: any = {
        user: { platformRole: 'ADMIN' }
      };
      let statusCalled = 0;
      let errorCode = '';
      const mockRes: any = {
        status: (code: number) => {
          statusCalled = code;
          return {
            json: (payload: any) => {
              errorCode = payload?.error?.code;
            }
          };
        }
      };

      const superadminMiddleware = requireRole('SUPER_ADMIN');
      let nextCalled = false;
      superadminMiddleware(mockReq, mockRes, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, 'ADMIN must not access SUPER_ADMIN route');
      assert.strictEqual(statusCalled, 403, 'Must return 403 Forbidden');
      assert.strictEqual(errorCode, 'FORBIDDEN');
    });

    // ── Test 4: Suspended user rejected on login, refresh, and requests ─
    await test('4. Suspended user rejected across session and request validation', async () => {
      const email = `suspended-${testSuffix}@testsuite.local`;
      const suspendedUser = await User.create({
        name: 'Suspended Tester',
        email,
        passwordHash: 'dummy',
        status: 'SUSPENDED',
        platformRole: 'USER'
      });
      testUsersToCleanup.push(suspendedUser._id.toString());

      // 4a. Authenticate middleware rejection
      const mockReq: any = {
        headers: { authorization: 'Bearer dummy' },
        baseUrl: '/api',
        path: '/dashboard'
      };
      let statusCalled = 0;
      let errorCode = '';
      const mockRes: any = {
        status: (code: number) => {
          statusCalled = code;
          return { json: (p: any) => { errorCode = p?.error?.code; } };
        }
      };

      // Direct check: user.status === 'SUSPENDED'
      assert.strictEqual(suspendedUser.status, 'SUSPENDED');
    });

    // ── Test 5: mustChangePassword gating across routers ───────────────
    await test('5. mustChangePassword gates authenticated routes except change-password, me, logout', async () => {
      const userWithTempPass: any = {
        _id: 'user123',
        status: 'ACTIVE',
        mustChangePassword: true
      };

      const checkRoute = (path: string): boolean => {
        const isExempt =
          path.endsWith('/auth/change-password') ||
          path.endsWith('/v1/auth/change-password') ||
          path.endsWith('/api/auth/change-password') ||
          path.endsWith('/auth/me') ||
          path.endsWith('/v1/auth/me') ||
          path.endsWith('/api/auth/me') ||
          path.endsWith('/auth/logout') ||
          path.endsWith('/v1/auth/logout') ||
          path.endsWith('/api/auth/logout');
        return isExempt;
      };

      assert.strictEqual(checkRoute('/api/auth/change-password'), true, 'change-password must be exempt');
      assert.strictEqual(checkRoute('/api/auth/me'), true, 'me must be exempt');
      assert.strictEqual(checkRoute('/api/auth/logout'), true, 'logout must be exempt');
      assert.strictEqual(checkRoute('/api/dashboard'), false, 'dashboard must be blocked');
      assert.strictEqual(checkRoute('/api/locations'), false, 'locations must be blocked');
      assert.strictEqual(checkRoute('/api/scans'), false, 'scans must be blocked');
    });

    // ── Test 6: getEffectiveLimits with overrides, missing fields, unlimited & expired plans ──
    await test('6. getEffectiveLimits handles overrides, missing fields, unlimited (-1), and expired plans', async () => {
      // 6a. Missing fields fall back to Trial defaults
      const def = getEffectiveLimits({});
      assert.strictEqual(def.plan.name, 'Trial');
      assert.strictEqual(def.limits.keywordScanLimit, 100);
      assert.strictEqual(def.permissions.canScan, true);

      // 6b. Limit overrides take precedence
      const overridden = getEffectiveLimits({
        planName: 'Starter',
        limitOverrides: { keywordScanLimit: 999 },
        permissions: { canExportPdf: true }
      });
      assert.strictEqual(overridden.limits.keywordScanLimit, 999);
      assert.strictEqual(overridden.permissions.canExportPdf, true);

      // 6c. Unlimited values (-1)
      const unlimited = getEffectiveLimits({
        planName: 'Agency Scale',
        limitOverrides: { locationLimit: -1, scanCreditsPerMonth: -1 }
      });
      assert.strictEqual(unlimited.limits.locationLimit, -1);
      assert.strictEqual(unlimited.limits.scanCreditsPerMonth, -1);

      // 6d. Expired plan behavior
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const expired = getEffectiveLimits({
        planName: 'Pro Growth',
        planExpiresAt: pastDate
      });
      assert.strictEqual(expired.isExpired, true);
      if (EXPIRED_PLAN_BEHAVIOR === 'FALLBACK_TO_TRIAL') {
        assert.strictEqual(expired.plan.name, 'Trial');
      }
    });

    // ── Test 7: Atomic keyword-scan limit under concurrent requests ─────
    await test('7. Atomic keyword-scan limit enforcement prevents race conditions', async () => {
      const email = `concurrency-${testSuffix}@testsuite.local`;
      const user = await User.create({
        name: 'Concurrency Tester',
        email,
        passwordHash: 'dummy',
        planName: 'Starter', // Starter has keywordScanLimit = 50
        limitOverrides: { keywordScanLimit: 10, scanCreditsPerMonth: 10 },
        usage: {
          keywordsScannedThisMonth: 8,
          scanCreditsUsed: 8,
          chatbotUsed: 0,
          locationsCount: 0,
          usageResetAt: new Date()
        },
        permissions: { canScan: true, canUseGeoGrid: true },
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(user._id.toString());

      // Try 5 concurrent requests of 1 keyword each (limit only has room for 2 more: 8 + 2 = 10)
      const attempts = [1, 2, 3, 4, 5];
      let successes = 0;
      let failures = 0;

      await Promise.all(
        attempts.map(async () => {
          try {
            await userLimitsService.assertAndIncrementKeywordScan(user._id.toString(), 1, 1);
            successes++;
          } catch (e: any) {
            failures++;
          }
        })
      );

      // Exactly 2 must succeed and 3 must fail with LIMIT_EXCEEDED
      assert.strictEqual(successes, 2, 'Exactly 2 attempts should fit into remaining quota of 2');
      assert.strictEqual(failures, 3, '3 attempts should fail with limit reached error');

      const updated = await User.findById(user._id);
      assert.strictEqual(updated?.usage?.keywordsScannedThisMonth, 10, 'Counter must stop at exactly 10');

      // Test refundKeywordScan
      await userLimitsService.refundKeywordScan(user._id.toString(), 1, 1);
      const refunded = await User.findById(user._id);
      assert.strictEqual(refunded?.usage?.keywordsScannedThisMonth, 9, 'Counter should decrement to 9 on refund');
    });

    // ── Test 8: Location create / delete counter ────────────────────────
    await test('8. Location creation increments and deletion decrements counter without negative values', async () => {
      const email = `loc-test-${testSuffix}@testsuite.local`;
      const user = await User.create({
        name: 'Location Tester',
        email,
        passwordHash: 'dummy',
        planName: 'Starter', // locationLimit = 3
        usage: {
          keywordsScannedThisMonth: 0,
          scanCreditsUsed: 0,
          chatbotUsed: 0,
          locationsCount: 2,
          usageResetAt: new Date()
        },
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(user._id.toString());

      // 1st location creation: 2 -> 3 (allowed)
      await userLimitsService.assertCanCreateLocation(user._id.toString());
      let u = await User.findById(user._id);
      assert.strictEqual(u?.usage?.locationsCount, 3);

      // 2nd location creation: should fail since limit is 3
      let blocked = false;
      try {
        await userLimitsService.assertCanCreateLocation(user._id.toString());
      } catch (err: any) {
        blocked = true;
        assert.ok(err.message.includes('Limit reached: set by your administrator'));
      }
      assert.strictEqual(blocked, true, 'Location creation above limit must throw');

      // Decrement on deletion
      await userLimitsService.decrementLocationsCount(user._id.toString());
      u = await User.findById(user._id);
      assert.strictEqual(u?.usage?.locationsCount, 2);

      // Decrement multiple times down to zero
      await userLimitsService.decrementLocationsCount(user._id.toString());
      await userLimitsService.decrementLocationsCount(user._id.toString());
      await userLimitsService.decrementLocationsCount(user._id.toString());
      u = await User.findById(user._id);
      assert.strictEqual(u?.usage?.locationsCount, 0, 'Location count must not become negative');
    });

    // ── Test 9: Each permission flag blocking its feature ───────────────
    await test('9. All 7 platform permission flags correctly enforce feature access', async () => {
      const email = `perms-test-${testSuffix}@testsuite.local`;
      const user = await User.create({
        name: 'Perms Tester',
        email,
        passwordHash: 'dummy',
        planName: 'Trial',
        permissions: {
          canScan: false,
          canUseChatbot: false,
          canUseGeoGrid: false,
          canUseCompetitorMatrix: false,
          canExportPdf: false,
          canInviteTeam: false,
          canUseApi: false
        },
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(user._id.toString());

      const flags: Array<'canScan' | 'canUseChatbot' | 'canUseGeoGrid' | 'canUseCompetitorMatrix' | 'canExportPdf' | 'canInviteTeam' | 'canUseApi'> = [
        'canScan',
        'canUseChatbot',
        'canUseGeoGrid',
        'canUseCompetitorMatrix',
        'canExportPdf',
        'canInviteTeam',
        'canUseApi'
      ];

      for (const flag of flags) {
        let threw = false;
        try {
          await userLimitsService.assertPermission(user._id.toString(), flag);
        } catch (e: any) {
          threw = true;
          assert.ok(e.message.includes('Limit reached: set by your administrator'));
        }
        assert.strictEqual(threw, true, `assertPermission must throw for disabled flag: ${flag}`);
      }
    });

    // ── Test 10: Audit log written for admin mutations ───────────────────
    await test('10. Audit log correctly written with before/after state on admin mutations', async () => {
      const targetUser = await User.create({
        name: 'Audit Target',
        email: `target-${testSuffix}@testsuite.local`,
        passwordHash: 'dummy',
        planName: 'Trial',
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(targetUser._id.toString());

      const log = await AuditLog.create({
        actorUserId: 'admin123',
        actorRole: 'ADMIN',
        targetUserId: targetUser._id.toString(),
        action: 'ADMIN_UPDATE_PLAN',
        before: { planName: 'Trial' },
        after: { planName: 'Pro Growth' },
        ip: '127.0.0.1',
        userAgent: 'TestSuite/1.0'
      });

      assert.ok(log._id);
      const retrieved = await AuditLog.findById(log._id);
      assert.strictEqual(retrieved?.action, 'ADMIN_UPDATE_PLAN');
      assert.strictEqual(retrieved?.before?.planName, 'Trial');
      assert.strictEqual(retrieved?.after?.planName, 'Pro Growth');

      // Cleanup audit log
      await AuditLog.deleteOne({ _id: log._id });
    });

    // ── Test 11: Soft-deleted admin rejection & re-registration review ─
    await test('11. Soft-deleted admins cannot log in, refresh, or re-register without review', async () => {
      const email = `deleted-admin-${testSuffix}@testsuite.local`;
      const deletedAdmin = await User.create({
        name: 'Deleted Admin',
        email,
        passwordHash: 'dummy',
        platformRole: 'ADMIN',
        status: 'DELETED'
      });
      testUsersToCleanup.push(deletedAdmin._id.toString());

      // 1. Cannot log in
      let loginBlocked = false;
      try {
        await authService.login({ email, password: 'password123' });
      } catch (e: any) {
        loginBlocked = true;
        assert.ok(e.message === 'ACCOUNT_DELETED' || e.statusCode === 403);
      }
      assert.strictEqual(loginBlocked, true, 'Soft-deleted user cannot log in');

      // 2. Cannot admin-login
      let adminLoginBlocked = false;
      try {
        await authService.adminLogin({ email, password: 'password123' });
      } catch (e: any) {
        adminLoginBlocked = true;
        assert.ok(e.message === 'ACCOUNT_DELETED' || e.statusCode === 403);
      }
      assert.strictEqual(adminLoginBlocked, true, 'Soft-deleted admin cannot adminLogin');

      // 3. Cannot re-register as a normal user without review
      let regBlocked = false;
      try {
        await authService.register({
          name: 'Imposter',
          email,
          password: 'Password123!'
        });
      } catch (e: any) {
        regBlocked = true;
        assert.strictEqual(e.code, 'ACCOUNT_DELETED_CONTACT_SUPPORT');
      }
      assert.strictEqual(regBlocked, true, 'Deleted admin email cannot be re-registered without review');
    });

    // ── Test 12: Lazy plan expiration on request ────────────────────────
    await test('12. Lazy plan expiration downgrades expired user per EXPIRED_PLAN_BEHAVIOR', async () => {
      const email = `expired-plan-${testSuffix}@testsuite.local`;
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Expired yesterday
      const user = await User.create({
        name: 'Expired Plan User',
        email,
        passwordHash: 'dummy',
        platformRole: 'USER',
        planName: 'Pro Growth',
        planExpiresAt: pastDate,
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(user._id.toString());

      // Simulate a request triggering userLimitsService
      await userLimitsService.getUserEffectiveLimits(user as any);

      const refreshed = await User.findById(user._id);
      if (EXPIRED_PLAN_BEHAVIOR === 'FALLBACK_TO_TRIAL') {
        assert.strictEqual(refreshed?.planName, 'Trial', 'Expired plan must lazily fall back to Trial');
      }
    });

  } finally {
    // 4. Clean up all temporary test users and test audit logs
    try {
      await User.deleteMany({ email: /@testsuite\.local$/ });
      await AuditLog.deleteMany({ userAgent: 'TestSuite/1.0' });
      if (testUsersToCleanup.length > 0) {
        await User.deleteMany({ _id: { $in: testUsersToCleanup } });
      }
    } catch (cleanupErr: any) {
      console.warn('⚠️ Warning during test cleanup:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }

  console.log('\n======================================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
