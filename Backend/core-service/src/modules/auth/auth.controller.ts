import { Request, Response } from 'express';
import { authService } from './auth.service';
import { tokenService } from './token.service';
import { verificationService } from './verification.service';
import { passwordResetService } from './password-reset.service';
import { mfaService } from './mfa.service';
import { sessionService } from './session.service';
import { accountService } from './account.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { Workspace } from '../../models/Workspace';
import { RefreshToken } from '../../models/RefreshToken';
import { ENV } from '../../config/env';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaVerifySchema,
  mfaChallengeSchema,
  hashToken
} from '@localo/shared';

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const isCrossSite = Boolean(
    isProd && (
      process.env.CROSS_SITE_COOKIES === 'true' ||
      (ENV.FRONTEND_URL && !ENV.FRONTEND_URL.includes('localhost') && (!ENV.APP_URL || !ENV.FRONTEND_URL.includes(new URL(ENV.APP_URL).hostname)))
    )
  );
  return {
    secure: Boolean(isProd || isCrossSite),
    sameSite: (isCrossSite ? 'none' : 'lax') as 'none' | 'lax',
  };
}

function setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
  const { secure, sameSite } = getCookieOptions();
  
  // HttpOnly Refresh Token
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  // Non-HttpOnly CSRF Token (Readable by frontend on same domain; cross-origin uses JSON response)
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res: Response) {
  const { secure, sameSite } = getCookieOptions();
  res.clearCookie('refreshToken', { path: '/v1/auth', secure, sameSite });
  res.clearCookie('csrfToken', { path: '/', secure, sameSite });
}

export class AuthController {
  public async register(req: Request, res: Response): Promise<void> {
    const validated = registerSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'] as string;

    const { user, tokens } = await authService.register(validated, ip, userAgent, correlationId);
    setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);

