import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../../config/redis';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { Response, NextFunction } from 'express';

const CHAT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CHAT_MAX_MESSAGES = 20; // 20 messages per fixed window

/**
 * Creates Redis store for chat rate limiting when Redis is connected.
 * Falls back safely to memory store in local testing or offline environments.
 */
function createChatRedisStore() {
  if (redisClient.status === 'ready') {
    try {
      return new RedisStore({
        sendCommand: (...args: string[]) => (redisClient as any).call(...args),
        prefix: 'rl:chat_user:',
      });
    } catch {
      // Memory store fallback if Redis call fails
    }
  }
  return undefined;
}

/**
 * Fixed-Window Rate Limiter for Chatbot:
 * - Runs strictly AFTER `authenticate` middleware.
 * - Keys primarily on `req.user._id` (authenticated user identity).
 * - Falls back to client IP only if user is somehow unpopulated.
 * - Operates on a standard FIXED 15-minute window (reset every 15 minutes).
 * - Enforces a strict ceiling of 20 chat messages per user per window.
 * - Responds with HTTP 429 and `retryAfter` (seconds until window reset).
 */
const rawChatRateLimiter = rateLimit({
  windowMs: CHAT_WINDOW_MS,
  max: CHAT_MAX_MESSAGES,
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false,
  store: createChatRedisStore(),
  keyGenerator: (req: AuthenticatedRequest) => {
    // Primary key: authenticated user ID
    if (req.user?._id) {
      return req.user._id.toString();
    }
    // Secondary fallback: IP address
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'anonymous'
    );
  },
  handler: (req: AuthenticatedRequest, res: Response, _next: NextFunction, options) => {
    // Calculate seconds remaining until the fixed window resets
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);

    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many chat messages. You have reached the limit of ${CHAT_MAX_MESSAGES} messages per 15 minutes. Please try again later.`,
        retryAfter,
      },
    });
  },
});

/**
 * Chat Rate Limiter Wrapper:
 * Ensures fail-open resilience. If Redis experiences transient downtime or connectivity drops,
 * it logs a warning and calls next(), ensuring valid users are never blocked due to Redis issues.
 */
export function chatRateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  rawChatRateLimiter(req, res, (err?: any) => {
    if (err) {
      console.warn('⚠️ [ChatRateLimiter] Rate limiter store error — failing open to preserve chat availability:', err.message);
      return next();
    }
    next();
  });
}

