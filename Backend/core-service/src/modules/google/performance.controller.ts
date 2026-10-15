import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { gbpPerformanceService } from './performance.service';

function parseDays(value: unknown): number {
  const days = value === undefined ? 90 : Number(value);
  if (![30, 90, 180].includes(days)) {
    throw Object.assign(new Error('Choose a 30, 90, or 180 day range.'), { statusCode: 400, code: 'INVALID_PERFORMANCE_RANGE' });
  }
  return days;
}

export class PerformanceController {
  public async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const days = parseDays(req.query.days);
    const data = await gbpPerformanceService.getHistory(req.params.id, req.params.locId, days);
    res.json({ success: true, data, meta: { source: 'GOOGLE_BUSINESS_PROFILE', days } });
  }

  public async refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
    const days = parseDays(req.body?.days);
    const result = await gbpPerformanceService.refresh(req.params.id, req.params.locId, days);
    res.json({ success: true, data: result });
  }
}

export const performanceController = new PerformanceController();
