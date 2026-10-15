import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { Location } from '../models/Location';

/**
 * Enforces that a location has ownershipVerified === true (or linked to an active GBP connection)
 * before allowing write actions (review replies, GBP attribute edits, post scheduling, sync, etc.)
 */
export async function requireLocationOwnership(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const locationId = req.params.locId || req.params.locationId || req.params.id || req.body?.locationId;
  const workspaceId = req.workspace?._id;

  if (!locationId || !workspaceId) {
    return next();
  }

  const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
  if (!location) {
    res.status(404).json({
      success: false,
      error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found.' }
    });
    return;
  }

  if (!location.ownershipVerified && !location.googleConnectionId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'GBP_OWNERSHIP_UNVERIFIED',
        message: 'This action requires verified ownership. Please connect this profile via Google OAuth to enable editing and replies.'
      }
    });
    return;
  }

  (req as any).targetLocation = location;
  next();
}
