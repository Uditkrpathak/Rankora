import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { Workspace } from '../models/Workspace';
import { Location } from '../models/Location';

class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Enforces plan limits before allowing resource creation.
 *
 * Two separate paths based on what's being limited:
 *
 * CREDITS (scanCredits, aiCredits):
 *   Atomic conditional decrement — race-condition-free. Only one writer
 *   can decrement past zero. Attaches req.creditField so a downstream
 *   failure handler can refund on error.
 *
 * LOCATIONS (count-based):
 *   Count check — has a documented TOCTOU gap where two truly concurrent
 *   requests can both pass and both create, producing a soft over-limit by 1.
 *   Acceptable here because location creation is not money-impacting (no
 *   credits are spent). A sparse atomic counter field would close the gap
 *   if it becomes a concern in production.
 */
export function requireWithinLimit(field: 'locations' | 'scanCredits' | 'aiCredits') {
  return async (
    req: AuthenticatedRequest & { creditField?: string },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const workspace = req.workspace;
    if (!workspace) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'resolveTenant must run before requireWithinLimit' },
      });
      return;
    }

    try {
      if (field === 'scanCredits' || field === 'aiCredits') {
        // ── Atomic conditional decrement ────────────────────────────────────
        const updated = await Workspace.findOneAndUpdate(
          { _id: workspace._id, [`limits.${field}`]: { $gt: 0 } },
          { $inc: { [`limits.${field}`]: -1 } },
          { new: true }
        );

        if (!updated) {
          res.status(402).json({
            success: false,
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `You've used all available ${field === 'scanCredits' ? 'scan credits' : 'AI credits'} on your current plan. Upgrade to continue.`,
            },
          });
          return;
        }

        // Tag request so a failure-path handler upstream can refund the credit
        req.creditField = field;
      } else {
        // ── Location count check ─────────────────────────────────────────────
        const isExempt =
          process.env.NODE_ENV === 'development' ||
          process.env.DISABLE_PLAN_LIMITS === 'true' ||
          (workspace as any).isQuotaExempt === true;

        if (!isExempt) {
          const count = await Location.countDocuments({
            workspaceId: workspace._id,
            deletedAt: null,
          });

          const limit = (workspace as any).limits?.locations ?? 1;

          if (limit !== -1 && count >= limit) {
            res.status(402).json({
              success: false,
              error: {
                code: 'LOCATION_LIMIT_EXCEEDED',
                message: `Your plan allows ${limit} location${limit === 1 ? '' : 's'}. Upgrade to add more.`,
              },
            });
            return;
          }
        }
      }

      next();
    } catch (err: any) {
      next(err);
    }
  };
}
