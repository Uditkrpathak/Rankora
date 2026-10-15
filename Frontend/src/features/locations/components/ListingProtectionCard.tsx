import React from 'react';
import {
  useGetProtectionStatusQuery,
  useCheckProtectionMutation,
  useResolveProtectionIncidentMutation,
  IProtectionIncident,
} from '../../../store/api/protectionApi';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Loader2,
  Check,
} from 'lucide-react';

interface ListingProtectionCardProps {
  workspaceId: string;
  locationId: string;
  placeId?: string | null;
  locationName: string;
  isEnabled?: boolean;
}

export const ListingProtectionCard: React.FC<ListingProtectionCardProps> = ({
  workspaceId,
  locationId,
  placeId,
  locationName,
  isEnabled = false,
}) => {
  const { data, isLoading, isFetching, refetch } = useGetProtectionStatusQuery(
    { workspaceId, locationId },
    { skip: !workspaceId || !locationId || !placeId }
  );

  const [checkProtection, { isLoading: isChecking }] = useCheckProtectionMutation();
  const [resolveIncident, { isLoading: isResolving }] = useResolveProtectionIncidentMutation();

  if (!placeId) {
    return null;
  }

  const snapshot = data?.data;
  const isSecure = snapshot?.status === 'SECURE';
  const isCritical = snapshot?.status === 'CRITICAL_SABOTAGE';
  const isDrift = snapshot?.status === 'DRIFT_DETECTED';
  const incidents = snapshot?.incidents || [];
  const activeIncidents = incidents.filter((i: IProtectionIncident) => !i.isResolved);

  const handleRunCheck = async () => {
    try {
      await checkProtection({ workspaceId, locationId }).unwrap();
    } catch (err) {
      console.error('Shield check failed:', err);
    }
  };

  const handleResolve = async (incidentId: string) => {
    try {
      await resolveIncident({ workspaceId, locationId, incidentId }).unwrap();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  };

  const formattedLastCheck = snapshot?.lastCheckedAt
    ? new Date(snapshot.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        isCritical
          ? 'bg-rose-50/70 border-rose-200 shadow-sm'
          : isDrift
          ? 'bg-amber-50/70 border-amber-200 shadow-sm'
          : !isEnabled
          ? 'bg-slate-50/60 border-slate-200 shadow-2xs'
          : 'bg-white border-slate-200/80 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              isCritical
                ? 'bg-rose-100 text-rose-600 border border-rose-200'
                : isDrift
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : !isEnabled
                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            ) : isDrift ? (
              <AlertTriangle className="w-5 h-5" />
            ) : !isEnabled ? (
              <Shield className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                24/7 Listing Sabotage & Status Protection
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  !isEnabled
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : isCritical
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : isDrift
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {!isEnabled
                  ? 'Protection disabled'
                  : isCritical
                  ? '🚨 Sabotage Detected'
                  : isDrift
                  ? '⚠️ Profile Drift'
                  : '🟢 Monitored & Secure'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated Google Maps watchdog guarding phone, operating status, and title against unauthorized rival edits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={isChecking || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                <span>Checking Maps…</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Live Shield Check</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Alerts (if any sabotage/drift detected) */}
      {activeIncidents.length > 0 && (
        <div className="p-4 bg-rose-100/70 border-b border-rose-200 space-y-2">
          <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Action Required: Unconfirmed External Edits Detected on Google Maps</span>
          </p>
          <div className="space-y-2">
            {activeIncidents.map((inc: any) => (
              <div
                key={inc._id || inc.message}
                className="p-3 bg-white rounded-xl border border-rose-200 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-rose-950">{inc.message}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Expected: <span className="text-slate-800 font-semibold">{inc.previousValue || 'None'}</span> · Live Google: <span className="text-rose-700 font-bold">{inc.currentValue}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResolve(inc._id || (inc as any).id)}
                  disabled={isResolving}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-2xs transition shrink-0 cursor-pointer"
                >
                  Acknowledge & Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Status Overview */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Google Business Status
          </span>
          <p className="font-black text-slate-900 text-sm capitalize truncate">
            {snapshot?.current?.businessStatus ? snapshot.current.businessStatus.toLowerCase().replace(/_/g, ' ') : 'Operational'}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Verified Open to Public
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            Guarded Phone Number
          </span>
          <p className="font-mono font-bold text-slate-900 text-sm truncate">
            {snapshot?.current?.phone || snapshot?.baseline?.phone || 'Configured'}
          </p>
          <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            Matching Baseline Snapshot
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Protected Business Title
          </span>
          <p className="font-bold text-slate-900 text-sm truncate">
            {snapshot?.current?.name || locationName}
          </p>
          <p className="text-[10px] text-slate-400">Checked: {formattedLastCheck}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            Map Address & Pin Integrity
          </span>
          <p className="font-bold text-slate-900 text-sm truncate" title={snapshot?.current?.address || snapshot?.baseline?.address || 'Address Verified'}>
            {snapshot?.current?.address || snapshot?.baseline?.address || 'Address Verified'}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Location Coordinates Intact
          </p>
        </div>
      </div>
    </div>
  );
};
