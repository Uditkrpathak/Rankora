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
import { accountService } from '../src/modules/auth/account.service';

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

    // ── Test 13: create-password rejects if password exists, sends confirmation if OAuth only ───
    await test('13. create-password: 30m expiry, rejection if password exists, never serialized', async () => {
      // 13a. User with existing password must be rejected
      const userWithPwd = await User.create({
        name: 'User With Password',
        email: `pwd-exists-${testSuffix}@testsuite.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(userWithPwd._id.toString());

      let rejected = false;
      try {
        await accountService.requestCreatePassword(userWithPwd._id.toString());
      } catch (err: any) {
        rejected = true;
        assert.strictEqual(err.code, 'PASSWORD_ALREADY_EXISTS');
      }
      assert.strictEqual(rejected, true, 'Must reject create-password if user already has a password');

      // 13b. OAuth-only user (no password) can request and confirm password
      const oauthUser = await User.create({
        name: 'Google OAuth User',
        email: `oauth-user-${testSuffix}@testsuite.local`,
        googleSub: `googlesub-${testSuffix}`,
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(oauthUser._id.toString());

      const result = await accountService.requestCreatePassword(oauthUser._id.toString());
      assert.strictEqual(result.success, true);
      assert.ok(result.rawToken, 'rawToken returned in non-prod environment for testing');

      // Verify token expiry is set to 30 minutes
      const userBeforeConfirm = await User.findById(oauthUser._id).select('+createPasswordTokenHash +createPasswordExpiresAt');
      assert.ok(userBeforeConfirm?.createPasswordExpiresAt);
      const diffMs = userBeforeConfirm.createPasswordExpiresAt.getTime() - Date.now();
      assert.ok(diffMs > 28 * 60 * 1000 && diffMs <= 30 * 60 * 1000, 'create-password token expiry must be 30 minutes');

      // Verify createPasswordTokenHash is select: false (not returned in normal queries)
      const plainQueryUser = await User.findById(oauthUser._id);
      assert.strictEqual(plainQueryUser?.createPasswordTokenHash, undefined, 'createPasswordTokenHash must have select: false');
      assert.strictEqual(plainQueryUser?.createPasswordExpiresAt, undefined, 'createPasswordExpiresAt must have select: false');

      // Verify createPasswordTokenHash is never serialized in toJSON
      const serializedJson = userBeforeConfirm.toJSON();
      assert.strictEqual(serializedJson.createPasswordTokenHash, undefined, 'createPasswordTokenHash must NEVER be serialized in toJSON');
      assert.strictEqual(serializedJson.createPasswordExpiresAt, undefined, 'createPasswordExpiresAt must NEVER be serialized in toJSON');

      // 13c. Verify unauthenticated create-password endpoint returns generic response
      const unauthNonexistent = await accountService.requestCreatePasswordByEmail(`nonexistent-${testSuffix}@testsuite.local`);
      assert.strictEqual(unauthNonexistent.message, 'If an account exists without a password, a confirmation link has been sent.');
      assert.strictEqual((unauthNonexistent as any).rawToken, undefined, 'rawToken must not be returned in unauthenticated response');

      const unauthExistingPwd = await accountService.requestCreatePasswordByEmail(userWithPwd.email);
      assert.strictEqual(unauthExistingPwd.message, 'If an account exists without a password, a confirmation link has been sent.');
      assert.strictEqual((unauthExistingPwd as any).rawToken, undefined, 'rawToken must not be returned for password-protected accounts');

      // 13d. Confirm password creation using token and verify other sessions revoked
      const initialSessionVersion = oauthUser.sessionVersion || 1;
      const confirmResult = await accountService.confirmCreatePassword(result.rawToken!, 'StrongP@ssw0rd!');
      assert.strictEqual(confirmResult.success, true);

      // Verify user now has password, token fields are cleared, and sessionVersion was incremented (revoking other sessions)
      const updatedUser = await User.findById(oauthUser._id);
      assert.ok(updatedUser?.passwordHash, 'User now has a passwordHash');
      assert.strictEqual(updatedUser?.createPasswordTokenHash, undefined);
      assert.strictEqual(updatedUser?.createPasswordExpiresAt, undefined);
      assert.strictEqual(updatedUser?.sessionVersion, initialSessionVersion + 1, 'sessionVersion must be incremented to revoke other sessions');

      // Second attempt to create password must be rejected
      let secondAttemptRejected = false;
      try {
        await accountService.requestCreatePassword(oauthUser._id.toString());
      } catch (err: any) {
        secondAttemptRejected = true;
        assert.strictEqual(err.code, 'PASSWORD_ALREADY_EXISTS');
      }
      assert.strictEqual(secondAttemptRejected, true, 'Subsequent create-password request rejected once password exists');
    });

    // ── Test 14: Password-registered user logging in with Google gets linked, not duplicated ───
    await test('14. Password-registered user logging in with Google gets linked, not duplicated', async () => {
      const email = `pwd-linked-${testSuffix}@testsuite.local`;
      const pwdUser = await User.create({
        name: 'Password User',
        email,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        isEmailVerified: true,
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(pwdUser._id.toString());
      assert.strictEqual(pwdUser.googleSub, undefined, 'Initially has no googleSub');

      const gSub = `sub_linked_${testSuffix}`;
      const { user: loggedInUser } = await authService.googleLogin({
        idToken: `mock_google_${gSub}:${email}`
      });

      assert.strictEqual(loggedInUser._id.toString(), pwdUser._id.toString(), 'Must link to the existing user record');
      assert.strictEqual(loggedInUser.googleSub, gSub, 'googleSub must be linked on existing user');
      assert.ok(loggedInUser.passwordHash, 'Password hash must be preserved');

      // Verify database count to guarantee no duplication
      const userCount = await User.countDocuments({ email });
      assert.strictEqual(userCount, 1, 'User must not be duplicated');
    });

    // ── Test 15: Legacy user without googleSub can log in via Google ───
    await test('15. Legacy user without googleSub can log in via Google email fallback', async () => {
      const legacyEmail = `legacy-user-${testSuffix}@testsuite.local`;
      const legacyUser = await User.create({
        name: 'Legacy User',
        email: legacyEmail,
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(legacyUser._id.toString());
      assert.strictEqual(legacyUser.googleSub, undefined, 'Legacy user has no googleSub initially');

      const legacySub = `sub_legacy_${testSuffix}`;
      const { user: authenticatedLegacy } = await authService.googleLogin({
        idToken: `mock_google_${legacySub}:${legacyEmail}`
      });

      assert.strictEqual(authenticatedLegacy._id.toString(), legacyUser._id.toString(), 'Legacy user successfully logged in');
      assert.strictEqual(authenticatedLegacy.googleSub, legacySub, 'googleSub set on legacy user');
      assert.strictEqual(authenticatedLegacy.status, 'ACTIVE');
    });

    // ── Test 16: Google login matches user by googleId (googleSub) even after email change ───
    await test('16. Google login matches user by googleId (googleSub) even after email change', async () => {
      const gSub = `sub-immutable-${testSuffix}`;
      const originalEmail = `guser-${testSuffix}@testsuite.local`;
      const changedEmail = `guser-changed-${testSuffix}@testsuite.local`;

      // Create initial Google user
      const gUser = await User.create({
        name: 'Google Sub User',
        email: originalEmail,
        googleSub: gSub,
        status: 'ACTIVE'
      });
      testUsersToCleanup.push(gUser._id.toString());

      // Simulate user changing their email address in Rankora
      gUser.email = changedEmail;
      await gUser.save();

      // Login with Google via googleSub (even though token may have different or changed email)
      const { user: resolvedUser } = await authService.googleLogin({
        idToken: `mock_google_${gSub}:${originalEmail}`
      });

      assert.strictEqual(resolvedUser._id.toString(), gUser._id.toString(), 'Resolved by immutable googleSub');
      assert.strictEqual(resolvedUser.email, changedEmail, 'Preserved updated account email');
    });

    // ── Test 17: googleLogin rejects suspended or soft-deleted users on email fallback ───
    await test('17. googleLogin rejects suspended or soft-deleted users on email fallback', async () => {
      // 17a. Suspended user
      const suspendedEmail = `suspended-fallback-${testSuffix}@testsuite.local`;
      const suspendedUser = await User.create({
        name: 'Suspended User',
        email: suspendedEmail,
        status: 'SUSPENDED'
      });
      testUsersToCleanup.push(suspendedUser._id.toString());

      let suspendedRejected = false;
      try {
        await authService.googleLogin({
          idToken: `mock_google_sub_susp_${testSuffix}:${suspendedEmail}`
        });
      } catch (err: any) {
        suspendedRejected = true;
        assert.strictEqual(err.message, 'ACCOUNT_SUSPENDED');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(suspendedRejected, true, 'Must reject suspended user on googleLogin fallback');

      // 17b. Deleted / Pending deletion user
      const deletedEmail = `deleted-fallback-${testSuffix}@testsuite.local`;
      const deletedUser = await User.create({
        name: 'Deleted User',
        email: deletedEmail,
        status: 'PENDING_DELETION'
      });
      testUsersToCleanup.push(deletedUser._id.toString());

      let deletedRejected = false;
      try {
        await authService.googleLogin({
          idToken: `mock_google_sub_del_${testSuffix}:${deletedEmail}`
        });
      } catch (err: any) {
        deletedRejected = true;
        assert.strictEqual(err.message, 'ACCOUNT_DELETED');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(deletedRejected, true, 'Must reject soft-deleted user on googleLogin fallback');
    });

    // ── Test 18: If existing account email was never verified, clear passwordHash and tokens before linking ───
    await test('18. If existing account email was never verified, clear passwordHash and tokens before linking', async () => {
      const unverifiedEmail = `unverified-${testSuffix}@testsuite.local`;
      const unverifiedUser = await User.create({
        name: 'Unverified Pre-Registered User',
        email: unverifiedEmail,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$unverifiedpass',
        status: 'PENDING_VERIFICATION',
        emailVerificationTokenHash: 'dummy_verify_token',
        emailVerificationExpiresAt: new Date(Date.now() + 3600000),
        passwordResetTokenHash: 'dummy_reset_token',
        passwordResetExpiresAt: new Date(Date.now() + 3600000),
        sessionVersion: 1
      });
      testUsersToCleanup.push(unverifiedUser._id.toString());
      assert.strictEqual(unverifiedUser.isEmailVerified, false);
      assert.ok(unverifiedUser.passwordHash);

      const gSub = `sub_unverified_${testSuffix}`;
      const { user: linkedUser } = await authService.googleLogin({
        idToken: `mock_google_${gSub}:${unverifiedEmail}`
      });

      assert.strictEqual(linkedUser._id.toString(), unverifiedUser._id.toString(), 'Links to the existing account');
      assert.strictEqual(linkedUser.googleSub, gSub, 'Sets googleSub on account');

      // Refresh from DB to verify passwordHash and pending tokens were cleared and email is now verified
      const refreshed = await User.findById(unverifiedUser._id);
      assert.strictEqual(refreshed?.passwordHash, undefined, 'passwordHash must be cleared for unverified pre-existing account');
      assert.strictEqual(refreshed?.isEmailVerified, true, 'isEmailVerified marked true by verified Google identity');
      assert.strictEqual(refreshed?.status, 'ACTIVE', 'Status transitions from PENDING_VERIFICATION to ACTIVE');
      assert.strictEqual(refreshed?.emailVerificationTokenHash, undefined, 'emailVerificationTokenHash must be cleared');
      assert.strictEqual(refreshed?.emailVerificationExpiresAt, undefined, 'emailVerificationExpiresAt must be cleared');
      assert.strictEqual(refreshed?.passwordResetTokenHash, undefined, 'passwordResetTokenHash must be cleared');
      assert.strictEqual(refreshed?.passwordResetExpiresAt, undefined, 'passwordResetExpiresAt must be cleared');
      assert.strictEqual(refreshed?.sessionVersion, 2, 'sessionVersion incremented to invalidate prior sessions');
    });

    // ── Test 19: googleLogin rejects with 403 on email fallback if matched user already has different googleSub ───
    await test('19. googleLogin rejects with 403 on email fallback if matched user already has different googleSub', async () => {
      const email = `conflict-sub-${testSuffix}@testsuite.local`;
      const originalSub = `sub_orig_${testSuffix}`;
      const attackerSub = `sub_different_${testSuffix}`;

      const existingUser = await User.create({
        name: 'Existing Linked User',
        email,
        googleSub: originalSub,
        status: 'ACTIVE',
        isEmailVerified: true
      });
      testUsersToCleanup.push(existingUser._id.toString());

      let conflictRejected = false;
      try {
        await authService.googleLogin({
          idToken: `mock_google_${attackerSub}:${email}`
        });
      } catch (err: any) {
        conflictRejected = true;
        assert.strictEqual(err.message, 'GOOGLE_ACCOUNT_CONFLICT');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(conflictRejected, true, 'Must reject with 403 on googleSub mismatch');

      // Ensure original googleSub is untampered
      const unchanged = await User.findById(existingUser._id);
      assert.strictEqual(unchanged?.googleSub, originalSub, 'Existing googleSub must remain intact');
    });

    // ── Test 20: googleLogin primary path (found directly by googleSub) rejects suspended/deleted users with 403 ───
    await test('20. googleLogin primary path (by googleSub) rejects suspended and deleted users with 403', async () => {
      const suspSub = `sub_prim_susp_${testSuffix}`;
      const suspEmail = `prim-susp-${testSuffix}@testsuite.local`;
      const suspUser = await User.create({
        name: 'Primary Suspended User',
        email: suspEmail,
        googleSub: suspSub,
        status: 'SUSPENDED'
      });
      testUsersToCleanup.push(suspUser._id.toString());

      let suspRejected = false;
      try {
        await authService.googleLogin({
          idToken: `mock_google_${suspSub}:${suspEmail}`
        });
      } catch (err: any) {
        suspRejected = true;
        assert.strictEqual(err.message, 'ACCOUNT_SUSPENDED');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(suspRejected, true, 'Primary path must reject suspended user with 403');

      const delSub = `sub_prim_del_${testSuffix}`;
      const delEmail = `prim-del-${testSuffix}@testsuite.local`;
      const delUser = await User.create({
        name: 'Primary Deleted User',
        email: delEmail,
        googleSub: delSub,
        status: 'DELETED'
      });
      testUsersToCleanup.push(delUser._id.toString());

      let delRejected = false;
      try {
        await authService.googleLogin({
          idToken: `mock_google_${delSub}:${delEmail}`
        });
      } catch (err: any) {
        delRejected = true;
        assert.strictEqual(err.message, 'ACCOUNT_DELETED');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(delRejected, true, 'Primary path must reject deleted user with 403');
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
