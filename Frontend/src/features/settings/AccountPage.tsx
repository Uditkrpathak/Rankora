import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { updateUserProfile, logOut } from '../../store/slices/authSlice';
import {
  useUpdateMeMutation,
  useUploadAvatarMutation,
  useRequestEmailChangeMutation,
  useChangePasswordMutation,
  useCreatePasswordMutation,
  useRequestAccountDeletionMutation
} from '../../store/api/authApi';
import { useListLocationsQuery } from '../../store/api/locationApi';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import { SettingsLayout } from './SettingsLayout';
import {
  User,
  Mail,
  Lock,
  Shield,
  Laptop,
  AlertTriangle,
  Camera,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  Check,
  X,
  ExternalLink,
  Trash2,
  Building2,
  MapPin,
  Compass,
  MessageSquareText,
  Plus,
} from 'lucide-react';

export const AccountPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const { data: locationsData, isLoading: isLocationsLoading } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );
  const locations = locationsData?.locations || [];

  // RTK Query Mutations
  const [updateMe, { isLoading: isUpdatingName }] = useUpdateMeMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadAvatarMutation();
  const [requestEmailChange, { isLoading: isRequestingEmail }] = useRequestEmailChangeMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [createPassword, { isLoading: isRequestingCreatePassword }] = useCreatePasswordMutation();
  const [requestAccountDeletion, { isLoading: isDeletingAccount }] = useRequestAccountDeletionMutation();

  const [createPasswordSuccess, setCreatePasswordSuccess] = useState<string | null>(null);
  const [createPasswordError, setCreatePasswordError] = useState<string | null>(null);

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Avatar error / preview / toast
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState<number>(Date.now());
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email change modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailModalSuccess, setEmailModalSuccess] = useState<string | null>(null);
  const [emailModalError, setEmailModalError] = useState<string | null>(null);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passModalSuccess, setPassModalSuccess] = useState<string | null>(null);
  const [passModalError, setPassModalError] = useState<string | null>(null);

  // Account deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  // Real-time password rules checklist
  const passwordRules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    matches: newPassword.length > 0 && newPassword === confirmPassword
  };
  const isNewPasswordValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number &&
    passwordRules.special &&
    passwordRules.matches;

  // Handlers
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValue.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }
    setNameError(null);
    try {
      await updateMe({ name: nameValue.trim() }).unwrap();
      dispatch(updateUserProfile({ name: nameValue.trim() }));
      setNameSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      setNameError(err?.data?.error?.message || 'Failed to update name.');
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size check (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Avatar image must be smaller than 5MB.');
      return;
    }

    // Client-side type check
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (JPEG, PNG, WebP, GIF).');
      return;
    }

    setAvatarError(null);
    setAvatarSuccess(false);

    // Instant local preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await uploadAvatar(formData).unwrap();
      const newUrl = res?.data?.avatarUrl || res?.avatarUrl;
      dispatch(updateUserProfile({ avatarUrl: newUrl }));
      setAvatarTimestamp(Date.now());
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err: any) {
      setAvatarPreview(null);
      setAvatarError(err?.data?.error?.message || 'Failed to upload avatar image.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailModalError(null);
    setEmailModalSuccess(null);

    if (!newEmail.trim() || !emailPassword) {
      setEmailModalError('Please enter both your new email and current password.');
      return;
    }

    try {
      const res = await requestEmailChange({
        newEmail: newEmail.trim(),
        currentPassword: emailPassword
      }).unwrap();

      setEmailModalSuccess(
        res.data?.message ||
          `A verification link has been sent to ${newEmail}. A security notice was also delivered to your current address.`
      );
      setNewEmail('');
      setEmailPassword('');
    } catch (err: any) {
      setEmailModalError(err?.data?.error?.message || 'Failed to request email change.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassModalError(null);
    setPassModalSuccess(null);

    if (!currentPassword) {
      setPassModalError('Please provide your current password.');
      return;
    }
    if (!isNewPasswordValid) {
      setPassModalError('Please fulfill all password requirements before saving.');
      return;
    }

    try {
      await changePassword({
        currentPassword,
        newPassword
      }).unwrap();

      setPassModalSuccess('Password successfully updated! A security confirmation email has been sent.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassModalSuccess(null);
      }, 2500);
    } catch (err: any) {
      setPassModalError(err?.data?.error?.message || 'Failed to update password.');
    }
  };

  const handleRequestCreatePassword = async () => {
    setCreatePasswordError(null);
    setCreatePasswordSuccess(null);
    try {
      const res = await createPassword().unwrap();
      setCreatePasswordSuccess(res.data?.message || 'A confirmation link has been sent to your email.');
    } catch (err: any) {
      setCreatePasswordError(err?.data?.error?.message || 'Failed to send password creation link.');
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmPhrase.trim() !== 'DELETE MY ACCOUNT') {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    try {
      const res = await requestAccountDeletion({
        currentPassword: deletePassword
      }).unwrap();

      setDeleteSuccessMsg(
        res.data?.message ||
          'Your account and sole-owned workspaces are scheduled for permanent deletion in 30 days.'
      );

      setTimeout(() => {
        dispatch(logOut());
        navigate('/login');
      }, 3500);
    } catch (err: any) {
      setDeleteError(err?.data?.error?.message || 'Failed to schedule account deletion.');
    }
  };

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">My Account</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your personal profile, credentials, and security preferences.
            </p>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" />
            Personal Profile
          </h2>

          {/* Avatar & Info Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-violet-500 text-white flex items-center justify-center text-2xl font-bold border-2 border-white shadow-md">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={user?.name || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : user?.avatarUrl ? (
                  <img
                    src={`${user.avatarUrl}?t=${avatarTimestamp}`}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  (user?.name || user?.email || 'U')[0].toUpperCase()
                )}
              </div>

              {/* Upload Trigger Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 rounded-full bg-slate-950/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                title="Change Avatar"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-medium mt-0.5">Upload</span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900">{user?.name || 'Localo User'}</h3>
                {user?.isEmailVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                )}
                {user?.status === 'PENDING_DELETION' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    Pending Deletion
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-2">
                Click on the avatar to upload a photo (JPEG, PNG, WebP or GIF up to 5MB).
              </p>
            </div>
          </div>

          {avatarSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Avatar image updated successfully!</span>
            </div>
          )}

          {avatarError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}

          {nameSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Your profile name has been updated successfully!</span>
            </div>
          )}

          {/* Name Field */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    placeholder="Enter your full name"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingName}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUpdatingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameValue(user?.name || '');
                      setNameError(null);
                    }}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between p-3 bg-slate-50/70 border border-slate-200 rounded-lg">
                  <span className="text-sm font-medium text-slate-800">{user?.name || 'Not set'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNameValue(user?.name || '');
                      setIsEditingName(true);
                    }}
                    className="text-xs text-brand-600 font-semibold hover:text-brand-700 hover:underline"
                  >
                    Edit Name
                  </button>
                </div>
              )}
              {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
            </div>
          </div>
        </div>

        {/* Linked Business Profiles Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                Linked Business Profiles
                <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  {locations.length} {locations.length === 1 ? 'Profile' : 'Profiles'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Google Business Profiles linked and active in your current workspace.
              </p>
            </div>
            <Link
              to="/locations/add"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Business</span>
            </Link>
          </div>

          {isLocationsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-60 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : locations.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Business Profiles Linked Yet</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link your first Google Business Profile to track rankings and manage reviews.
                </p>
              </div>
              <Link
                to="/locations/add"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link Google Profile</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {locations.map((loc) => {
                const categoryName = loc.primaryCategory?.displayName || loc.categories?.[0] || 'Local Business';
                const isVerified = loc.ownershipVerified || loc.syncStatus === 'SYNCED';

                return (
                  <div
                    key={loc._id}
                    className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/40 hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs group"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <BusinessAvatar
                        name={loc.name}
                        coverPhotoUrl={loc.coverPhotoUrl}
                        logoUrl={loc.logoUrl}
                        website={loc.website}
                        category={categoryName}
                        size="md"
                        className="w-12 h-12 rounded-xl shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{loc.name}</h4>
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Google Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              Connected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {loc.address || `${loc.city || ''}, ${loc.state || ''}`}
                          </span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">{categoryName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action links */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
                      <Link
                        to={`/rank-tracking?locationId=${loc._id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-2xs"
                        title="Geo-Grid Scan"
                      >
                        <Compass className="w-3.5 h-3.5 text-brand-500" />
                        <span>Geo-Grid</span>
                      </Link>
                      <Link
                        to={`/reviews`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-2xs"
                        title="Review Inbox"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Reviews</span>
                      </Link>
                      <Link
                        to={`/locations/${loc._id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-black transition shadow-2xs"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Account Credentials (Email & Password) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-600" />
            Login Credentials
          </h2>

          <div className="divide-y divide-slate-100">
            {/* Email Row */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">Email Address</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Current: <span className="font-medium text-slate-700">{user?.email}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEmailModal(true);
                  setEmailModalError(null);
                  setEmailModalSuccess(null);
                }}
                className="self-start sm:self-auto px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs hover:bg-slate-50 transition"
              >
                Change Email
              </button>
            </div>

            {/* Password Row */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">Password</span>
                  {user?.hasPassword === false && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      OAuth Only (No Password)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {user?.hasPassword === false
                    ? 'Your account was created via Google OAuth. Set a password to enable password sign-in and account updates.'
                    : 'Secured with Argon2id encryption. In-session changes require your current password.'}
                </p>
                {createPasswordSuccess && (
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {createPasswordSuccess}
                  </p>
                )}
                {createPasswordError && (
                  <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {createPasswordError}
                  </p>
                )}
              </div>
              {user?.hasPassword === false ? (
                <button
                  type="button"
                  onClick={handleRequestCreatePassword}
                  disabled={isRequestingCreatePassword}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isRequestingCreatePassword && <Loader2 className="w-3 h-3 animate-spin" />}
                  Set Password
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setPassModalError(null);
                    setPassModalSuccess(null);
                  }}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs hover:bg-slate-50 transition"
                >
                  Change Password
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Security & Devices Shortcuts (Reused pages) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" />
            Security & Authentication
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            Configure multi-factor authentication (MFA) and monitor active logged-in device sessions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 2FA Card */}
            <Link
              to="/security"
              className="p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition">
                    <Shield className="w-5 h-5" />
                  </div>
                  {user?.mfaEnabled ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      2FA Enabled
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900">Two-Factor Authentication</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Add an extra layer of protection to your account using TOTP authenticator apps.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                Configure 2FA <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Active Sessions Card */}
            <Link
              to="/sessions"
              className="p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-600 transition">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">Active Device Sessions</h4>
                <p className="text-xs text-slate-500 mt-1">
                  View and revoke active refresh tokens and browser sessions across all devices.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                Manage Sessions <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50/40 rounded-2xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-base mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Danger Zone
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Permanently delete your account and personal workspaces. This action enters a 30-day grace period
            before permanent automated anonymization and data destruction.
          </p>

          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteError(null);
              setDeletePassword('');
              setDeleteConfirmPhrase('');
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Modal: Change Email Address ──────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-600" />
                Change Email Address
              </h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailModalSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Confirmation Link Dispatched!
                  </p>
                  <p className="text-slate-600">{emailModalSuccess}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : user?.hasPassword === false ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Password Required to Change Email
                  </p>
                  <p className="text-slate-600">
                    Because your account was created with Google OAuth, it does not currently have a password. Please set a password first to verify your identity before updating your email.
                  </p>
                </div>

                {createPasswordSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{createPasswordSuccess}</span>
                  </div>
                )}
                {createPasswordError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{createPasswordError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestCreatePassword}
                    disabled={isRequestingCreatePassword}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRequestingCreatePassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Send Password Creation Link
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestEmailChange} className="space-y-4">
                <p className="text-xs text-slate-500">
                  Changing your email updates your login identity. We will send a confirmation link to your new address and a security alert to your current inbox.
                </p>

                {emailModalError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{emailModalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    placeholder="you@newcompany.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Password (Re-authentication)
                  </label>
                  <input
                    type="password"
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRequestingEmail}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRequestingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Send Verification
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Change Password ─────────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-600" />
                Change Password
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passModalSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{passModalSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passModalError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{passModalError}</span>
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      placeholder="Enter new strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    placeholder="Repeat new password"
                  />
                </div>

                {/* Live Password Rules Checklist */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700 mb-1">Password Requirements:</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${passwordRules.length ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.length ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.uppercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.uppercase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      Uppercase letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.lowercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.lowercase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      Lowercase letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.number ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.number ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      Number (0-9)
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.special ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.special ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      Special symbol
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.matches ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {passwordRules.matches ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5" />}
                      Passwords match
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword || !isNewPasswordValid}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Delete Account (Danger Zone) ────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Confirm Account Deletion
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Deletion Scheduled
                </p>
                <p className="text-slate-600">{deleteSuccessMsg}</p>
                <p className="text-[11px] text-slate-400 mt-2">Redirecting to login...</p>
              </div>
            ) : (
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-800 space-y-1.5">
                  <p className="font-semibold">Warning: This action cannot be easily undone.</p>
                  <p className="text-slate-600">
                    Your account will enter a 30-day scheduled deletion window. Workspaces solely owned by you with no other members will also be queued for removal.
                  </p>
                </div>

                {deleteError && (
                  <div className="p-3 rounded-lg bg-red-100 border border-red-300 text-red-900 text-xs flex items-start gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-700" />
                    <div>
                      <strong className="font-semibold">Action Blocked:</strong> {deleteError}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900"
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type <span className="font-mono text-red-600 font-bold">DELETE MY ACCOUNT</span> to confirm
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmPhrase}
                    onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 font-mono"
                    placeholder="DELETE MY ACCOUNT"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingAccount || deleteConfirmPhrase !== 'DELETE MY ACCOUNT'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm Account Deletion
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </SettingsLayout>
  );
};

export default AccountPage;
