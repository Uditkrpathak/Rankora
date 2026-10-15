export type AuditPillar = 'CATEGORIES' | 'NAP_CORE' | 'HOURS' | 'CONTENT' | 'VISUALS' | 'REPUTATION' | 'ENGAGEMENT' | 'ATTRIBUTES' | 'TECHNICAL';

export type SignalSeverity = 'CRITICAL' | 'WARNING' | 'OPTIMIZATION' | 'PASS' | 'UNKNOWN';

export type AuditTaskStatus = 'OPEN' | 'PENDING_VERIFICATION' | 'DONE' | 'VERIFIED' | 'DISMISSED';

export interface ISchemaVerification {
  verified: boolean;
  verifiedAt: Date;
  detectedTypes: string[];
  verificationMethod: 'automated_crawler' | 'manual_audit';
  rawSnippet?: string;
  error?: string;
}

export interface IAuditTask {
  _id: string;
  workspaceId: string;
  locationId: string;
  auditId: string;
  signalCode: string;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  destination: string;
  impact: number;
  status: AuditTaskStatus;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditSignal {
  code: string; // e.g. 'CAT-01', 'WEB-04'
  name: string;
  pillar: AuditPillar;
  weight: number;
  score: number; // 0 to weight
  severity: SignalSeverity;
  passed: boolean;
  actualValue?: any;
  recommendedValue?: any;
  remediationTip: string;
  evidenceSource?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  explanation?: string;
}

export interface IAuditCategoryScore {
  pillar: AuditPillar;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface IAuditRun {
  _id: string;
  workspaceId: string;
  locationId: string;
  auditVersion: string; // e.g. '1.0'
  rulesVersion: string; // e.g. '2026.1'
  score: number; // 0 to 100
  categoryScores: IAuditCategoryScore[];
  signals: IAuditSignal[];
  summary: {
    criticalCount: number;
    warningCount: number;
    optimizationCount: number;
    passedCount: number;
    unknownCount: number;
  };
  recalculatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tasks?: IAuditTask[];
}
