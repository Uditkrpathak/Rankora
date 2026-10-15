import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import {
  useListAdminsQuery,
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useDeleteAdminMutation
} from '../../store/api/adminApi';
import {
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sliders,
  Trash2,
  ExternalLink,
  Activity,
  KeyRound,
  Edit2,
  X,
  AlertTriangle
} from 'lucide-react';

export const AdminAdminsPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useListAdminsQuery();
  const [createAdmin, { isLoading: isCreating }] = useCreateAdminMutation();
  const [updateAdmin, { isLoading: isUpdating }] = useUpdateAdminMutation();
  const [deleteAdmin, { isLoading: isDeleting }] = useDeleteAdminMutation();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => {} });

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    tempPassword: '',
    permissions: {
      canScan: true,
      canUseChatbot: true,
      canUseGeoGrid: true,
      canUseCompetitorMatrix: true,
      canExportPdf: true,
      canInviteTeam: true,
      canUseApi: true
    }
  });
  const [createdAdminResult, setCreatedAdminResult] = useState<{ email: string; tempPass: string } | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({
    canScan: true,
    canUseChatbot: true,
    canUseGeoGrid: true,
    canUseCompetitorMatrix: true,
    canExportPdf: true,
    canInviteTeam: true,
    canUseApi: true
  });
  const [editName, setEditName] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const admins = data?.data?.items || [];

  const PERMISSION_FLAGS = [
    { key: 'canScan', label: 'Rank & Keyword Scanning', desc: 'Run on-demand keyword scans' },
    { key: 'canUseChatbot', label: 'AI Business Assistant', desc: 'Interact with AI business assistant' },
    { key: 'canUseGeoGrid', label: 'Geo-Grid Visualizer', desc: 'View and run geo-grid heatmaps' },
    { key: 'canUseCompetitorMatrix', label: 'Competitor Matrix', desc: 'Benchmark against top local competitors' },
    { key: 'canExportPdf', label: 'PDF Export', desc: 'Generate and export client PDF reports' },
    { key: 'canInviteTeam', label: 'Team Invitations', desc: 'Invite and manage team members' },
    { key: 'canUseApi', label: 'API & MCP Access', desc: 'Access Model Context Protocol API keys' }
  ];

  // Submit Create Admin with Confirmation
  const promptCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmModal({
      open: true,
      title: 'Confirm Administrator Creation',
      description: `Create administrator account for ${createForm.name} (${createForm.email})? A temporary password will be generated and they will be required to change it on first login.`,
      action: async () => {
        setErrorMsg(null);
        try {
          const res = await createAdmin(createForm).unwrap();
          setCreatedAdminResult({
            email: createForm.email,
            tempPass: res.data?.temporaryPassword || createForm.tempPassword || 'Generated'
          });
          showToast(`Admin ${createForm.name} created successfully.`);
          setCreateForm({
            name: '',
            email: '',
            tempPassword: '',
            permissions: {
              canScan: true,
              canUseChatbot: true,
              canUseGeoGrid: true,
              canUseCompetitorMatrix: true,
              canExportPdf: true,
              canInviteTeam: true,
              canUseApi: true
            }
          });
          refetch();
        } catch (err: any) {
          const msg = err?.data?.error?.message || err.message || 'Failed to create administrator';
          setErrorMsg(msg);
          showToast(`Error: ${msg}`);
        }
      }
    });
  };

  // Toggle Admin Status with Confirmation
  const promptToggleAdminStatus = (admin: any) => {
    const newStatus = admin.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setConfirmModal({
      open: true,
      title: `${newStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'} Administrator`,
      description: `Are you sure you want to change status of administrator ${admin.name} to ${newStatus}? ${
        newStatus === 'SUSPENDED' ? 'All active sessions and refresh tokens will be immediately revoked.' : 'Access will be restored.'
      }`,
      action: async () => {
        try {
          await updateAdmin({ id: admin.id, status: newStatus }).unwrap();
          showToast(`Administrator status changed to ${newStatus}.`);
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err?.data?.error?.message || err.message}`);
        }
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (admin: any) => {
    setEditTarget(admin);
    setEditName(admin.name || '');
    setEditPermissions({
      canScan: admin.permissions?.canScan ?? true,
      canUseChatbot: admin.permissions?.canUseChatbot ?? true,
      canUseGeoGrid: admin.permissions?.canUseGeoGrid ?? true,
      canUseCompetitorMatrix: admin.permissions?.canUseCompetitorMatrix ?? true,
      canExportPdf: admin.permissions?.canExportPdf ?? true,
      canInviteTeam: admin.permissions?.canInviteTeam ?? true,
      canUseApi: admin.permissions?.canUseApi ?? true
    });
    setEditModalOpen(true);
  };

  // Submit Edit Admin with Confirmation
  const promptEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setConfirmModal({
      open: true,
      title: 'Save Administrator Updates',
      description: `Save updated details and permissions for administrator ${editTarget.name}?`,
      action: async () => {
        try {
          await updateAdmin({
            id: editTarget.id,
            name: editName,
            permissions: editPermissions
          }).unwrap();
          showToast(`Administrator ${editName} updated successfully.`);
          setEditModalOpen(false);
          setEditTarget(null);
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err?.data?.error?.message || err.message}`);
        }
      }
    });
  };

  // Prompt Delete Admin
  const promptDeleteAdmin = (admin: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Administrator Account',
      description: `Are you sure you want to permanently delete administrator account for ${admin.name} (${admin.email})? Their sessions will be terminated and administrative access revoked.`,
      action: async () => {
        try {
          await deleteAdmin(admin.id).unwrap();
          showToast(`Administrator ${admin.name} deleted successfully.`);
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err?.data?.error?.message || err.message}`);
        }
      }
    });
  };

  return (
    <AdminLayout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-brand-500/40 text-brand-300 text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{confirmModal.title}</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">{confirmModal.description}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmModal({ ...confirmModal, open: false });
                  await confirmModal.action();
                }}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs text-white font-bold transition cursor-pointer"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">System Administrators</h1>
          <p className="text-xs text-slate-400 mt-1">
            Delegate platform administrative privileges, configure all 7 permission flags, issue temporary credentials, and track admin activity.
          </p>
        </div>
        <button
          onClick={() => { setCreatedAdminResult(null); setErrorMsg(null); setCreateModalOpen(true); }}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Administrator</span>
        </button>
      </div>

      {/* ── Administrators Table ────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin mx-auto" />
            <p>Loading administrators...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-rose-400">
            Failed to load administrators. Super Administrator credentials required.
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">No administrators created yet</p>
            <p className="text-xs text-slate-500">Create an administrator account to delegate support and customer operations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Admin Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Password State</th>
                  <th className="py-3 px-4">Users Modified</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {admins.map((admin: any) => (
                  <tr key={admin.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                          {admin.name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{admin.name}</div>
                          <div className="text-[11px] text-slate-400">{admin.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        admin.status === 'SUSPENDED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {admin.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {admin.mustChangePassword ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <KeyRound className="w-3 h-3" />
                          <span>Temporary Password</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Permanent</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-white font-semibold">
                      {admin.usersChangedCount || 0} users
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {admin.lastActivityAt ? new Date(admin.lastActivityAt).toLocaleString() : 'N/A'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(admin)}
                          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Edit Permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/admin/admins/${admin.id}`}
                          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="View Admin Activity"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => promptToggleAdminStatus(admin)}
                          className={`p-1.5 rounded-xl transition cursor-pointer ${
                            admin.status === 'SUSPENDED'
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-amber-400 hover:bg-amber-500/10'
                          }`}
                          title={admin.status === 'SUSPENDED' ? 'Activate Admin' : 'Suspend Admin'}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => promptDeleteAdmin(admin)}
                          className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Admin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Admin Modal with All 7 Flags ───────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-400" />
                <span>Create Administrator Account</span>
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            {createdAdminResult ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Admin account created successfully!</span>
                </div>
                <p className="text-slate-300">
                  Provide these temporary credentials to the administrator. They will be forced to change password upon first login:
                </p>
                <div className="p-3 bg-slate-950 rounded-lg text-white font-mono space-y-1 select-all">
                  <div>Email: <strong>{createdAdminResult.email}</strong></div>
                  <div>Temporary Password: <strong className="text-amber-400">{createdAdminResult.tempPass}</strong></div>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={promptCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="e.g. Alex Support"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="alex@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Password (Optional)</label>
                  <input
                    type="text"
                    value={createForm.tempPassword}
                    onChange={(e) => setCreateForm({ ...createForm, tempPassword: e.target.value })}
                    placeholder="Leave blank to auto-generate a secure password"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>

                {/* 7 Permissions Flags */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-slate-300">Admin Platform Permissions (All 7 Flags)</label>
                  <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {PERMISSION_FLAGS.map((f) => (
                      <label key={f.key} className="flex items-center justify-between text-xs text-slate-300 hover:text-white cursor-pointer py-1">
                        <div>
                          <span className="font-semibold">{f.label}</span>
                          <span className="text-[11px] text-slate-500 block">{f.desc}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={(createForm.permissions as any)[f.key] ?? true}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              permissions: {
                                ...createForm.permissions,
                                [f.key]: e.target.checked
                              }
                            })
                          }
                          className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs text-white font-bold cursor-pointer"
                  >
                    {isCreating ? 'Creating...' : 'Create Admin'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Admin Permissions Modal with All 7 Flags ────────────── */}
      {editModalOpen && editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-400" />
                <span>Edit Administrator: {editTarget.name}</span>
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={promptEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email (Immutable)</label>
                <input
                  type="email"
                  disabled
                  value={editTarget.email}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500 outline-none cursor-not-allowed"
                />
              </div>

              {/* 7 Permissions Flags */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300">Assigned Platform Permissions (All 7 Flags)</label>
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {PERMISSION_FLAGS.map((f) => (
                    <label key={f.key} className="flex items-center justify-between text-xs text-slate-300 hover:text-white cursor-pointer py-1">
                      <div>
                        <span className="font-semibold">{f.label}</span>
                        <span className="text-[11px] text-slate-500 block">{f.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editPermissions[f.key] ?? true}
                        onChange={(e) =>
                          setEditPermissions({
                            ...editPermissions,
                            [f.key]: e.target.checked
                          })
                        }
                        className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs text-white font-bold cursor-pointer"
                >
                  {isUpdating ? 'Saving...' : 'Save Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
