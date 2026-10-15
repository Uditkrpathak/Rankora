import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { chatService } from './chat.service';
import { businessContextService } from './business-context.service';
import { ChatRequestSchema } from './chat.schema';
import { evaluateGuardrails, OUT_OF_SCOPE_MESSAGE } from './guardrails.service';

export class ChatController {
  /**
   * POST /v1/workspaces/:id/locations/:locId/chat
   * Body: { message: string, conversationHistory?: [] }
   */
  public async handleMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    // 1. Zod schema validation & control character sanitization
    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message || 'Invalid chat request.',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const { message, conversationHistory } = parseResult.data;
    const location = req.location;

    // 2. Deterministic Guardrails Evaluation ($0 cost)
    const guardrail = evaluateGuardrails(message);
    if (!guardrail.allowed) {
      const blockedAnswer = guardrail.blockedMessage || OUT_OF_SCOPE_MESSAGE;
      res.json({
        success: true,
        data: {
          answer: blockedAnswer,
          source: 'blocked',
          badge: null,
          reply: blockedAnswer,
          suggestions: [
            'What are customers saying about my service?',
            'How do I compare to my top competitors?',
            'Which keywords should I focus on?',
            'Draft an SEO update post for Google Maps',
          ],
          intent: 'blocked',
          businessName: location?.name || 'Your Business',
        },
      });
      return;
    }

    // 3. Process chat query through service
    try {
      if (req.user) {
        const { userLimitsService } = await import('../admin/user-limits.service');
        await userLimitsService.assertAndIncrementChatbot(req.user._id.toString());
      }

      const response = await chatService.handleChat(
        req.params.id,
        req.params.locId,
        {
          message,
          conversationHistory,
        },
        req.user?.id
      );

      res.json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      if (err?.code === 'QUOTA_EXCEEDED') {
        // Prevent misleading short Retry-After headers from rate limiters
        res.removeHeader('Retry-After');
        res.status(429).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: err.message || 'Monthly AI Copilot quota exceeded for your workspace.',
            limit: err.limit,
            used: err.used,
            resetsAt: err.resetsAt,
          },
        });
        return;
      }
      throw err;
    }
  }

  /**
   * GET /v1/workspaces/:id/locations/:locId/chat/dossier
   * Returns complete real-time dossier summary of the business.
   */
  public async getDossier(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dossier = await businessContextService.getBusinessDossier(req.params.id, req.params.locId);

    if (!dossier) {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found in workspace.' },
      });
      return;
    }

    res.json({
      success: true,
      data: dossier,
    });
  }
}

export const chatController = new ChatController();
