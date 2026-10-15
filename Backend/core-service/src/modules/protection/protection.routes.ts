import { Router, Request, Response } from 'express';
import { protectionController } from './protection.controller';
import { authenticate, resolveTenant } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(resolveTenant);

router.get('/locations/:locationId/protection', (req: Request, res: Response) => {
  const workspaceId = (req.params as any).id || (req.params as any).workspaceId;
  (req.params as any).workspaceId = workspaceId;
  return protectionController.getStatus(req, res);
});

router.post('/locations/:locationId/protection/check', (req: Request, res: Response) => {
  const workspaceId = (req.params as any).id || (req.params as any).workspaceId;
  (req.params as any).workspaceId = workspaceId;
  return protectionController.runCheck(req, res);
});

router.post('/locations/:locationId/protection/incidents/:incidentId/resolve', (req: Request, res: Response) => {
  const workspaceId = (req.params as any).id || (req.params as any).workspaceId;
  (req.params as any).workspaceId = workspaceId;
  return protectionController.resolveIncident(req, res);
});

export default router;
