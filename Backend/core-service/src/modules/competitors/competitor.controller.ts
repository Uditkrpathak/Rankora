import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { competitorService } from './competitor.service';

export class CompetitorController {
  public async listCompetitors(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    try {
      const competitors = await competitorService.listCompetitors(locationId, workspaceId, limit);
      res.json({
        success: true,
        data: competitors,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: 'COMPETITORS_FETCH_FAILED', message: err.message },
      });
    }
  }

  public async getBenchmark(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;

    try {
      const benchmark = await competitorService.getBenchmark(locationId, workspaceId);
      res.json({
        success: true,
        data: benchmark,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: 'BENCHMARK_FETCH_FAILED', message: err.message },
      });
    }
  }
}

export const competitorController = new CompetitorController();
