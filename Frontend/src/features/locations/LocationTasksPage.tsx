import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useGetLocationQuery, useListLocationsQuery } from '../../store/api/locationApi';
import {
  useGetLocationAuditTasksQuery,
  useUpdateAuditTaskStatusMutation,
  useRecalculateAuditMutation,
  useGetLocationAuditsQuery,
} from '../../store/api/auditApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { RemediationModal } from '../audits/components/RemediationModal';
import { ListingProtectionCard } from './components/ListingProtectionCard';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowLeft,
  RefreshCw,
  Compass,
  AlertTriangle,
  Layers,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Target,
  X,
  SlidersHorizontal,
  Plus,
  Eye,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const LocationTasksPage: React.FC = () => {
  const toast = useToast();
  const { id: locationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [activeTab, setActiveTab] = useState<'new' | 'completed'>('new');
  const [selectedPillar, setSelectedPillar] = useState<string>('ALL');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeRemediationTask, setActiveRemediationTask] = useState<any | null>(null);

  // Queries
  const { data: locationData, isLoading: isLocLoading } = useGetLocationQuery(
    { workspaceId, locId: locationId || '' },
    { skip: !workspaceId || !locationId }
  );
  const location = locationData;

  const { data: locationsData } = useListLocationsQuery({ workspaceId }, { skip: !workspaceId });
  const locations = locationsData?.locations || [];

  const { data: tasksData, isLoading: isTasksLoading, refetch: refetchTasks } = useGetLocationAuditTasksQuery(
    { workspaceId, locationId: locationId || '' },
    { skip: !workspaceId || !locationId }
  );
  const tasks = tasksData?.data || [];

  const { data: auditsData, refetch: refetchAudits } = useGetLocationAuditsQuery(
    { workspaceId, locationId: locationId || '' },
    { skip: !workspaceId || !locationId }
  );
  const latestAudit = auditsData?.data?.[0];

  const [updateTaskStatus, { isLoading: isUpdatingStatus }] = useUpdateAuditTaskStatusMutation();
  const [recalculateAudit, { isLoading: isRecalculating }] = useRecalculateAuditMutation();

  // Split tasks into new vs completed
  const openTasks = useMemo(() => {
    return tasks.filter((t: any) => t.status === 'OPEN' || t.status === 'PENDING_VERIFICATION');
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t: any) => t.status === 'DONE' || t.status === 'VERIFIED');
  }, [tasks]);

  const currentDisplayTasks = useMemo(() => {
    const list = activeTab === 'new' ? openTasks : completedTasks;
    if (selectedPillar === 'ALL') return list;
    return list.filter((t: any) => (t.pillar || 'NAP_CORE').toUpperCase() === selectedPillar.toUpperCase());
  }, [activeTab, openTasks, completedTasks, selectedPillar]);

  // Weekly progress calculation
  const totalTasksCount = tasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 100;

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === 'DONE' || task.status === 'VERIFIED' ? 'OPEN' : 'DONE';
    try {
      await updateTaskStatus({
        workspaceId,
        taskId: task._id || task.id,
        status: nextStatus,
      }).unwrap();
      toast.success(nextStatus === 'DONE' ? 'Task marked as completed' : 'Task reopened');
      refetchTasks();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to update task status.');
    }
  };

  const handleRerunAudit = async () => {
    if (!latestAudit) return;
    try {
      await recalculateAudit({
        workspaceId,
        locationId: locationId || '',
        auditId: latestAudit._id,
      }).unwrap();
      toast.success('Audit rerun completed');
      refetchAudits();
      refetchTasks();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to re-run audit.');
    }
  };

  const getPillarLabel = (pillar?: string) => {
    switch (pillar?.toUpperCase()) {
      case 'CATEGORIES': return 'Categories';
      case 'NAP_CORE': return 'NAP & Core Info';
      case 'DESCRIPTION_CONTENT': return 'Content & Description';
      case 'REPUTATION': return 'Reputation & Reviews';
      case 'TECHNICAL': return 'Website & Schema';
      default: return 'Profile Optimization';
    }
  };

  const getImpactBadge = (impact: number, potentialGain?: number) => {
    const pts = potentialGain || Math.round(impact);
    if (pts >= 6) {
      return {
        label: `High Impact (+${pts} pts)`,
        className: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    }
    if (pts >= 4) {
      return {
        label: `Medium Impact (+${pts} pts)`,
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    return {
      label: `Quick Win (+${pts} pts)`,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    };
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="space-y-6 w-full pb-12">
        {/* Top Localo Subheader */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/locations')}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Back to Locations"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Business Dropdown Selector */}
            <select
              value={locationId}
              onChange={(e) => navigate(`/locations/${e.target.value}/tasks`)}
              className="max-w-[240px] sm:max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 truncate cursor-pointer"
            >
              {locations.map((loc) => (
                <option value={loc._id} key={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Audit Score: {latestAudit ? `${latestAudit.score}/100` : '—'}</span>
            </div>
          </div>

          {/* Quick Action Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/rank-tracking?locationId=${locationId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200"
            >
              <Compass size={14} />
              <span>Geo-Grid Map</span>
            </Link>

            <Link
              to={`/locations/${locationId}/profile`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition border border-slate-200"
            >
              <Layers size={14} />
              <span>Profile Dashboard</span>
            </Link>

            <button
              onClick={handleRerunAudit}
              disabled={isRecalculating || !latestAudit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={isRecalculating ? 'animate-spin' : ''} />
              <span>{isRecalculating ? 'Auditing…' : 'Re-run Audit'}</span>
            </button>
          </div>
        </div>

        {/* Localo Green Hero Banner (Matching Localo Screenshot 1) */}
        {!bannerDismissed && (
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 p-5 sm:p-6 text-white animate-in fade-in">
            <button
              onClick={() => setBannerDismissed(true)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-white transition cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-extrabold uppercase tracking-wide">
                  <Sparkles size={13} />
                  <span>Smart Optimization Tasks</span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                  Achieve Big Results with Small, Strategic Steps
                </h1>
                <p className="text-xs sm:text-sm text-green-50 leading-relaxed font-medium">
                  The secret to local SEO success is consistent, targeted improvements. That's why our Smart Tasks feature breaks down your optimization journey into manageable weekly actions, prioritized for maximum impact. Each week, you'll receive fresh, data-driven tasks specifically designed to boost your Google visibility where it matters most.
                </p>
              </div>

              {/* Progress Summary Box */}
              <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 min-w-[220px]">
                <div className="flex items-center justify-between text-xs font-bold text-green-50 mb-2">
                  <span>Weekly Goal</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-green-100 font-medium">
                  {completedCount} of {totalTasksCount} tasks completed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 24/7 Listing Sabotage & Status Drift Guard */}
        {locationId && (
          <ListingProtectionCard
            workspaceId={workspaceId}
            locationId={locationId}
            placeId={location?.placeId}
            locationName={location?.name || 'Business'}
          />
        )}

        {/* Tasks View Header: Title, Tabs & Pillar Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            {/* New vs Completed Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('new')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'new'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New ({openTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed ({completedTasks.length})
              </button>
            </div>
          </div>

          {/* Pillar Filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-slate-400" />
            <select
              value={selectedPillar}
              onChange={(e) => setSelectedPillar(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Pillars ({activeTab === 'new' ? openTasks.length : completedTasks.length})</option>
              <option value="CATEGORIES">Categories</option>
              <option value="NAP_CORE">NAP & Core Info</option>
              <option value="DESCRIPTION_CONTENT">Content & Description</option>
              <option value="REPUTATION">Reputation & Reviews</option>
              <option value="TECHNICAL">Website & Schema</option>
            </select>
          </div>
        </div>

        {/* Task Cards Grid */}
        {isTasksLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-lg border border-slate-200 shimmer" />
            ))}
          </div>
        ) : currentDisplayTasks.length === 0 ? (
          <div className="p-12 text-center rounded-lg bg-white border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === 'new' ? 'All optimization tasks completed!' : 'No completed tasks yet.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeTab === 'new'
                ? 'Your Google Business Profile has addressed all current audit findings. Check back next week or re-run an audit anytime.'
                : 'Tasks marked completed or verified during automated audits will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentDisplayTasks.map((task: any) => {
              const impact = getImpactBadge(task.impact, task.potentialGain);
              const isCompleted = task.status === 'DONE' || task.status === 'VERIFIED';

              return (
                <div
                  key={task._id || task.id || task.signalCode}
                  className={`bg-white rounded-lg border transition p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 ${
                    isCompleted ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Completion Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      disabled={isUpdatingStatus}
                      className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-blue-600 bg-white'
                      }`}
                      title={isCompleted ? 'Mark as active' : 'Mark as completed'}
                    >
                      {isCompleted && <CheckCircle2 size={14} />}
                    </button>

                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Pillar Badge */}
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wide">
                          {getPillarLabel(task.pillar)}
                        </span>

                        {/* Impact / Potential Gain Badge */}
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${impact.className}`}>
                          {impact.label}
                        </span>

                        {task.status === 'VERIFIED' && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                            Verified in Audit
                          </span>
                        )}
                      </div>

                      <h3 className={`text-sm sm:text-base font-bold text-slate-900 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                        {task.title}
                      </h3>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {task.whyItMatters}
                      </p>

                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Target size={13} className="text-blue-600" />
                          <span>Recommended Action:</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {task.recommendedAction}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0 self-end md:self-start">
                    {!isCompleted && (
                      <button
                        onClick={() => setActiveRemediationTask(task)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>AI Fix & Draft</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isCompleted
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{isCompleted ? 'Reopen Task' : 'Mark Completed'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Remediation & Draft Modal */}
      {activeRemediationTask && (
        <RemediationModal
          isOpen={Boolean(activeRemediationTask)}
          task={activeRemediationTask}
          location={location as any}
          workspaceId={workspaceId}
          auditId={latestAudit?._id}
          onClose={() => setActiveRemediationTask(null)}
          onSuccess={() => {
            setActiveRemediationTask(null);
            refetchTasks();
            refetchAudits();
          }}
        />
      )}
      </main>
    </div>
  );
};

export default LocationTasksPage;
