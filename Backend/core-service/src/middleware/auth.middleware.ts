import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWTPayload, Permission, UserRole } from '@localo/types';
import { ROLE_PERMISSIONS, hasPermission } from '@localo/shared';
import { ENV } from '../config/env';
import { User, UserDocument } from '../models/User';
import { Workspace, WorkspaceDocument } from '../models/Workspace';
import { WorkspaceMember, WorkspaceMemberDocument } from '../models/WorkspaceMember';
import { LocationDocument } from '../models/Location';
import { tokenService } from '../modules/auth/token.service';

export interface AuthenticatedRequest extends Request {
  user?: UserDocument;
  workspace?: WorkspaceDocument;
  membership?: WorkspaceMemberDocument;
  permissions?: Permission[];
  location?: LocationDocument;
  correlationId?: string;
}

/**
 * Validates Access JWT and verifies session epoch
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    // Restrict query parameter authentication strictly to SSE streaming routes (/stream)
    // where standard EventSource cannot attach custom Authorization HTTP headers.
    const fullPath = (req.baseUrl || '') + (req.path || '');
    const isSseRoute = fullPath.endsWith('/stream');
    if (isSseRoute) {
      token = req.query.token.trim();
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header or token query' }
    });
    return;
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as JWTPayload;
    
    if (payload.type !== 'access') {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN_TYPE', message: 'Token is not an access token' }
      });
      return;
    }

    // Check active session version in Redis/DB
    const activeVersion = await tokenService.getSessionVersion(payload.sub);
    if (payload.sessionVersion !== activeVersion) {
      res.status(401).json({
        success: false,
        error: { code: 'SESSION_REVOKED', message: 'Session has been invalidated. Please log in again.' }
      });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user || user.status === 'DELETED') {
      res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found or deleted' }
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Access token expired or invalid', details: err.message }
    });
  }
}

/**
 * Dynamically resolves workspace membership and maps fine-grained permissions
 */
export async function resolveTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User must be authenticated' } });
    return;
  }

  const targetWorkspaceId = (req.params?.id as string) || (req.headers['x-workspace-id'] as string);
  let member: WorkspaceMemberDocument | null = null;

  if (targetWorkspaceId) {
    member = await WorkspaceMember.findOne({
      workspaceId: targetWorkspaceId,
      userId: req.user._id
    });
  } else {
    // Default to the first workspace the user belongs to
    member = await WorkspaceMember.findOne({ userId: req.user._id });
  }

  if (!member) {
    res.status(404).json({
      success: false,
      error: { code: 'WORKSPACE_NOT_FOUND', message: 'No accessible workspace found for this user' }
    });
    return;
  }

  const workspace = await Workspace.findById(member.workspaceId);
  if (!workspace || workspace.status === 'SUSPENDED') {
    res.status(404).json({
      success: false,
      error: { code: 'WORKSPACE_UNAVAILABLE', message: 'Workspace is suspended or unavailable' }
    });
    return;
  }

  req.workspace = workspace;
  req.membership = member;

  // Resolve dynamic permissions
  const rolePerms = ROLE_PERMISSIONS[member.role] || [];
  const customPerms = (member.customPermissions || []) as Permission[];
  req.permissions = Array.from(new Set([...rolePerms, ...customPerms]));

  next();
}

/**
 * Gate on fine-grained permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.permissions || !req.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Missing required permission: ${permission}`
        }
      });
      return;
    }
    next();
  };
}

/**
 * Gates paid or mutating actions if email is not verified yet
 */
export function requireVerifiedEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.status === 'PENDING_VERIFICATION' || !req.user?.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address to unlock workspace actions and activate your trial.'
      }
    });
    return;
  }
  next();
}

/**
 * Double-submit CSRF verification middleware for state-changing requests.
 * Uses crypto.timingSafeEqual for constant-time comparison to protect against side-channel timing attacks.
 */
export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Public unauthenticated routes and webhooks are exempt from CSRF
  const reqPath = (req.originalUrl || req.url || '').split('?')[0];
  if (
    reqPath.startsWith('/v1/auth/register') ||
    reqPath.startsWith('/v1/auth/login') ||
    reqPath.startsWith('/v1/auth/google') ||
    reqPath.startsWith('/v1/auth/refresh') ||
    reqPath.startsWith('/v1/auth/forgot-password') ||
    reqPath.startsWith('/v1/auth/reset-password') ||
    reqPath.startsWith('/v1/auth/verify-email') ||
    reqPath.startsWith('/v1/auth/resend-verification') ||
    reqPath.startsWith('/v1/auth/mfa/challenge') ||
    reqPath.startsWith('/v1/webhooks') ||
    reqPath.startsWith('/v1/public') ||
    reqPath.startsWith('/v1/mcp') ||
    reqPath.startsWith('/api/mcp')
  ) {
    return next();
  }

  const cookieToken = req.cookies?.csrfToken;
  if (cookieToken && typeof cookieToken === 'string') {
    const headerToken = req.headers['x-csrf-token'];
    if (!headerToken || typeof headerToken !== 'string') {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'Missing or malformed X-CSRF-Token header.'
        }
      });
      return;
    }

    const headerBuf = Buffer.from(headerToken);
    const cookieBuf = Buffer.from(cookieToken);

    if (headerBuf.length !== cookieBuf.length || !crypto.timingSafeEqual(headerBuf, cookieBuf)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token validation failed.'
        }
      });
      return;
    }
  }

  next();
}

