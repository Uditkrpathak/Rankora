import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { Request, Response, NextFunction } from 'express';

function getRedisStore(prefix: string) {
  if (redisClient.status === 'ready') {
    try {
      return new RedisStore({
        sendCommand: (...args: string[]) => (redisClient as any).call(...args),
        prefix: `rl:${prefix}:`,
      });
    } catch {}
  }
  return undefined;
}

/**
 * Fail-closed security guard: in production, sensitive auth routes (register, login)
 * fail closed (503 Service Unavailable) if Redis rate-limiting is unreachable.
 */
export function failClosedIfRedisDown(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production' && redisClient.status !== 'ready') {
    res.status(503).json({
      success: false,
      error: {
        code: 'AUTH_STORE_UNAVAILABLE',
        message: 'Authentication service temporarily unavailable: security rate limiter requires active Redis connection.',
      },
    });
    return;
  }
  next();
}

/**
 * Per-email failure tracker across all IPs.
 * Instead of hard-locking an account (which causes Denial of Service for victims),
 * it introduces an exponential delay and triggers CAPTCHA requirements once failures accumulate.
 */
export async function trackEmailFailure(email: string): Promise<{ failureCount: number; delayMs: number; requireCaptcha: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `ratelimit:email_fail:${normalizedEmail}`;

  if (redisClient.status === 'ready') {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, 15 * 60); // 15 minute sliding window
      }
      const delayMs = count >= 3 ? Math.min((count - 2) * 500, 2000) : 0;
      const requireCaptcha = count >= 5;
      return { failureCount: count, delayMs, requireCaptcha };
    } catch {}
  }

  return { failureCount: 0, delayMs: 0, requireCaptcha: false };
}

export async function resetEmailFailure(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `ratelimit:email_fail:${normalizedEmail}`;
  if (redisClient.status === 'ready') {
    try {
      await redisClient.del(key);
    } catch {}
  }
}

/**
 * Strict rate limiter for sensitive authentication endpoints (Register, Login, Password Reset).
 * Protects against credential stuffing, brute force, and account enumeration botnets.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per IP per window
  standardHeaders: true, // Draft-6 RateLimit headers
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: getRedisStore('auth'),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts from this IP address. Please try again in 15 minutes.',
    },
  },
});

/**
 * Very strict rate limiter for account registration to prevent bulk account creation.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8, // Max 8 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('register'),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REGISTRATIONS',
      message: 'Registration limit reached for this IP address. Please try again later or contact support.',
    },
  },
});

/**
 * Password reset and verification email rate limiter.
 * Prevents email inbox spamming and Resend/SendGrid quota exhaustion.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('reset'),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_RESET_REQUESTS',
      message: 'Too many reset/verification requests. Please check your email or wait an hour.',
    },
  },
});

/**
 * Global standard API rate limiter for general endpoint protection.
 */
export const apiGlobalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/health' ||
    req.path === '/ready' ||
    req.path === '/metrics' ||
    req.path.startsWith('/v1/webhooks'),
  message: {
    success: false,
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'API rate limit exceeded. Please throttle your requests.',
    },
  },
});