    // Fetch user's created workspace
    const membership = await WorkspaceMember.findOne({ userId: user._id, role: 'owner' }).populate('workspaceId');
    const workspace: any = membership?.workspaceId;

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled
        },
        activeWorkspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          role: 'owner',
          plan: workspace.plan.key
        } : undefined,
        tokens: {
          accessToken: tokens.accessToken,
          csrfToken: tokens.csrfToken,
          expiresIn: tokens.expiresIn
        },
        accessToken: tokens.accessToken
      }
    });
  }

  public async login(req: Request, res: Response): Promise<void> {
    const validated = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'] as string;

    const result = await authService.login(validated, ip, userAgent, correlationId);

    if (result.mfaRequired) {
      res.status(200).json({
        success: true,
        data: {
          mfaRequired: true,
          mfaChallengeToken: result.mfaChallengeToken
        }
      });
      return;
    }

    const { user, tokens } = result;
    setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);

    // Find default workspace
    const membership = await WorkspaceMember.findOne({ userId: user._id }).populate('workspaceId');
    const workspace: any = membership?.workspaceId;

    res.status(200).json({
      success: true,
      data: {
        mfaRequired: false,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl
        },
        activeWorkspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          role: membership?.role || 'member',
          plan: workspace.plan.key
        } : undefined,
        tokens: {
          accessToken: tokens.accessToken,
          csrfToken: tokens.csrfToken,
          expiresIn: tokens.expiresIn
        }
      }
    });
  }

  public async googleLogin(req: Request, res: Response): Promise<void> {
    const validated = googleLoginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'] as string;

    const { user, tokens } = await authService.googleLogin(validated, ip, userAgent, correlationId);
    setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);

    const membership = await WorkspaceMember.findOne({ userId: user._id }).populate('workspaceId');
    const workspace: any = membership?.workspaceId;

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl
        },
        activeWorkspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          role: membership?.role || 'member',
          plan: workspace.plan.key
        } : undefined,
        tokens: {
          accessToken: tokens.accessToken,
          csrfToken: tokens.csrfToken,
          expiresIn: tokens.expiresIn
        },
        accessToken: tokens.accessToken
      }
    });
  }

  public async refresh(req: Request, res: Response): Promise<void> {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      res.status(401).json({ success: false, error: { code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token provided in cookies' } });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      const tokens = await tokenService.rotateRefreshToken(rawToken, userAgent, ip);
      setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          csrfToken: tokens.csrfToken,
          expiresIn: tokens.expiresIn
        }
      });
    } catch (err: any) {
      clearAuthCookies(res);
      const code = err.message === 'TOKEN_REPLAY_DETECTED' ? 'TOKEN_REPLAY_DETECTED' : 'INVALID_REFRESH_TOKEN';
      res.status(401).json({
        success: false,
        error: { code, message: 'Refresh token invalid or replayed. Please log in again.' }
      });
    }
  }

  public async verifyEmail(req: Request, res: Response): Promise<void> {
    const validated = verifyEmailSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;

    try {
      const { user } = await verificationService.verifyEmail(validated.token, ip);
      res.status(200).json({
        success: true,
        data: {
          message: 'Email successfully verified! Your 14-day free trial is now active.',
          userId: user._id
        }
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Verification link is invalid or has expired.' }
      });
    }
  }

  public async resendVerification(req: Request, res: Response): Promise<void> {
    const validated = resendVerificationSchema.parse(req.body);
    try {
      const result = await verificationService.resendVerification(validated.email);
      res.status(200).json({
        success: true,
        data: {
          message: 'If an unverified account exists, a new verification link has been sent.'
        }
      });
    } catch (err: any) {
      if (err.message === 'RATE_LIMIT_EXCEEDED') {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please wait an hour.' }
        });
        return;
      }
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
    }
  }

  public async devBypassVerify(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress;
    const { user } = await verificationService.devBypassVerify(req.user._id.toString(), ip);

    res.status(200).json({
      success: true,
      data: {
        message: 'Account successfully verified in dev environment.',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl
        }
      }
    });
  }

  public async getPublicConfig(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        devVerifyBypassEnabled: Boolean(ENV.ALLOW_DEV_VERIFY_BYPASS && ENV.NODE_ENV !== 'production')
      }
    });
  }

  public async forgotPassword(req: Request, res: Response): Promise<void> {
    const validated = forgotPasswordSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await passwordResetService.requestPasswordReset(validated.email, ip, userAgent);
    res.status(200).json({
      success: true,
      data: { message: 'If an account matches that email, a password reset link has been dispatched.' }
    });
  }

  public async resetPassword(req: Request, res: Response): Promise<void> {
    const validated = resetPasswordSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      await passwordResetService.resetPassword(validated.token, validated.newPassword, ip, userAgent);
      clearAuthCookies(res);
      res.status(200).json({
        success: true,
        data: { message: 'Password has been reset successfully. Please log in with your new password.' }
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'RESET_FAILED', message: 'Invalid or expired password reset link.' }
      });
    }
  }

  public async mfaEnroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { qrCodeDataUrl, secret } = await mfaService.enroll(req.user._id.toString(), req.user.email);
    res.status(200).json({
      success: true,
      data: { qrCodeDataUrl, secret }
    });
  }

  public async mfaVerify(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const validated = mfaVerifySchema.parse(req.body);
    try {
      const { backupCodes } = await mfaService.verifyAndActivate(req.user._id.toString(), validated.code);
      res.status(200).json({
        success: true,
        data: {
          message: 'Two-Factor Authentication is now enabled.',
          backupCodes
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'MFA_VERIFY_FAILED', message: err.message } });
    }
  }

  public async mfaChallenge(req: Request, res: Response): Promise<void> {
    const validated = mfaChallengeSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      const { user, tokens } = await mfaService.verifyChallenge(validated.mfaChallengeToken, validated.code, ip, userAgent);
      setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);

      const membership = await WorkspaceMember.findOne({ userId: user._id }).populate('workspaceId');
      const workspace: any = membership?.workspaceId;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            mfaEnabled: user.mfaEnabled
          },
          activeWorkspace: workspace ? {
            id: workspace._id,
            name: workspace.name,
            role: membership?.role || 'member',
            plan: workspace.plan.key
          } : undefined,
          tokens: {
            accessToken: tokens.accessToken,
            csrfToken: tokens.csrfToken,
            expiresIn: tokens.expiresIn
          }
        }
      });
    } catch (err: any) {
      res.status(401).json({ success: false, error: { code: 'MFA_CHALLENGE_FAILED', message: err.message } });
    }
  }

  public async listSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const currentRefreshToken = req.cookies?.refreshToken;
    const sessions = await sessionService.listSessions(req.user._id.toString(), currentRefreshToken);
    res.status(200).json({ success: true, data: sessions });
  }

  public async revokeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { familyId } = req.params;
    const ip = req.ip || req.socket.remoteAddress;
    await sessionService.revokeSession(familyId, req.user._id.toString(), ip);
    res.status(200).json({ success: true, data: { message: 'Session revoked successfully.' } });
  }

  public async logout(req: Request, res: Response): Promise<void> {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      try {
        const tokenHashValue = hashToken(rawToken);
        const record = await RefreshToken.findOne({ tokenHash: tokenHashValue });
        if (record) {
          await tokenService.revokeFamily(record.familyId, record.userId.toString());
        }
      } catch {}
    }
    clearAuthCookies(res);
    res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
  }

  public async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    await sessionService.revokeAllSessions(req.user._id.toString(), ip);
    clearAuthCookies(res);
    res.status(200).json({ success: true, data: { message: 'All active sessions have been terminated.' } });
  }

  public async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    
    // Find all workspaces the user has memberships in
    const memberships = await WorkspaceMember.find({ userId: req.user._id }).populate('workspaceId').lean();
    const workspaces = memberships
      .filter(m => m.workspaceId && (m.workspaceId as any).status !== 'SUSPENDED')
      .map(m => ({
        id: (m.workspaceId as any)._id,
        name: (m.workspaceId as any).name,
        role: m.role,
        plan: (m.workspaceId as any).plan?.key,
        status: (m.workspaceId as any).status
      }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          status: req.user.status,
          isEmailVerified: req.user.isEmailVerified,
          mfaEnabled: req.user.mfaEnabled,
          avatarUrl: req.user.avatarUrl
        },
        workspaces
      }
    });
  }

  public async updateMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    const { name } = req.body;
    const user = await accountService.updateProfile(req.user._id.toString(), { name }, ip);
    res.status(200).json({ success: true, data: { user } });
  }

  public async uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    const result = await accountService.uploadAvatar(req.user._id.toString(), req.file as any, ip);
    res.status(200).json({ success: true, data: result });
  }

  public async requestEmailChange(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'newEmail and currentPassword are required.' }
      });
      return;
    }
    const result = await accountService.requestEmailChange(
      req.user._id.toString(),
      newEmail,
      currentPassword,
      ip,
      userAgent
    );
    res.status(200).json({ success: true, data: result });
  }

  public async confirmEmailChange(req: Request, res: Response): Promise<void> {
    const ip = req.ip || req.socket.remoteAddress;
    const { token } = req.body;
    if (!token) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token is required.' }
      });
      return;
    }
    const result = await accountService.confirmEmailChange(token, ip);
    clearAuthCookies(res);
    res.status(200).json({ success: true, data: result });
  }

  public async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required.' }
      });
      return;
    }
    const result = await accountService.changePassword(
      req.user._id.toString(),
      currentPassword,
      newPassword,
      ip,
      userAgent
    );
    res.status(200).json({ success: true, data: result });
  }

  public async requestAccountDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { currentPassword } = req.body;
    const result = await accountService.requestAccountDeletion(
      req.user._id.toString(),
      currentPassword,
      ip,
      userAgent
    );
    res.status(200).json({ success: true, data: result });
  }
}

export const authController = new AuthController();
