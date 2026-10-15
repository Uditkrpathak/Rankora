import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { Location } from '../../models/Location';

/**
 * Validates that the requested locationId (:locId) exists and strictly belongs
 * to the authenticated workspace (req.workspace._id).
 *
 * Short-circuits with 404 LOCATION_NOT_FOUND before rate limits or LLM processing occur.
 */
export async function validateLocationInWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const locationId = req.params.locId;
  const workspaceId = req.workspace?._id;

  if (!workspaceId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No active workspace context resolved.' },
    });
    return;
  }

  if (!locationId) {
    res.status(400).json({
      success: false,
      error: { code: 'LOCATION_ID_REQUIRED', message: 'Location ID parameter is required.' },
    });
    return;
  }

  try {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      deletedAt: null,
    });

    if (!location) {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found in workspace.' },
      });
      return;
    }

    // Attach validated location for downstream usage
    req.location = location;
    next();
  } catch (err: any) {
    // If the MongoDB ObjectId format is invalid, handle gracefully as 404
    if (err.name === 'CastError') {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Invalid location ID format.' },
      });
      return;
    }
    next(err);
  }
}
