import { Permission, RolePermissionMap, UserRole } from '@localo/types';

export const ALL_PERMISSIONS: Permission[] = [
  'workspace.view',
  'workspace.update',
  'workspace.delete',
  'member.view',
  'member.invite',
  'member.changeRole',
  'member.remove',
  'location.view',
  'location.create',
  'location.update',
  'location.delete',
  'audit.view',
  'audit.run',
  'geo_scan.view',
  'geo_scan.run',
  'review.reply',
  'review.publish',
  'ai.draft.create',
  'ai.draft.approve',
  'billing.view',
  'billing.manage',
  'report.generate',
  'google.connect'
];

export const ROLE_PERMISSIONS: RolePermissionMap = {
  owner: [...ALL_PERMISSIONS],
  admin: [
    'workspace.view',
    'workspace.update',
    'member.view',
    'member.invite',
    'member.changeRole',
    'member.remove',
    'location.view',
    'location.create',
    'location.update',
    'location.delete',
    'audit.view',
    'audit.run',
    'geo_scan.view',
    'geo_scan.run',
    'review.reply',
    'review.publish',
    'ai.draft.create',
    'ai.draft.approve',
    'billing.view',
    'report.generate',
    'google.connect'
  ],
  member: [
    'workspace.view',
    'member.view',
    'location.view',
    'location.create',
    'location.update',
    'audit.view',
    'audit.run',
    'geo_scan.view',
    'geo_scan.run',
    'review.reply',
    'ai.draft.create',
    'report.generate'
  ],
  viewer: [
    'workspace.view',
    'member.view',
    'location.view',
    'audit.view',
    'geo_scan.view'
  ]
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: string[]
): boolean {
  if (role === 'owner') return true;
  if (customPermissions && customPermissions.includes(permission)) return true;
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  return rolePerms.includes(permission);
}
