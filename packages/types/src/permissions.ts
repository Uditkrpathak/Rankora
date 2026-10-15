import { UserRole } from './auth';

export type Permission =
  | 'workspace.view'
  | 'workspace.update'
  | 'workspace.delete'
  | 'member.view'
  | 'member.invite'
  | 'member.changeRole'
  | 'member.remove'
  | 'location.view'
  | 'location.create'
  | 'location.update'
  | 'location.delete'
  | 'audit.view'
  | 'audit.run'
  | 'geo_scan.view'
  | 'geo_scan.run'
  | 'review.reply'
  | 'review.publish'
  | 'ai.draft.create'
  | 'ai.draft.approve'
  | 'billing.view'
  | 'billing.manage'
  | 'report.generate'
  | 'google.connect';

export type RolePermissionMap = Record<UserRole, Permission[]>;
