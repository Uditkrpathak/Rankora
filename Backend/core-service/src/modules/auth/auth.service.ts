import mongoose from 'mongoose';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { RegisterInput, LoginInput, GoogleLoginInput, ARGON2_CONFIG, SECURITY_POLICIES } from '@localo/shared';
import { AuthTokens, AuthResponse, UserRole } from '@localo/types';
import { User, UserDocument } from '../../models/User';
import { Workspace, WorkspaceDocument } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { AuditLog } from '../../models/AuditLog';
import { tokenService } from './token.service';
import { verificationService } from './verification.service';
import { redisClient, cacheStore } from '../../config/redis';
import { ENV } from '../../config/env';
import { ROLE_PERMISSIONS } from '@localo/shared';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

async function runInTransaction<T>(fn: (session?: mongoose.ClientSession) => Promise<T>): Promise<T> {
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err: any) {
    if (session && session.inTransaction()) {
      await session.abortTransaction().catch(() => {});
    }
    // Check if error is because standalone mongodb doesn't support transactions
    if (
      err?.code === 20 ||
      err?.codeName === 'IllegalOperation' ||
      err?.message?.includes('Transaction numbers are only allowed')
    ) {
      return await fn(undefined);
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}

export class AuthService {
  /**
   * Atomic multi-document registration transaction
   */
  public async register(
    input: RegisterInput,
    ip?: string,
    userAgent?: string,
    correlationId?: string
  ): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check duplicate email
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.status === 'DELETED' || existing.status === 'PENDING_DELETION') {
        const err: any = new Error('This account was previously deactivated or deleted. Please contact support or an administrator for review.');
        err.statusCode = 403;
        err.code = 'ACCOUNT_DELETED_CONTACT_SUPPORT';
        throw err;
      }
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Hash password with fixed OWASP argon2id params
    const passwordHash = await argon2.hash(input.password, {
      memoryCost: ARGON2_CONFIG.memoryCost,
      timeCost: ARGON2_CONFIG.timeCost,
      parallelism: ARGON2_CONFIG.parallelism,
      type: argon2.argon2id
    });

    // Run atomic multi-document transaction (with standalone fallback)
    const { user, workspace } = await runInTransaction(async (session) => {
      const opts = session ? { session } : undefined;

      // 1. Create User
      const [createdUser] = await User.create(
        [
          {
            email: normalizedEmail,
            passwordHash,
            name: input.name.trim(),
            platformRole: 'USER',
            mustChangePassword: false,
            planName: 'Trial',
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
              canUseApi: false
            },
            status: 'PENDING_VERIFICATION',
            isEmailVerified: false,
            hasClaimedTrial: true,
            argon2Version: ARGON2_CONFIG.version,
            sessionVersion: 1
          }
        ],
        opts
      );

      // 2. Create Default Workspace
      const workspaceName = input.workspaceName?.trim() || `${input.name.trim()}'s Workspace`;
      const [createdWorkspace] = await Workspace.create(
        [
          {
            name: workspaceName,
            ownerId: createdUser._id,
            status: 'ACTIVE',
            plan: {
              key: 'free_trial',
              status: 'trialing',
              periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            },
            limits: {
              locations: 10,
              seats: 5,
              scanCredits: 100,
              aiCredits: 50
            }
          }
        ],
        opts
      );

      // 3. Create Membership
      await WorkspaceMember.create(
        [
          {
            workspaceId: createdWorkspace._id,
            userId: createdUser._id,
            role: 'owner'
          }
        ],
        opts
      );

      // 4. Record AuditLog
      await AuditLog.create(
        [
          {
            workspaceId: createdWorkspace._id.toString(),
            actorUserId: createdUser._id.toString(),
            action: 'USER_REGISTERED',
            resourceType: 'User',
            resourceId: createdUser._id.toString(),
            ip,
            userAgent,
            correlationId,
            after: { email: createdUser.email, name: createdUser.name, workspaceId: createdWorkspace._id }
          }
        ],
        opts
      );

      return { user: createdUser, workspace: createdWorkspace };
    });

    // Enqueue Verification Email
    await verificationService.createAndSendVerificationToken(
      user._id.toString(),
      user.email,
      user.name
    );

    // Issue Auth Tokens
    const tokens = await tokenService.issueTokenBundle({
      userId: user._id.toString(),
      userAgent,
      ipAddress: ip
    });

    return { user, tokens };
  }

  /**
   * User login with brute-force lockout and MFA support
   */
  public async login(
    input: LoginInput,
    ip?: string,
    userAgent?: string,
    correlationId?: string
  ): Promise<
    | { mfaRequired: true; mfaChallengeToken: string }
    | { mfaRequired: false; user: UserDocument; tokens: AuthTokens }
  > {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check sliding lockout in cacheStore
    const lockoutKey = `lockout:${normalizedEmail}:${ip || 'unknown'}`;
    const attemptsKey = `login_attempts:${normalizedEmail}:${ip || 'unknown'}`;

    const isLocked = await cacheStore.get(lockoutKey);
    if (isLocked) {
      const ttl = await cacheStore.ttl(lockoutKey);
      const err: any = new Error('ACCOUNT_TEMPORARILY_LOCKED');
      err.retryAfter = ttl > 0 ? ttl : 60;
      throw err;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      await this.recordFailedAttempt(normalizedEmail, ip);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check deleted or suspended status
    if (user.status === 'DELETED' || user.status === 'PENDING_DELETION') {
      await this.recordFailedAttempt(normalizedEmail, ip);
      const err: any = new Error('ACCOUNT_DELETED');
      err.statusCode = 403;
      throw err;
    }

    if (user.status === 'SUSPENDED') {
      const err: any = new Error('ACCOUNT_SUSPENDED');
      err.statusCode = 403;
      throw err;
    }

    // Verify Password
    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      await this.recordFailedAttempt(normalizedEmail, ip);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Reset failed login counter on success
    await cacheStore.del(attemptsKey);
    await cacheStore.del(lockoutKey);

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Check MFA
    if (user.mfaEnabled) {
      const { generateSecureToken } = await import('@localo/shared');
      const mfaChallengeToken = generateSecureToken(32);
      
      await cacheStore.set(
        `mfa_challenge:${mfaChallengeToken}`,
        user._id.toString(),
        SECURITY_POLICIES.MFA_CHALLENGE_TTL_SECONDS
      );

      return { mfaRequired: true, mfaChallengeToken };
    }

    // Issue Token Bundle
    const tokens = await tokenService.issueTokenBundle({
      userId: user._id.toString(),
      userAgent,
      ipAddress: ip
    });

    // Log Login
    await AuditLog.create({
      actorUserId: user._id.toString(),
      actorRole: user.platformRole || 'USER',
      action: 'USER_LOGGED_IN',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      userAgent,
      correlationId
    });

    return { mfaRequired: false, user, tokens };
  }

  /**
   * Admin-only login endpoint (ADMIN and SUPER_ADMIN only)
   */
  public async adminLogin(
    input: LoginInput,
    ip?: string,
    userAgent?: string,
    correlationId?: string
  ): Promise<
    | { mfaRequired: true; mfaChallengeToken: string }
    | { mfaRequired: false; user: UserDocument; tokens: AuthTokens }
  > {
    const normalizedEmail = input.email.toLowerCase().trim();
    const lockoutKey = `lockout:${normalizedEmail}:${ip || 'unknown'}`;
    const attemptsKey = `login_attempts:${normalizedEmail}:${ip || 'unknown'}`;

    const isLocked = await cacheStore.get(lockoutKey);
    if (isLocked) {
      const ttl = await cacheStore.ttl(lockoutKey);
      const err: any = new Error('ACCOUNT_TEMPORARILY_LOCKED');
      err.retryAfter = ttl > 0 ? ttl : 60;
      throw err;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      await this.recordFailedAttempt(normalizedEmail, ip);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Only allow ADMIN and SUPER_ADMIN
    const role = user.platformRole || 'USER';
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      await this.recordFailedAttempt(normalizedEmail, ip);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check deleted or suspended status
    if (user.status === 'DELETED' || user.status === 'PENDING_DELETION') {
      await this.recordFailedAttempt(normalizedEmail, ip);
      const err: any = new Error('ACCOUNT_DELETED');
      err.statusCode = 403;
      throw err;
    }

    if (user.status === 'SUSPENDED') {
      const err: any = new Error('ACCOUNT_SUSPENDED');
      err.statusCode = 403;
      throw err;
    }

    // Verify Password
    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      await this.recordFailedAttempt(normalizedEmail, ip);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Reset failed login counter on success
    await cacheStore.del(attemptsKey);
    await cacheStore.del(lockoutKey);

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Check MFA
    if (user.mfaEnabled) {
      const { generateSecureToken } = await import('@localo/shared');
      const mfaChallengeToken = generateSecureToken(32);
      
      await cacheStore.set(
        `mfa_challenge:${mfaChallengeToken}`,
        user._id.toString(),
        SECURITY_POLICIES.MFA_CHALLENGE_TTL_SECONDS
      );

      return { mfaRequired: true, mfaChallengeToken };
    }

    // Issue Token Bundle
    const tokens = await tokenService.issueTokenBundle({
      userId: user._id.toString(),
      userAgent,
      ipAddress: ip
    });

    // Log Admin Login
    await AuditLog.create({
      actorUserId: user._id.toString(),
      actorRole: user.platformRole,
      action: 'ADMIN_LOGGED_IN',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      userAgent,
      correlationId
    });

    return { mfaRequired: false, user, tokens };
  }

  /**
   * Google Sign-In (Identity verification only)
   */
  public async googleLogin(
    input: GoogleLoginInput,
    ip?: string,
    userAgent?: string,
    correlationId?: string
  ): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    let payload: any;
    
    try {
      if (ENV.NODE_ENV !== 'production' && input.idToken.startsWith('mock_google_')) {
        const tokenContent = input.idToken.replace('mock_google_', '');
        const [sub, customEmail] = tokenContent.includes(':') ? tokenContent.split(':') : [tokenContent, undefined];
        payload = {
          sub,
          email: (customEmail || `${tokenContent}@example.com`).toLowerCase(),
          name: 'Google User',
          picture: 'https://example.com/avatar.jpg',
          email_verified: true
        };
      } else {
        const validAudiences = Array.from(new Set([
          ENV.GOOGLE_CLIENT_ID,
          '156453109178-6b4v8fdmspg2pmde5qb6n2habr27rk8m.apps.googleusercontent.com',
          '925003935361-3ptlomcghk700l7t1ptmtdvm5f46e406.apps.googleusercontent.com'
        ])).filter(Boolean);

        const ticket = await googleClient.verifyIdToken({
          idToken: input.idToken,
          audience: validAudiences.length === 1 ? validAudiences[0] : validAudiences
        });
        payload = ticket.getPayload();
      }
    } catch (err: any) {
      console.error('[Google Auth Error]', err?.message || err);
      throw new Error('INVALID_GOOGLE_CREDENTIAL');
    }

    if (!payload?.email) {
      throw new Error('GOOGLE_EMAIL_MISSING');
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    // 1. Look up by googleSub first (Google immutable ID)
    let user = await User.findOne({ googleSub: payload.sub });

    // Confirm suspended and deleted checks apply to users found directly by googleSub
    if (user) {
      if (user.status === 'DELETED' || user.status === 'PENDING_DELETION') {
        const err: any = new Error('ACCOUNT_DELETED');
        err.statusCode = 403;
        throw err;
      }

      if (user.status === 'SUSPENDED') {
        const err: any = new Error('ACCOUNT_SUSPENDED');
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. If not found, look up by email only when payload.email_verified is true
    if (!user && payload.email_verified) {
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        // Reject with 403 if the matched user already has a googleSub different from payload.sub
        if (user.googleSub && user.googleSub !== payload.sub) {
          const err: any = new Error('GOOGLE_ACCOUNT_CONFLICT');
          err.statusCode = 403;
          throw err;
        }

        // Reject suspended or soft-deleted users using the same checks as standard login
        if (user.status === 'DELETED' || user.status === 'PENDING_DELETION') {
          const err: any = new Error('ACCOUNT_DELETED');
          err.statusCode = 403;
          throw err;
        }

        if (user.status === 'SUSPENDED') {
          const err: any = new Error('ACCOUNT_SUSPENDED');
          err.statusCode = 403;
          throw err;
        }

        const wasUnverified = !user.isEmailVerified;
        // In unverified-account branch: clear password, only change status if PENDING_VERIFICATION, clear tokens, and increment session
        if (wasUnverified) {
          user.passwordHash = undefined;
          user.isEmailVerified = true;
          if (user.status === 'PENDING_VERIFICATION') {
            user.status = 'ACTIVE';
          }
          user.emailVerificationTokenHash = undefined;
          user.emailVerificationExpiresAt = undefined;
          user.passwordResetTokenHash = undefined;
          user.passwordResetExpiresAt = undefined;
          user.createPasswordTokenHash = undefined;
          user.createPasswordExpiresAt = undefined;
        }

        // Only link users with no googleSub
        if (!user.googleSub) {
          user.googleSub = payload.sub;
        }

        await user.save();

        if (wasUnverified) {
          const newSessionVersion = await tokenService.incrementSessionVersion(user._id.toString(), 'OAUTH_LINK_UNVERIFIED');
          user.sessionVersion = newSessionVersion;
        }
      }
    }

    if (!user) {
      // Create new user & workspace
      user = await runInTransaction(async (session) => {
        const opts = session ? { session } : undefined;
        const [newUser] = await User.create(
          [
            {
              email: normalizedEmail,
              name: payload.name || 'User',
              googleSub: payload.sub,
              avatarUrl: payload.picture,
              status: 'ACTIVE',
              isEmailVerified: true, // Google already verified email
              sessionVersion: 1
            }
          ],
          opts
        );

        const workspaceName = input.workspaceName || `${newUser.name}'s Workspace`;
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const [workspace] = await Workspace.create(
          [
            {
              name: workspaceName,
              ownerId: newUser._id,
              status: 'ACTIVE',
              trialEndsAt,
              plan: {
                key: 'free_trial',
                status: 'trialing',
                periodEnd: trialEndsAt
              },
              limits: {
                locations: 1,
                seats: 1,
                scanCredits: 50,
                aiCredits: 20
              }
            }
          ],
          opts
        );

        await WorkspaceMember.create(
          [
            {
              workspaceId: workspace._id,
              userId: newUser._id,
              role: 'owner'
            }
          ],
          opts
        );

        await AuditLog.create(
          [
            {
              workspaceId: workspace._id.toString(),
              actorUserId: newUser._id.toString(),
              action: 'USER_REGISTERED_GOOGLE',
              resourceType: 'User',
              resourceId: newUser._id.toString(),
              ip,
              userAgent,
              correlationId
            }
          ],
          opts
        );

        return newUser;
      });
    }

    const tokens = await tokenService.issueTokenBundle({
      userId: user._id.toString(),
      userAgent,
      ipAddress: ip
    });

    await AuditLog.create({
      actorUserId: user._id.toString(),
      action: 'USER_LOGGED_IN_GOOGLE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      userAgent,
      correlationId
    });

    return { user, tokens };
  }

  /**
   * Helper: Record failed login attempt and apply lockout threshold
   */
  private async recordFailedAttempt(email: string, ip?: string): Promise<void> {
    const attemptsKey = `login_attempts:${email}:${ip || 'unknown'}`;
    const lockoutKey = `lockout:${email}:${ip || 'unknown'}`;

    try {
      const count = await cacheStore.incr(attemptsKey, 900);

      for (const threshold of SECURITY_POLICIES.LOCKOUT_THRESHOLDS) {
        if (count >= threshold.attempts) {
          await cacheStore.set(lockoutKey, '1', threshold.lockoutSeconds);
          break;
        }
      }
    } catch (e) {}
  }
}

export const authService = new AuthService();
