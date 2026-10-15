import { AiDraftKind, AiDraftStatus } from './ai.types';

export function assertDraftTransition(status: AiDraftStatus, next: AiDraftStatus): void {
  const allowed: Record<AiDraftStatus, AiDraftStatus[]> = {
    PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
    APPROVED: ['PUBLISHING', 'REJECTED'],
    PUBLISHING: ['PUBLISHED', 'APPROVED'],
    PUBLICATION_UNCERTAIN: [],
    REJECTED: [],
    PUBLISHED: [],
  };
  if (!allowed[status]?.includes(next)) {
    throw Object.assign(new Error(`Draft cannot transition from ${status} to ${next}.`), { statusCode: 409, code: 'INVALID_DRAFT_TRANSITION' });
  }
}

export function assertDraftCanPublish(draft: { kind: AiDraftKind; status: AiDraftStatus }): void {
  if (draft.status !== 'APPROVED') {
    throw Object.assign(new Error('This AI draft must be approved before any Google write.'), { statusCode: 409, code: 'AI_DRAFT_APPROVAL_REQUIRED' });
  }
  if (draft.kind !== 'REVIEW_REPLY' && draft.kind !== 'GBP_POST') {
    throw Object.assign(new Error('This draft type does not support Google publishing.'), { statusCode: 400, code: 'AI_DRAFT_NOT_PUBLISHABLE' });
  }
}

export async function publishApprovedDraft<T>(
  draft: { kind: AiDraftKind; status: AiDraftStatus },
  writer: () => Promise<T>
): Promise<T> {
  assertDraftCanPublish(draft);
  return writer();
}
