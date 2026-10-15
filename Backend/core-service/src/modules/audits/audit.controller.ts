import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { auditService } from './audit.service';

export class AuditController {
  public async runLocationAudit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;

    try {
      const audit = await auditService.runAudit(locationId, workspaceId);
      res.status(201).json({
        success: true,
        data: audit,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: 'AUDIT_RUN_FAILED', message: err.message },
      });
    }
  }

  public async getAudit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const auditId = req.params.auditId;

    const audit = await auditService.getAuditById(auditId, workspaceId);
    if (!audit) {
      res.status(404).json({ error: { code: 'AUDIT_NOT_FOUND', message: 'Audit report not found' } });
      return;
    }

    res.json({
      success: true,
      data: audit,
    });
  }

  public async listLocationAudits(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const audits = await auditService.getLocationAudits(locationId, workspaceId, limit);
    res.json({
      success: true,
      data: audits,
    });
  }

  public async recalculateAudit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const auditId = req.params.auditId;

    try {
      const updated = await auditService.recalculateAudit(auditId, workspaceId);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      res.status(400).json({
        error: { code: 'AUDIT_RECALCULATE_FAILED', message: err.message },
      });
    }
  }

  public async listLocationTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const tasks = await auditService.getLocationTasks(req.params.locId, req.params.id);
    res.json({ success: true, data: tasks });
  }

  public async updateTaskStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const status = req.body?.status;
    if (status !== 'OPEN' && status !== 'DONE') {
      res.status(400).json({ error: { code: 'INVALID_TASK_STATUS', message: 'Status must be OPEN or DONE.' } });
      return;
    }
    const task = await auditService.updateTaskStatus(req.params.taskId, req.params.id, status);
    if (!task) {
      res.status(404).json({ error: { code: 'AUDIT_TASK_NOT_FOUND', message: 'Audit task not found.' } });
      return;
    }
    res.json({ success: true, data: task });
  }

  public async setLocationAuditSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: { code: 'INVALID_AUDIT_SCHEDULE', message: 'Enabled must be true or false.' } });
      return;
    }
    const location = await auditService.setAuditSchedule(req.params.locId, req.params.id, enabled);
    if (!location) {
      res.status(404).json({ error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found in workspace.' } });
      return;
    }
    res.json({ success: true, data: { enabled: location.auditScheduleEnabled, nextAuditAt: location.nextAuditAt } });
  }
}

export const auditController = new AuditController();
