import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../../middleware/auth.middleware';
import { blockSuspended } from '../../middleware/platform.middleware';
import { userLimitsService } from './user-limits.service';

export const meLimitsRouter = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

meLimitsRouter.use(authenticate);
meLimitsRouter.use(blockSuspended);

meLimitsRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const limitsData = await userLimitsService.getUserEffectiveLimits(req.user);
    res.status(200).json({
      success: true,
      data: limitsData
    });
  })
);
