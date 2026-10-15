export type AiDraftKind = 'DESCRIPTION' | 'AUDIT_EXPLANATION' | 'ACTION_DRAFT' | 'REVIEW_REPLY' | 'GBP_POST';
export type AiDraftStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHING' | 'PUBLICATION_UNCERTAIN' | 'REJECTED' | 'PUBLISHED';

export interface AiEvidenceFact {
  key: string;
  value: unknown;
  source: string;
  observedAt: Date;
  confidence: 'VERIFIED' | 'PUBLIC' | 'USER_PROVIDED';
  referenceId?: string;
  untrusted?: boolean;
}

export interface AiMissingEvidence {
  key: string;
  reason: 'MISSING' | 'STALE' | 'MOCK_EXCLUDED' | 'NOT_CONNECTED' | 'UNKNOWN_SIGNAL';
  expectedSources: string[];
  lastObservedAt?: Date;
}

export interface AiEvidenceBundle {
  used: AiEvidenceFact[];
  missing: AiMissingEvidence[];
}

export interface AiGenerationRequest {
  kind: AiDraftKind;
  evidence: AiEvidenceBundle;
  instruction: string;
  untrustedReviewText?: string;
  signalCode?: string;
}

export interface AiGenerationResult {
  text: string;
  provider: string;
  model: string;
}

export interface AiProvider {
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}
