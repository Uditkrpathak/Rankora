import { Router } from 'express';
import { keywordsController } from './keywords.controller';
import { authenticate, resolveTenant, requirePermission } from '../../middleware/auth.middleware';

export const keywordsRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All keyword routes are protected by workspace authentication and tenant context
keywordsRouter.use(authenticate);
keywordsRouter.use(resolveTenant);

keywordsRouter.get(
  '/locations/:locationId/keywords',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.listKeywords(req, res))
);

keywordsRouter.post(
  '/locations/:locationId/keywords',
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => keywordsController.bulkAddKeywords(req, res))
);

keywordsRouter.patch(
  '/locations/:locationId/keywords/:keywordId',
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => keywordsController.updateKeyword(req, res))
);

keywordsRouter.get(
  '/locations/:locationId/keyword-suggestions',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.getSuggestions(req, res))
);

keywordsRouter.get(
  '/locations/:locationId/keywords/suggestions',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.getSuggestions(req, res))
);

keywordsRouter.get(
  '/locations/:locationId/keywords/export',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.exportKeywords(req, res))
);

keywordsRouter.get(
  '/locations/:locationId/keywords/probe-check',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.probeKeywordPreScan(req, res))
);

keywordsRouter.post(
  '/locations/:locationId/keywords/probe-check',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => keywordsController.probeKeywordPreScan(req, res))
);

keywordsRouter.post(
  '/locations/:locationId/keywords/:keywordId/refresh',
  requirePermission('geo_scan.run'),
  asyncHandler((req: any, res: any) => keywordsController.refreshKeyword(req, res))
);

keywordsRouter.delete(
  '/locations/:locationId/keywords/:keywordId',
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => keywordsController.deleteKeyword(req, res))
);
