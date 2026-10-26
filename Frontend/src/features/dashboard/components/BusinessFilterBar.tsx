import React from 'react';
import { Search, ArrowUpDown, X, CheckCircle2, PauseCircle, Archive } from 'lucide-react';

export type BusinessSortBy = 'lastOpened' | 'name_asc' | 'visibility_desc' | 'rank_asc' | 'newReviews';
export type BusinessStatusFilter = '' | 'active' | 'paused' | 'archived';

interface StatusOption {
  value: BusinessStatusFilter;
  label: string;
  Icon?: React.ElementType;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active', Icon: CheckCircle2 },
  { value: 'paused', label: 'Paused', Icon: PauseCircle },
  { value: 'archived', label: 'Archived', Icon: Archive },
];

const SORT_OPTIONS: { value: BusinessSortBy; label: string }[] = [
  { value: 'lastOpened', label: 'Last opened' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'visibility_desc', label: 'Visibility score' },
  { value: 'rank_asc', label: 'Average rank' },
  { value: 'newReviews', label: 'New reviews' },
];

export interface BusinessFilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: BusinessStatusFilter;
  onStatusChange: (status: BusinessStatusFilter) => void;
  sortBy: BusinessSortBy;
  onSortChange: (sortBy: BusinessSortBy) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export const BusinessFilterBar: React.FC<BusinessFilterBarProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortChange,
  onClearFilters,
  hasFilters,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[240px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          id="business-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter businesses by name, city..."
          className="w-full pl-9 pr-8 h-9 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#006EEE] focus:ring-1 focus:ring-[#006EEE] hover:border-slate-300 transition"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(({ value, label, Icon }) => {
          const isSelected = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(value)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                isSelected
                  ? 'bg-[#006EEE] text-white border-[#006EEE]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-2 sm:ml-auto">
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <div className="relative">
          <select
            value={sortBy}
            aria-label="Sort businesses by"
            onChange={(e) => onSortChange(e.target.value as BusinessSortBy)}
            className="h-9 pl-3 pr-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:border-[#006EEE] focus:ring-1 focus:ring-[#006EEE] appearance-none cursor-pointer transition"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Active Filter Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Clear filters</span>
        </button>
      )}
    </div>
  );
};

export default BusinessFilterBar;
