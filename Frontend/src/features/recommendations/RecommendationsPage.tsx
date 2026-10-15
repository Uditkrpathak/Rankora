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
    <div className="min-h-screen w-full bg-slate-50 flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
        {/* Navigation & Header */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => navigate(`/rank-tracking?locationId=${selectedLocationId}`)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="Back to Geo-Grid Map"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>AI Local Growth Recommendations</span>
                    {activeTasks.length > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-black">
                        {activeTasks.length} Available
                      </span>
                    )}
                  </h1>
                  <p className="text-xs text-slate-500">
                    Evidence-backed action steps generated by benchmarking against top-3 ranking competitors.
                  </p>
                </div>
              </div>
            </div>

            {/* Location Switcher & Fast Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Profile:</span>
                <select
                  value={selectedLocationId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedLocationId(nextId);
                    setSearchParams({ locationId: nextId });
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-brand-500 cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200 shadow-2xs"
              >
                <Compass size={14} />
                <span>Open Geo-Grid Map</span>
              </Link>
            </div>
          </div>

          {/* Top KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Actions</span>
                <div className="text-2xl font-black text-slate-900">{activeTasks.length}</div>
                <span className="text-[11px] text-slate-500">Ready to implement</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High Impact Gap</span>
                <div className="text-2xl font-black text-rose-600">{highImpactCount}</div>
                <span className="text-[11px] text-rose-600 font-semibold">Priority pack movers</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Tasks</span>
                <div className="text-2xl font-black text-emerald-600">{completedTasks.length}</div>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  {rawTasks.length > 0
                    ? `${Math.round((completedTasks.length / rawTasks.length) * 100)}% execution rate`
                    : '100% up to date'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Competitor Benchmark</span>
                <div className="text-base font-black text-slate-900 mt-1">Top-3 Pack Gap</div>
                <span className="text-[11px] text-slate-500">Live grid scan telemetry</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <ShieldCheck size={20} />
              </div>
            </div>
          </div>

          {/* Tab Switcher & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'active'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Recommendations ({activeTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed Actions ({completedTasks.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-brand-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          {availableCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeCategory === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                      activeCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayedTasks.map((task) => {
                const isCompleted = completedTaskIds.includes(task.id);
                const targetVal = task.metrics?.targetValue ?? '0';
                const compVal = task.metrics?.competitorMedian ?? '0';
                const gapVal = task.metrics?.gap;

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : task.impact === 'HIGH'
                        ? 'border-rose-100 hover:border-rose-300'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Badge row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              task.impact === 'HIGH'
                                ? 'bg-rose-100 text-rose-800'
                                : task.impact === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.impact} Impact
                          </span>

                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {getCategoryIcon(task.category)}
                            <span>{task.category}</span>
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleComplete(task.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isCompleted
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
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
                      <div className="space-y-1.5">
                        <h3 className={`text-base font-extrabold text-slate-900 leading-snug ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                          {task.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {task.description}
                        </p>
                      </div>

                      {/* Visual Benchmark Comparison Meter */}
                      {task.metrics && (
                        <div className="p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-600">
                              Your Profile: <strong className="text-slate-900 font-black">{targetVal}</strong>
                            </span>
                            <span className="text-indigo-600">
                              Top-3 Competitor Median: <strong className="text-indigo-900 font-black">{compVal}</strong>
                            </span>
                          </div>

                          {/* Progress Meter Bar */}
                          <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex">
                            <div
                              className="bg-brand-500 h-full rounded-full transition-all duration-500"
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
                              <span className="text-slate-500">Benchmark Deficit Gap</span>
                              <span className="font-extrabold text-rose-600">
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
                        Target Area: {task.sourceLabel || 'Google Maps Pack'}
                      </span>

                      <button
                        onClick={() => handleActionClick(task)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#623CD0] hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-2xs transition-all cursor-pointer"
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
            <div className="p-12 text-center max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-card space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900">
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
        </div>
      </main>
    </div>
  );
};
