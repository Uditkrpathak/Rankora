import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useListLocationsQuery, Location } from '../../store/api/locationApi';
import {
  useRunAuditMutation,
  useGetLocationAuditsQuery,
  useRecalculateAuditMutation,
  useGetLocationAuditTasksQuery,
  useUpdateAuditTaskStatusMutation,
  useSetLocationAuditScheduleMutation,
} from '../../store/api/auditApi';
import { AuditScoreCard } from './AuditScoreCard';
import { RemediationModal } from './components/RemediationModal';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { ChartContainer } from '../../components/ui/ChartContainer';
import { DistributionBarChart } from '../../components/ui/charts/DistributionBarChart';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { adaptAuditCategoryScores } from '../../lib/adapters/auditAdapter';
import {
  ShieldCheck,
  Play,
  RotateCw,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Filter,
  Wrench,
  Check,
  Clock,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const AuditPage: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const requestedLocationId = searchParams.get('locationId');
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: locationsData, refetch: refetchLocations } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );
  const locations: Location[] = locationsData?.locations || [];

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [activeRemediationTask, setActiveRemediationTask] = useState<any | null>(null);

  useEffect(() => {
    if (requestedLocationId && locations.some((location) => location._id === requestedLocationId)) {
      setSelectedLocationId(requestedLocationId);
    } else if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0]._id);
    }
  }, [locations, selectedLocationId, requestedLocationId]);

  const [runAudit, { isLoading: isRunning }] = useRunAuditMutation();
  const [recalculateAudit, { isLoading: isRecalculating }] = useRecalculateAuditMutation();
  const { data: tasksData, refetch: refetchTasks } = useGetLocationAuditTasksQuery(
    { workspaceId, locationId: selectedLocationId },
    { skip: !workspaceId || !selectedLocationId }
  );
  const [updateTaskStatus] = useUpdateAuditTaskStatusMutation();
  const [setLocationAuditSchedule, { isLoading: isSavingSchedule }] =
    useSetLocationAuditScheduleMutation();

  const { data: auditsData, refetch, isLoading: isAuditsLoading } = useGetLocationAuditsQuery(
    { workspaceId, locationId: selectedLocationId },
    { skip: !workspaceId || !selectedLocationId }
  );

  const audits = auditsData?.data || [];
  const currentAudit = audits[0];
  const actionTasks = tasksData?.data || [];
  const selectedLocation = locations.find((location) => location._id === selectedLocationId);
  const hasRecentGbpSync = Boolean(
    selectedLocation?.syncStatus === 'SYNCED' &&
    selectedLocation.googleConnectionId &&
    selectedLocation.gbpLocationId &&
    selectedLocation.lastSyncedAt &&
    Date.now() - new Date(selectedLocation.lastSyncedAt).getTime() <= 30 * 24 * 60 * 60 * 1000
  );
  const outdatedAudit = Boolean(currentAudit && currentAudit.rulesVersion !== '2026.3');

  const handleRunAudit = async () => {
    if (!selectedLocationId || !workspaceId) return;
    try {
      await runAudit({ workspaceId, locationId: selectedLocationId }).unwrap();
      toast.success('Audit started successfully');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to execute audit');
    }
  };

  const handleRecalculate = async () => {
    if (!currentAudit || !selectedLocationId) return;
    try {
      await recalculateAudit({
        workspaceId,
        locationId: selectedLocationId,
        auditId: currentAudit._id,
      }).unwrap();
      toast.success('Audit recalculated successfully');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to recalculate audit');
    }
  };

  const handleScheduleToggle = async () => {
    if (!selectedLocation) return;
    try {
      await setLocationAuditSchedule({
        workspaceId,
        locationId: selectedLocation._id,
        enabled: selectedLocation.auditScheduleEnabled === false,
      }).unwrap();
      toast.success('Audit schedule updated');
      refetchLocations();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to update audit schedule');
    }
  };

  const auditCategoryData = useMemo(() => {
    return adaptAuditCategoryScores(currentAudit);
  }, [currentAudit]);

  const filteredSignals = currentAudit?.signals?.filter((s) => {
    if (activeFilter === 'ALL') return true;
    return s.severity === activeFilter;
  }) || [];

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="space-y-8 w-full pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  17-Point Automated Local SEO Audit
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algorithmic evaluation of profile completeness, trust, and Google Maps ranking readiness.
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus-visible:outline-brand-500 shadow-2xs cursor-pointer"
            >
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} ({loc.city || 'No City'})
                </option>
              ))}
            </select>

            <Button
              variant="primary"
              size="sm"
              isLoading={isRunning}
              leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
              onClick={handleRunAudit}
            >
              Run Audit
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedLocation || isSavingSchedule}
              onClick={handleScheduleToggle}
            >
              Weekly Audit {selectedLocation?.auditScheduleEnabled === false ? 'Off' : 'On'}
            </Button>
          </div>
        </div>

        {currentAudit ? (
          <div className="space-y-6">
            {/* Top Score Overview & Category Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Gauge Card */}
              <div className="p-6 md:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Overall Health Score
                    </span>
                    <Badge variant={currentAudit.score >= 80 ? 'success' : currentAudit.score >= 60 ? 'brand' : 'danger'} size="sm">
                      Ruleset v{currentAudit.rulesVersion || '4.0'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`${
                            currentAudit.score >= 80
                              ? 'text-emerald-500'
                              : currentAudit.score >= 60
                              ? 'text-brand-500'
                              : 'text-rose-500'
                          } transition-all duration-1000`}
                          strokeDasharray={`${currentAudit.score}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-black text-slate-900">{currentAudit.score}</span>
                        <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {currentAudit.score >= 80
                          ? 'Excellent Standing'
                          : currentAudit.score >= 60
                          ? 'Good Optimization'
                          : 'Remediation Needed'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentAudit.summary?.passedCount || 0} checks passed · {currentAudit.summary?.criticalCount || 0} critical
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Evaluated {new Date(currentAudit.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={isRecalculating}
                    leftIcon={<RotateCw className="w-3.5 h-3.5" />}
                    onClick={handleRecalculate}
                  >
                    Recalculate
                  </Button>
                </div>
              </div>

              {/* Category Breakdown Bar Chart */}
              <div className="lg:col-span-2">
                <ChartContainer
                  title="Audit Pillars Breakdown"
                  subtitle="Category scores across SEO dimensions"
                  height={220}
                >
                  <DistributionBarChart data={auditCategoryData} height={220} unit="pts" />
                </ChartContainer>
              </div>
            </div>

            {(!hasRecentGbpSync || outdatedAudit) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {!hasRecentGbpSync && (
                  <p>
                    This profile has no recent verified Google Business Profile sync. Public listing or manually entered facts are not proof of profile ownership. Review, post, attribute and media checks without a current source are marked “Needs data” and excluded from the score.{' '}
                    <Link to="/locations" className="font-semibold underline">Connect Google in Business Profiles</Link>.
                  </p>
                )}
                {outdatedAudit && (
                  <p className={!hasRecentGbpSync ? 'mt-2' : ''}>
                    This saved audit uses ruleset {currentAudit.rulesVersion || 'unknown'}. Run the audit again to apply the current evidence and freshness checks.
                  </p>
                )}
              </div>
            )}

            {/* Signals Checklist Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Checklist Signals</h3>
                  <p className="text-xs text-slate-500">
                    {currentAudit.signals?.filter((signal) => signal.severity !== 'UNKNOWN').length || 0} of {currentAudit.signals?.length || 17} checks have evidence · {currentAudit.summary?.unknownCount || 0} need data
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 text-xs font-semibold shadow-xs">
                  {['ALL', 'CRITICAL', 'WARNING', 'OPTIMIZATION', 'PASS'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={`px-3 py-1 rounded-lg transition ${
                        activeFilter === tab
                          ? 'bg-brand-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSignals.map((signal) => (
                  <AuditScoreCard key={signal.code} signal={signal} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-card space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Audit Run for this Profile</h3>
            <p className="text-xs text-slate-500">
              Run a complete 17-point automated audit to score your profile and reveal optimization opportunities.
            </p>
            <Button
              variant="primary"
              size="md"
              isLoading={isRunning}
              leftIcon={<Play className="w-4 h-4 fill-white" />}
              onClick={handleRunAudit}
            >
              Start Automated Audit
            </Button>
          </div>
        )}
      </div>

      {activeRemediationTask && (
        <RemediationModal
          isOpen={Boolean(activeRemediationTask)}
          task={activeRemediationTask}
          location={selectedLocation}
          workspaceId={workspaceId}
          auditId={currentAudit?._id}
          onClose={() => setActiveRemediationTask(null)}
          onSuccess={() => {
            setActiveRemediationTask(null);
            refetchTasks();
          }}
        />
      )}
      </main>
    </div>
  );
};

export default AuditPage;
