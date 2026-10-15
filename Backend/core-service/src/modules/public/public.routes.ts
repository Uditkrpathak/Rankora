import { Router } from 'express';
import { scanController } from '../rankings/scan.controller';
import { placesController } from '../places/places.controller';

export const publicRouter = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /v1/public/places/photo
publicRouter.get(
  '/places/photo',
  asyncHandler((req: any, res: any) => placesController.getPhoto(req, res))
);

// GET /v1/public/scans/:shareToken
publicRouter.get(
  '/scans/:shareToken',
  asyncHandler((req: any, res: any) => scanController.getPublicScan(req, res))
);
