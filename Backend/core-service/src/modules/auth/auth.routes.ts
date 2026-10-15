import { Router } from 'express';
import multer from 'multer';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireDevEnvironment } from '../../middleware/requireDevEnvironment';
import {
  authRateLimiter,
  emailAuthRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
  failClosedIfRedisDown,
} from '../../middleware/rate-limit.middleware';

export const authRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Public auth endpoints protected by rate limiting & fail-closed guards
authRouter.get('/public-config', asyncHandler((req: any, res: any) => authController.getPublicConfig(req, res)));
authRouter.post('/register', failClosedIfRedisDown, registerRateLimiter, asyncHandler((req: any, res: any) => authController.register(req, res)));
authRouter.post('/login', failClosedIfRedisDown, authRateLimiter, emailAuthRateLimiter, asyncHandler((req: any, res: any) => authController.login(req, res)));
authRouter.post('/admin-login', failClosedIfRedisDown, authRateLimiter, emailAuthRateLimiter, asyncHandler((req: any, res: any) => authController.adminLogin(req, res)));
authRouter.post('/change-password', authenticate, asyncHandler((req: any, res: any) => authController.changePassword(req, res)));
authRouter.post('/google', failClosedIfRedisDown, authRateLimiter, asyncHandler((req: any, res: any) => authController.googleLogin(req, res)));
authRouter.post('/refresh', asyncHandler((req: any, res: any) => authController.refresh(req, res)));
authRouter.post('/logout', asyncHandler((req: any, res: any) => authController.logout(req, res)));
authRouter.post('/verify-email', asyncHandler((req: any, res: any) => authController.verifyEmail(req, res)));
authRouter.post('/resend-verification', passwordResetRateLimiter, asyncHandler((req: any, res: any) => authController.resendVerification(req, res)));
authRouter.post('/forgot-password', passwordResetRateLimiter, asyncHandler((req: any, res: any) => authController.forgotPassword(req, res)));
authRouter.post('/reset-password', passwordResetRateLimiter, asyncHandler((req: any, res: any) => authController.resetPassword(req, res)));
authRouter.post('/mfa/challenge', authRateLimiter, asyncHandler((req: any, res: any) => authController.mfaChallenge(req, res)));
authRouter.post('/me/email/confirm-change', asyncHandler((req: any, res: any) => authController.confirmEmailChange(req, res)));

// Dev-only instant verification bypass (Guarded by requireDevEnvironment returning 404 in prod/when disabled)
authRouter.post('/dev/verify-now', authenticate, requireDevEnvironment, asyncHandler((req: any, res: any) => authController.devBypassVerify(req, res)));

// Authenticated session & MFA endpoints
authRouter.get('/me', authenticate, asyncHandler((req: any, res: any) => authController.getMe(req, res)));
authRouter.patch('/me', authenticate, asyncHandler((req: any, res: any) => authController.updateMe(req, res)));
authRouter.post('/me/avatar', authenticate, upload.single('avatar'), asyncHandler((req: any, res: any) => authController.uploadAvatar(req, res)));
authRouter.post('/me/email/request-change', authenticate, asyncHandler((req: any, res: any) => authController.requestEmailChange(req, res)));
authRouter.post('/me/password', authenticate, asyncHandler((req: any, res: any) => authController.changePassword(req, res)));
authRouter.post('/me/delete-request', authenticate, asyncHandler((req: any, res: any) => authController.requestAccountDeletion(req, res)));
authRouter.post('/logout-all', authenticate, asyncHandler((req: any, res: any) => authController.logoutAll(req, res)));
authRouter.get('/sessions', authenticate, asyncHandler((req: any, res: any) => authController.listSessions(req, res)));
authRouter.delete('/sessions/:familyId', authenticate, asyncHandler((req: any, res: any) => authController.revokeSession(req, res)));
authRouter.post('/mfa/enroll', authenticate, asyncHandler((req: any, res: any) => authController.mfaEnroll(req, res)));
authRouter.post('/mfa/verify', authenticate, asyncHandler((req: any, res: any) => authController.mfaVerify(req, res)));
