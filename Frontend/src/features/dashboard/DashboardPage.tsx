import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { useGetOverviewQuery } from '../../store/api/locationApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Loading';
import { BusinessCard } from './components/BusinessCard';
import {
  BusinessFilterBar,
  BusinessSortBy,
  BusinessStatusFilter,
} from './components/BusinessFilterBar';
import { useDebounce } from '../../lib/hooks/useDebounce';
import { Plus } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  // Filter / sort state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BusinessStatusFilter>('');
  const [sortBy, setSortBy] = useState<BusinessSortBy>('lastOpened');
  const debouncedSearch = useDebounce(search, 300);

  const {
    data: overviewData,
    isLoading,
    isError,
    refetch,
  } = useGetOverviewQuery(
    { workspaceId, search: debouncedSearch, status, sortBy },
    { skip: !workspaceId }
  );

  const locations = overviewData?.locations || [];
  const totalCount = overviewData?.total ?? locations.length;
  const hasFilters = Boolean(search || status);

  const workspaceName =
    activeWorkspace?.name ||
    (user?.name ? `${user.name}'s Workspace` : 'Workspace');

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Your businesses
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-purple border border-brand-200 shadow-2xs">
                {totalCount}
              </span>
            </div>
            <p className="text-xs text-text-secondary font-medium mt-1">
              Workspace: {workspaceName}
            </p>
          </div>

          {/* Add business button */}
          <Link to="/locations/add" className="hidden sm:inline-block shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="font-semibold"
            >
              Add business
            </Button>
          </Link>
        </div>

        {/* ── Filter Bar ── */}
        {!isError && (
          <BusinessFilterBar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onClearFilters={handleClearFilters}
            hasFilters={hasFilters}
          />
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <Card className="p-6 bg-white border border-slate-200/80">
            <TableSkeleton rows={4} />
          </Card>
        )}

        {/* ── Error ── */}
        {!isLoading && isError && (
          <Card className="p-8 text-center space-y-3 bg-white border border-slate-200/80 max-w-lg mx-auto">
            <p className="text-xs text-rose-600 font-medium">
              Failed to load business profiles from this workspace.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        )}

        {/* ── No results from filter ── */}
        {!isLoading && !isError && locations.length === 0 && hasFilters && (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-600">
              No businesses match your filter.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── Empty state (no businesses at all) ── */}
        {!isLoading && !isError && locations.length === 0 && !hasFilters && (
          <div className="py-8 sm:py-12">
            <Card className="max-w-xl mx-auto p-8 glass-panel text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200/80 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
                  <rect x="6" y="6" width="28" height="28" rx="4" className="stroke-brand-300" strokeWidth="1.5" />
                  <line x1="6" y1="15" x2="34" y2="15" className="stroke-brand-200" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="6" y1="25" x2="34" y2="25" className="stroke-brand-200" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="15" y1="6" x2="15" y2="34" className="stroke-brand-200" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="25" y1="6" x2="25" y2="34" className="stroke-brand-200" strokeWidth="1" strokeDasharray="2 2" />
                  <circle cx="15" cy="15" r="2.5" className="fill-brand-600" />
                  <circle cx="25" cy="15" r="2.5" className="fill-brand-400" />
                  <circle cx="20" cy="20" r="3.5" className="fill-brand-600" />
                  <circle cx="15" cy="25" r="2.5" className="fill-brand-400" />
                  <circle cx="25" cy="25" r="2.5" className="fill-brand-600" />
                </svg>
              </div>

              <div className="space-y-1.5 mb-6">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Track your first business
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Connect a Google Business Profile or add coordinates to monitor local search heatmaps, rank positions, and competitor share.
                </p>
              </div>

              <div className="mb-8">
                <Link to="/locations/add" className="inline-block">
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="px-4 font-semibold shadow-xs"
                  >
                    Add your first business
                  </Button>
                </Link>
              </div>

              <div className="pt-6 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {[
                  { n: '1', title: 'Search listing', desc: 'Find storefront via Places search autocomplete.' },
                  { n: '2', title: 'Verify pin', desc: 'Confirm map coordinates and target radius.' },
                  { n: '3', title: 'Scan & rank', desc: 'Run coordinate GeoGrid heatmap checks.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="p-3 rounded-xl border border-slate-200/70 bg-white/70 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                        {n}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug pl-5.5">{desc}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Business List ── */}
        {!isLoading && !isError && locations.length > 0 && (
          <div className="space-y-4">
            {locations.map((loc) => (
              <BusinessCard
                key={loc._id}
                location={loc}
                workspaceId={workspaceId}
              />
            ))}

            {/* Dashed Add card */}
            <Link
              to="/locations/add"
              aria-label="Add business"
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50/20 transition group cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-slate-500 group-hover:text-brand-600 transition shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800 group-hover:text-brand-700">
                Add another business
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                — Connect another listing or storefront to this workspace
              </span>
            </Link>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default DashboardPage;
