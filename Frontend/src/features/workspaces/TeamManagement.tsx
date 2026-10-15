import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  useListMembersQuery,
  useInviteMemberMutation,
  useChangeMemberRoleMutation,
  useRemoveMemberMutation,
} from '../../store/api/workspaceApi';
import { SettingsLayout } from '../settings/SettingsLayout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Users, Mail, UserPlus, Shield, Trash2, CheckCircle2, AlertCircle, Sparkles, UserCheck, ShieldAlert, X } from 'lucide-react';

const ROLE_DISPLAY_NAMES: Record<string, { label: string; badgeVariant: 'brand' | 'neutral' | 'success' }> = {
  owner: { label: 'Admin (Owner)', badgeVariant: 'brand' },
  admin: { label: 'Admin', badgeVariant: 'brand' },
  member: { label: 'Member', badgeVariant: 'neutral' },
  viewer: { label: 'Viewer', badgeVariant: 'neutral' },
};

export const TeamManagement: React.FC = () => {
  const toast = useToast();
  const activeWorkspace = useSelector((state: RootState) => state.auth.activeWorkspace);
  const workspaceId = activeWorkspace?.id || '';

  const { data, isLoading, refetch } = useListMembersQuery(workspaceId, { skip: !workspaceId });
  const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation();
  const [changeRole] = useChangeMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('admin');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const members = data?.data || [];

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await inviteMember({ workspaceId, email, role }).unwrap();
      setEmail('');
      setIsModalOpen(false);
      toast.success('Invitation sent successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.data?.error?.message || 'Could not send invitation.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await changeRole({ workspaceId, userId, role: newRole }).unwrap();
      toast.success('Member role updated');
      refetch();
    } catch (err: any) {
      toast.error(err.data?.error?.message || 'Failed to update role.');
    }
  };

  const handleRemove = async (userId: string) => {
    if (window.confirm('Remove this member from the workspace?')) {
      try {
        await removeMember({ workspaceId, userId }).unwrap();
        toast.success('Member removed');
        refetch();
      } catch (err: any) {
        toast.error(err.data?.error?.message || 'Failed to remove member.');
      }
    }
  };

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200/60">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Team & Collaborators
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-0.5 rounded-full">
                <Shield className="w-3 h-3 text-brand-600" />
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Manage team access permissions and client collaborator seats for <strong>{activeWorkspace?.name || 'this workspace'}</strong>.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>

        {message && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Members Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Member Name & Email</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Role & Status</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading team members...</div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No members found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m: any) => {
                const roleMeta = ROLE_DISPLAY_NAMES[m.role] || { label: m.role, badgeVariant: 'neutral' };
                const isOwner = m.role === 'owner';

                return (
                  <div key={m.id || m._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-2xs shrink-0">
                        {m.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{m.user?.name || 'Team Member'}</p>
                          {isOwner && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                              <Sparkles className="w-3 h-3 text-brand-500" /> Owner
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{m.user?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-auto">
                      {isOwner ? (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                          {roleMeta.label}
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user?._id || m.userId, e.target.value)}
                          className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition shadow-2xs cursor-pointer"
                        >
                          <option value="admin">Admin (Full Access)</option>
                          <option value="member">Member (Scan & Edit)</option>
                          <option value="viewer">Viewer (Read-Only)</option>
                        </select>
                      )}

                      {!isOwner && (
                        <button
                          onClick={() => handleRemove(m.user?._id || m.userId)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Invite Team Member"
          description="Send an invitation email to collaborate on this workspace."
          size="md"
        >
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@agency.com"
                  required
                  className="w-full pl-9 pr-3 h-8 rounded-md border border-slate-300 text-slate-900 text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Role
              </label>
              <select
                value={role}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="w-full px-3 h-8 rounded-md border border-slate-300 text-slate-900 text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white transition cursor-pointer"
              >
                <option value="admin">Admin (Full access to profiles, scans & settings)</option>
                <option value="member">Member (Can run scans & edit profile data)</option>
                <option value="viewer">Viewer (Read-only access to dashboards)</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isInviting}
              >
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </SettingsLayout>
  );
};
