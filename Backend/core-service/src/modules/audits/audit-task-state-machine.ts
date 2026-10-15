import { AuditTaskStatus } from '@localo/types';

export type AuditTaskEvent =
  | 'USER_MARKED_DONE'
  | 'USER_REOPENED'
  | 'USER_DISMISSED'
  | 'AUDIT_SIGNAL_PASSED'
  | 'AUDIT_SIGNAL_FAILED';

export interface StateTransitionResult {
  previousStatus: AuditTaskStatus;
  newStatus: AuditTaskStatus;
  isRegression: boolean;
  isVerified: boolean;
}

/**
 * Deterministic State Machine for Audit Task Lifecycle & Regression Defense
 */
export class AuditTaskStateMachine {
  public static getNextStatus(
    currentStatus: AuditTaskStatus,
    event: AuditTaskEvent
  ): StateTransitionResult {
    // Normalize legacy 'DONE' to 'PENDING_VERIFICATION'
    const normalizedCurrent: AuditTaskStatus =
      currentStatus === 'DONE' ? 'PENDING_VERIFICATION' : currentStatus;

    let newStatus: AuditTaskStatus = normalizedCurrent;
    let isRegression = false;
    let isVerified = false;

    switch (normalizedCurrent) {
      case 'OPEN':
        if (event === 'USER_MARKED_DONE') {
          newStatus = 'PENDING_VERIFICATION';
        } else if (event === 'USER_DISMISSED') {
          newStatus = 'DISMISSED';
        } else if (event === 'AUDIT_SIGNAL_PASSED') {
          newStatus = 'VERIFIED';
          isVerified = true;
        } else if (event === 'AUDIT_SIGNAL_FAILED') {
          newStatus = 'OPEN';
        }
        break;

      case 'PENDING_VERIFICATION':
        if (event === 'AUDIT_SIGNAL_PASSED') {
          newStatus = 'VERIFIED';
          isVerified = true;
        } else if (event === 'AUDIT_SIGNAL_FAILED') {
          newStatus = 'OPEN';
        } else if (event === 'USER_REOPENED') {
          newStatus = 'OPEN';
        } else if (event === 'USER_DISMISSED') {
          newStatus = 'DISMISSED';
        }
        break;

      case 'VERIFIED':
        if (event === 'AUDIT_SIGNAL_FAILED') {
          newStatus = 'OPEN';
          isRegression = true;
        } else if (event === 'USER_REOPENED') {
          newStatus = 'OPEN';
        } else if (event === 'USER_DISMISSED') {
          newStatus = 'DISMISSED';
        } else if (event === 'AUDIT_SIGNAL_PASSED') {
          newStatus = 'VERIFIED';
          isVerified = true;
        }
        break;

      case 'DISMISSED':
        if (event === 'AUDIT_SIGNAL_FAILED') {
          // Resurrect dismissed tasks if the check regresses or re-fails in a future audit
          newStatus = 'OPEN';
          isRegression = true;
        } else if (event === 'USER_REOPENED') {
          newStatus = 'OPEN';
        } else if (event === 'AUDIT_SIGNAL_PASSED') {
          newStatus = 'VERIFIED';
          isVerified = true;
        }
        break;

      default:
        newStatus = 'OPEN';
    }

    return {
      previousStatus: currentStatus,
      newStatus,
      isRegression,
      isVerified,
    };
  }
}
