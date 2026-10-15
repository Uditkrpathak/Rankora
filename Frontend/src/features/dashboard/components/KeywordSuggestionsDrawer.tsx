import React, { useState, useMemo } from 'react';
import {
  useGetKeywordSuggestionsQuery,
  useBulkAddKeywordsMutation,
} from '../../../store/api/keywordApi';
import { useToast } from '../../../components/ui/Toast';
import { VolumePill, LocalPackBadge } from './kwHelpers';
import { X, Sparkles, Plus, Check, Loader2, Search, Filter } from 'lucide-react';

interface KeywordSuggestionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  locationId: string;
  onKeywordsAdded?: () => void;
}

export const KeywordSuggestionsDrawer: React.FC<KeywordSuggestionsDrawerProps> = ({
  isOpen,
  onClose,
  workspaceId,
  locationId,
  onKeywordsAdded,
}) => {
  const toast = useToast();
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [activeLocality, setActiveLocality] = useState<string>('ALL');

  const { data, isLoading, isError, refetch } = useGetKeywordSuggestionsQuery(
    { workspaceId, locationId },
    { skip: !isOpen || !workspaceId || !locationId }
  );

  const [bulkAddKeywords, { isLoading: isAdding }] = useBulkAddKeywordsMutation();

  const suggestions = data?.suggestions || [];
  const sublocalities = data?.sublocalities || [];

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((item) => {
      if (searchFilter.trim()) {
        const matchesSearch = item.keyword
          .toLowerCase()
          .includes(searchFilter.trim().toLowerCase());
        if (!matchesSearch) return false;
      }
      if (activeLocality !== 'ALL') {
        const matchesLocality = item.keyword
          .toLowerCase()
          .includes(activeLocality.toLowerCase());
        if (!matchesLocality) return false;
      }
      return true;
    });
  }, [suggestions, searchFilter, activeLocality]);

  const toggleSelect = (keyword: string) => {
    setSelectedKws((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const selectable = filteredSuggestions.filter((s) => !s.alreadyTracked);
    const allSelected = selectable.every((s) => selectedKws.has(s.keyword));
    setSelectedKws((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectable.forEach((s) => next.delete(s.keyword));
      } else {
        selectable.forEach((s) => next.add(s.keyword));
      }
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedKws.size === 0) return;
    try {
      const keywordsToAdd = Array.from(selectedKws);
      const res = await bulkAddKeywords({
        workspaceId,
        locationId,
        keywords: keywordsToAdd,
      }).unwrap();

      toast.success(`Added ${res.totalAdded || keywordsToAdd.length} keywords to tracking`);
      setSelectedKws(new Set());
      onKeywordsAdded?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to add keywords');
    }
  };

  if (!isOpen) return null;

  const selectableCount = filteredSuggestions.filter((s) => !s.alreadyTracked).length;
  const isAllSelected =
    selectableCount > 0 &&
    filteredSuggestions
      .filter((s) => !s.alreadyTracked)
      .every((s) => selectedKws.has(s.keyword));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full animate-slide-left border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Localo Keyword Intelligence</h2>
              <p className="text-xs text-slate-500">
                100% Free AI-free seeds, Google Autocomplete & Local Pack indicators
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Sublocality Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search keyword suggestions..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
            />
          </div>

          {sublocalities.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Filter className="w-3 h-3" /> Area:
              </span>
              <button
                onClick={() => setActiveLocality('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeLocality === 'ALL'
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Areas
              </button>
              {sublocalities.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setActiveLocality(loc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeLocality === loc
                      ? 'bg-brand-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}

          {/* Select all header */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Showing {filteredSuggestions.length} suggestions
              {selectedKws.size > 0 && ` (${selectedKws.size} selected)`}
            </span>
            {selectableCount > 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="font-bold text-brand-600 hover:text-brand-700 transition"
              >
                {isAllSelected ? 'Deselect All' : 'Select All Available'}
              </button>
            )}
          </div>
        </div>

        {/* Suggestions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
              <p className="text-xs font-medium">Generating local keyword intelligence...</p>
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <p className="text-xs font-bold text-rose-600">Failed to generate suggestions.</p>
              <button
                onClick={() => refetch()}
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              No keyword suggestions matched your filters.
            </div>
          ) : (
            filteredSuggestions.map((item) => {
              const isSelected = selectedKws.has(item.keyword);
              const isDisabled = item.alreadyTracked;

              return (
                <div
                  key={item.keyword}
                  onClick={() => !isDisabled && toggleSelect(item.keyword)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                    isDisabled
                      ? 'bg-slate-50/60 border-slate-100 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-brand-50/50 border-brand-300 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                      isDisabled
                        ? 'border border-slate-300 bg-slate-100 text-slate-400'
                        : isSelected
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 bg-white hover:border-brand-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  {/* Keyword Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {item.keyword}
                      </span>
                      {isDisabled && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Tracked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <LocalPackBadge triggers={item.triggersLocalPack} />
                      <VolumePill tier={item.volumeTier} />
                      <span className="text-[10px] text-slate-400 font-medium">
                        {item.relevanceScore}% match
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {selectedKws.size > 0 ? (
              <span className="font-semibold text-slate-800">
                {selectedKws.size} keyword{selectedKws.size > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>Select keywords to track</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedKws.size === 0 || isAdding}
              onClick={handleAddSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add Selected ({selectedKws.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
