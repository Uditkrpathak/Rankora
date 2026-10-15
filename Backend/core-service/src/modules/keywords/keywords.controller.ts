import { Request, Response } from 'express';
import { keywordsService } from './keywords.service';
import { suggestionsService } from './suggestions.service';
import { BulkAddKeywordsSchema, ListKeywordsQuerySchema, UpdateTrackedKeywordSchema } from './keywords.schema';

export class KeywordsController {
  /**
   * Bulk add keywords
   */
  public async bulkAddKeywords(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const actorUserId = (req as any).user?.id || (req as any).user?._id;
    const ip = req.ip;

    const validated = BulkAddKeywordsSchema.parse(req.body);

    const result = await keywordsService.bulkAddKeywords(
      workspaceId,
      locationId,
      validated.keywords,
      actorUserId,
      ip
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * List tracked keywords
   */
  public async listKeywords(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;

    const query = ListKeywordsQuerySchema.parse(req.query);

    const result = await keywordsService.listKeywords(workspaceId, locationId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  public async updateKeyword(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const keywordId = req.params.keywordId as string;
    const actorUserId = (req as any).user?.id || (req as any).user?._id;
    const settings = UpdateTrackedKeywordSchema.parse(req.body);
    const keyword = await keywordsService.updateKeywordSettings(
      workspaceId,
      locationId,
      keywordId,
      settings,
      actorUserId,
      req.ip
    );

    res.status(200).json({ success: true, data: keyword });
  }

  /**
   * Delete a tracked keyword
   */
  public async deleteKeyword(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const keywordId = req.params.keywordId as string;
    const actorUserId = (req as any).user?.id || (req as any).user?._id;
    const ip = req.ip;

    await keywordsService.deleteKeyword(workspaceId, locationId, keywordId, actorUserId, ip);

    res.status(200).json({
      success: true,
      message: 'Keyword deleted successfully.',
    });
  }

  /**
   * Refresh single keyword scan
   */
  public async refreshKeyword(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const keywordId = req.params.keywordId as string;
    const actorUserId = (req as any).user?.id || (req as any).user?._id;
    const ip = req.ip;

    const result = await keywordsService.refreshKeyword(
      workspaceId,
      locationId,
      keywordId,
      actorUserId,
      ip
    );

    res.status(202).json({
      success: true,
      data: result,
    });
  }

  /**
   * Stream export keywords as CSV
   */
  public async exportKeywords(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;

    await keywordsService.exportKeywordsCsv(workspaceId, locationId, res);
  }

  /**
   * Pre-scan keyword relevance check
   */
  public async probeKeywordPreScan(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const keyword = (req.query.keyword || req.body.keyword) as string;

    if (!keyword || !keyword.trim()) {
      res.status(400).json({ success: false, message: 'Keyword is required' });
      return;
    }

    const result = await keywordsService.probeKeywordPreScan(workspaceId, locationId, keyword.trim());
    res.status(200).json({ success: true, data: result });
  }

  /**
   * Get zero-cost multi-locality keyword suggestions
   */
  public async getSuggestions(req: Request, res: Response): Promise<void> {
    const workspaceId = (req.params.id || req.params.workspaceId) as string;
    const locationId = req.params.locationId as string;
    const hl = (req.query.hl === 'hi' ? 'hi' : 'en') as 'en' | 'hi';

    const result = await suggestionsService.getSuggestionsForLocation(locationId, workspaceId, hl);
    res.status(200).json({
      success: true,
      data: result.data,
      cached: result.cached,
    });
  }
}

export const keywordsController = new KeywordsController();
