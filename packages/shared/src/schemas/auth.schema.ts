import { z } from 'zod';
import zxcvbn from 'zxcvbn';
import { COMMON_PASSWORDS } from '../constants/security';

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine(
    (pwd) => {
      if (COMMON_PASSWORDS.has(pwd.toLowerCase())) return false;
      const evaluation = zxcvbn(pwd, ['rankora', 'localo']);
      return evaluation.score >= 3;
    },
    'This password is too easily guessed or contains common dictionary words. Please choose a stronger password.'
  );

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or fewer')
    .regex(/^[\p{L}\p{N}\s'\-\.]+$/u, 'Name can only contain letters, numbers, spaces, hyphens, and apostrophes')
    .refine((name) => /\p{L}/u.test(name), 'Name must include at least one letter'),
  email: z.string().trim().email('Invalid email address').max(100, 'Email must be 100 characters or fewer').toLowerCase(),
  password: passwordRule,
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(60).optional(),
  captchaToken: z.string().optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional()
});

export type LoginInput = z.infer<typeof loginSchema>;

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
  workspaceName: z.string().trim().optional()
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase()
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase()
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordRule
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const mfaVerifySchema = z.object({
  code: z.string().trim().min(6, 'Verification code must be at least 6 characters')
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaChallengeSchema = z.object({
  mfaChallengeToken: z.string().min(1, 'MFA challenge token is required'),
  code: z.string().trim().min(6, 'Verification code or backup code is required')
});

export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters')
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['admin', 'member', 'viewer'])
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required')
});

export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceSchema>;
