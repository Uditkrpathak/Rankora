import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useListLocationsQuery, Location } from '../../store/api/locationApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Star,
  Image as ImageIcon,
  Compass,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Layers,
  Check,
  Search,
  Filter,
  AlertCircle,
  Tag,
  Megaphone,
  ArrowUpRight,
  RotateCcw,
  Building2,
} from 'lucide-react';

export const RecommendationsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLocationId = searchParams.get('locationId');
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: locationsData, isLoading: isLocationsLoading } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );
  const locations: Location[] = locationsData?.locations || [];

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Sync selected location from query params or first available
  useEffect(() => {
    if (requestedLocationId && locations.some((loc) => loc._id === requestedLocationId)) {
      setSelectedLocationId(requestedLocationId);
    } else if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0]._id);
    }
  }, [locations, requestedLocationId, selectedLocationId]);

  const selectedLocation = useMemo(() => {
    return locations.find((loc) => loc._id === selectedLocationId);
  }, [locations, selectedLocationId]);

  // Track completed task IDs in localStorage
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    if (!selectedLocationId) return [];
    try {
      const stored = localStorage.getItem(`completed_recommendations_${selectedLocationId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Reload completed tasks when switching locations
  useEffect(() => {
    if (!selectedLocationId) return;
    try {
      const stored = localStorage.getItem(`completed_recommendations_${selectedLocationId}`);
      setCompletedTaskIds(stored ? JSON.parse(stored) : []);
    } catch {
      setCompletedTaskIds([]);
    }
  }, [selectedLocationId]);

  const handleToggleComplete = (taskId: string) => {
    const isCompleted = completedTaskIds.includes(taskId);
    const updated = isCompleted
      ? completedTaskIds.filter((id) => id !== taskId)
      : [...completedTaskIds, taskId];

    setCompletedTaskIds(updated);
    try {
      localStorage.setItem(`completed_recommendations_${selectedLocationId}`, JSON.stringify(updated));
    } catch {}

    if (isCompleted) {
      toast.info('Task moved back to active recommendations');
    } else {
      toast.success('Task marked as completed! Great progress! 🎉');
    }
  };

  const rawTasks = useMemo(() => {
    return selectedLocation?.recommendedTasks || [];
  }, [selectedLocation]);

  const activeTasks = useMemo(() => {
    return rawTasks.filter((t) => !completedTaskIds.includes(t.id));
  }, [rawTasks, completedTaskIds]);

  const completedTasks = useMemo(() => {
    return rawTasks.filter((t) => completedTaskIds.includes(t.id));
  }, [rawTasks, completedTaskIds]);

  const highImpactCount = useMemo(() => {
    return activeTasks.filter((t) => t.impact === 'HIGH').length;
  }, [activeTasks]);

  // Categories present in tasks
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    rawTasks.forEach((t) => {
      if (t.category) cats.add(t.category.toUpperCase());
    });
    return Array.from(cats);
  }, [rawTasks]);

  // Filtered task list
  const displayedTasks = useMemo(() => {
    const pool = activeTab === 'active' ? activeTasks : completedTasks;
    return pool.filter((task) => {
      const matchesCategory =
        activeCategory === 'ALL' || (task.category && task.category.toUpperCase() === activeCategory);
      const matchesSearch =
        !searchQuery.trim() ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeTab, activeTasks, completedTasks, activeCategory, searchQuery]);

  const getCategoryIcon = (category?: string) => {
    switch (category?.toUpperCase()) {
      case 'REVIEWS':
        return <Star className="w-3.5 h-3.5 text-amber-500" />;
      case 'PHOTOS':
        return <ImageIcon className="w-3.5 h-3.5 text-blue-500" />;
      case 'RATING':
        return <Star className="w-3.5 h-3.5 text-purple-500" />;
      case 'CATEGORIES':
        return <Tag className="w-3.5 h-3.5 text-emerald-500" />;
      case 'POSTS':
        return <Megaphone className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  const handleActionClick = (task: any) => {
    if (task.category === 'REVIEWS') {
      navigate(`/reviews?locationId=${selectedLocationId}`);
    } else if (task.actionUrl) {
      window.open(task.actionUrl, '_blank', 'noreferrer');
    } else {
      window.open('https://business.google.com', '_blank', 'noreferrer');
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col text-slate-900 antialiased selection:bg-[#006EEE] selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6">
        {/* Header Bar - Clean & Flat, No Extra Card Div */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/rank-tracking?locationId=${selectedLocationId}`)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
              title="Back to Geo-Grid Map"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  AI Local Growth Recommendations
                </h1>
                {activeTasks.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-blue-50 text-[#006EEE] border border-blue-200 rounded-full text-xs font-semibold">
                    {activeTasks.length} Available
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Evidence-backed action steps generated by benchmarking against top-3 ranking competitors.
              </p>
            </div>
          </div>

          {/* Location Switcher & Fast Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex items-center">
              <Building2 size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedLocationId(nextId);
                  setSearchParams({ locationId: nextId });
                }}
                className="pl-8 pr-7 py-1.5 font-semibold text-xs text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#006EEE] transition-colors"
              >
                {locations.map((loc) => (
                  <option value={loc._id} key={loc._id}>
                    {loc.name} {loc.city ? `(${loc.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <Link
              to={`/rank-tracking?locationId=${selectedLocationId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-semibold transition-colors"
            >
              <Compass size={14} />
              <span>Open Geo-Grid Map</span>
            </Link>
          </div>
        </div>

        {/* Top KPI Summary Strip - Flat Pure White Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Actions</span>
              <div className="text-2xl font-bold text-slate-900">{activeTasks.length}</div>
              <span className="text-[11px] text-slate-400">Ready to implement</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#006EEE] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High Impact Gap</span>
              <div className="text-2xl font-bold text-rose-600">{highImpactCount}</div>
              <span className="text-[11px] text-rose-600 font-semibold">Priority pack movers</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Tasks</span>
              <div className="text-2xl font-bold text-emerald-600">{completedTasks.length}</div>
              <span className="text-[11px] text-emerald-600 font-semibold">
                {rawTasks.length > 0
                  ? `${Math.round((completedTasks.length / rawTasks.length) * 100)}% execution rate`
                  : '100% up to date'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Competitor Benchmark</span>
              <div className="text-base font-bold text-slate-900 mt-1">Top-3 Pack Gap</div>
              <span className="text-[11px] text-slate-400">Live grid scan telemetry</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#006EEE] flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg gap-1 border border-slate-200/80">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white text-slate-900 border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Recommendations ({activeTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-white text-slate-900 border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed Actions ({completedTasks.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg pl-9 pr-3 py-1.5 outline-none focus:border-[#006EEE] focus:ring-1 focus:ring-[#006EEE] transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        {availableCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeCategory === 'ALL'
                  ? 'bg-[#006EEE] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              All Categories ({activeTab === 'active' ? activeTasks.length : completedTasks.length})
            </button>
            {availableCategories.map((cat) => {
              const count = (activeTab === 'active' ? activeTasks : completedTasks).filter(
                (t) => t.category?.toUpperCase() === cat
              ).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeCategory === cat
                      ? 'bg-[#006EEE] text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Recommendations Cards Grid */}
        {displayedTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedTasks.map((task) => {
              const isCompleted = completedTaskIds.includes(task.id);
              const targetVal = task.metrics?.targetValue ?? '0';
              const compVal = task.metrics?.competitorMedian ?? '0';
              const gapVal = task.metrics?.gap;

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-lg border transition-colors p-5 flex flex-col justify-between space-y-4 ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Badge row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            task.impact === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {task.impact} Impact
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#006EEE] border border-blue-100">
                          {getCategoryIcon(task.category)}
                          <span>{task.category}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleComplete(task.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                          isCompleted
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            : 'bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
                        }`}
                        title={isCompleted ? 'Mark as active' : 'Mark as done'}
                      >
                        {isCompleted ? (
                          <>
                            <RotateCcw size={12} />
                            <span>Reopen</span>
                          </>
                        ) : (
                          <>
                            <Check size={12} />
                            <span>Done</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1">
                      <h3 className={`text-sm font-bold text-slate-900 leading-snug ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    {/* Benchmark Comparison Meter */}
                    {task.metrics && (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600">
                            Your Profile: <strong className="text-slate-900">{targetVal}</strong>
                          </span>
                          <span className="text-[#006EEE]">
                            Top-3 Competitor Median: <strong className="text-slate-900">{compVal}</strong>
                          </span>
                        </div>

                        {/* Progress Meter Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden flex">
                          <div
                            className="bg-[#006EEE] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  8,
                                  (Number(targetVal) / Math.max(1, Number(compVal))) * 100
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        {gapVal !== undefined && (
                          <div className="flex items-center justify-between text-[11px] pt-0.5">
                            <span className="text-slate-400">Benchmark Deficit Gap</span>
                            <span className="font-semibold text-rose-600">
                              {Number(gapVal) > 0 ? `+${gapVal} required to bridge gap` : 'On target'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Button Footer */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Target: {task.sourceLabel || 'Google Maps Pack'}
                    </span>

                    <button
                      onClick={() => handleActionClick(task)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>Take Action in {task.sourceLabel || 'GBP'}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'completed'
                  ? 'No Completed Actions Yet'
                  : 'All Recommendation Gaps Closed! 🎉'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeTab === 'completed'
                  ? 'When you complete recommendations, mark them done to track your execution progress here.'
                  : 'Your business profile meets or exceeds the median benchmarks of the top-3 ranking competitors in this geographic area. Keep your listing fresh to maintain high visibility.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/rank-tracking?locationId=${selectedLocationId}`)}
                leftIcon={<Compass size={14} />}
              >
                View Live Geo-Grid Map
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
