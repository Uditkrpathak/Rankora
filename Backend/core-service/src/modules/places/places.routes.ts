import { Router } from 'express';
import { placesController } from './places.controller';
import {
  authenticate,
  resolveTenant,
  requirePermission,
} from '../../middleware/auth.middleware';

export const placesRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Public Google Places endpoints mounted under /v1/workspaces/:id/places
 */
placesRouter.get(
  '/photo',
  asyncHandler((req: any, res: any) => placesController.getPhoto(req, res))
);

placesRouter.get(
  '/search',
  authenticate,
  resolveTenant,
  asyncHandler((req: any, res: any) => placesController.search(req, res))
);

placesRouter.get(
  '/preview-keywords',
  authenticate,
  resolveTenant,
  asyncHandler((req: any, res: any) => placesController.previewKeywords(req, res))
);

placesRouter.post(
  '/add',
  authenticate,
  resolveTenant,
  requirePermission('location.create'),
  asyncHandler((req: any, res: any) => placesController.addFromSearch(req, res))
);

