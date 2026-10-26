import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useGetLocationQuery, useListLocationsQuery, Location } from '../../store/api/locationApi';
import {
  useTriggerScanMutation,
  useGetLocationScansQuery,
  useLazyGetScanByIdQuery,
  useGetScanConfigQuery,
  useGetLocationScanHistoryQuery,
} from '../../store/api/scanApi';
import {
  useListKeywordsQuery,
  useBulkAddKeywordsMutation,
  useLazyCheckKeywordRelevanceQuery,
} from '../../store/api/keywordApi';
import { useGetWorkspaceQuery } from '../../store/api/workspaceApi';
import { PointRankDrawer } from './components/PointRankDrawer';
import { TimeMachineControlBar } from './components/TimeMachineControlBar';
import { ShareScanModal } from './components/ShareScanModal';
import { WhiteLabelPdfModal } from './components/WhiteLabelPdfModal';
import { BusinessPerformanceCard } from './components/BusinessPerformanceCard';
import { KeywordSelectorBar } from './components/KeywordSelectorBar';
import { RankTrackingSubNavbar } from './components/RankTrackingSubNavbar';
import { CompetitorsLeaderboard } from './components/CompetitorsLeaderboard';
import { TARGET_PLACE_ID } from './rankTrackingConstants';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import { useToast } from '../../components/ui/Toast';
import { IGridPointResult, IScanRun } from '@localo/types';
import {
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ExternalLink,
  Star,
  Building2,
  Clock,
  Share2,
  FileDown,
  Plus,
  X,
  PanelLeftClose,
  PanelLeft,
  ListFilter,
  Sparkles,
  AlertCircle,
  Compass,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Trophy,
} from 'lucide-react';

const GeoGridHeatmap = lazy(() =>
  import('./components/GeoGridHeatmap').then((module) => ({ default: module.GeoGridHeatmap }))
);

const normalizeKeyword = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const isRealSunflowerScan = (scan: IScanRun) =>
  !scan.gridPoints?.some((point) => point.provider?.toUpperCase() === 'MOCK');

interface AggregatedCompetitor {
  placeId: string;
  name: string;
  address?: string;
  primaryCategory?: string;
  rating?: number;
  reviewsCount?: number;
  bestRank: number;
  atrp: number; // Average Total Rank Position (unranked pins = 21)
  arp: number | null; // Found-only average rank
  solv: number; // Share of Local Voice (% in top 3)
  coveragePercent: number;
  occurrences: number;
  isTarget: boolean;
  standing?: number;
  photoUrl?: string;
}

export const RankTrackingPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLocationId = searchParams.get('locationId') || '';
  const requestedKeyword = searchParams.get('keyword') || '';
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const { currentData: locationsData } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );
  const { currentData: requestedLocation } = useGetLocationQuery(
    { workspaceId, locId: requestedLocationId },
    { skip: !workspaceId || !requestedLocationId }
  );
  const { currentData: workspaceData, refetch: refetchWorkspace } = useGetWorkspaceQuery(workspaceId, {
    skip: !workspaceId,
  });
  const { currentData: scanConfigResponse, isError: scanConfigError } = useGetScanConfigQuery({ workspaceId }, { skip: !workspaceId });
  const scanConfig = scanConfigResponse?.data;
  const locations: Location[] = locationsData?.locations || [];

  const [activeKeyword, setActiveKeyword] = useState<string>('');
  const [selectedPoint, setSelectedPoint] = useState<IGridPointResult | null>(null);
  const [focusedPlaceId, setFocusedPlaceId] = useState(TARGET_PLACE_ID);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [competitorsHidden, setCompetitorsHidden] = useState(false);
  const autoScanAttempts = useRef(new Set<string>());
  const pendingScanRequests = useRef(new Set<string>());
  const [queuedScan, setQueuedScan] = useState<IScanRun | null>(null);
  const selectPoint = useCallback((point: IGridPointResult) => setSelectedPoint(point), []);

  // Time Machine & Modals State
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isAddKeywordModalOpen, setIsAddKeywordModalOpen] = useState(false);
  const [isRadiusSettingsOpen, setIsRadiusSettingsOpen] = useState(false);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(5.0);
  const [useCustomCenter, setUseCustomCenter] = useState(false);
  const [customCenterLat, setCustomCenterLat] = useState('');
  const [customCenterLng, setCustomCenterLng] = useState('');
  const [newKeywordsInput, setNewKeywordsInput] = useState('');
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'none' | 'baseline' | 'previous'>('none');
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (selectedLocationId) {
      try {
        const stored = localStorage.getItem(`localo_dismissed_tasks_${selectedLocationId}`);
        setDismissedTaskIds(stored ? JSON.parse(stored) : []);
      } catch {
        setDismissedTaskIds([]);
      }
    }
  }, [selectedLocationId]);

  const handleDismissTask = (taskId: string) => {
    setDismissedTaskIds((prev) => {
      const updated = [...prev, taskId];
      try {
        localStorage.setItem(`localo_dismissed_tasks_${selectedLocationId}`, JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  // Direct links can refer to a location outside the first list page.
  useEffect(() => {
    if (requestedLocationId) {
      setSelectedLocationId(requestedLocationId);
    } else if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0]._id);
    }
  }, [locations, requestedLocationId, selectedLocationId]);

  const [triggerScan, { isLoading: isTriggering }] = useTriggerScanMutation();
  const [bulkAddKeywords, { isLoading: isAddingKeywords }] = useBulkAddKeywordsMutation();
  const [checkRelevance] = useLazyCheckKeywordRelevanceQuery();
  const [keywordRelevanceWarning, setKeywordRelevanceWarning] = useState<{ warning: string; suggestions: string[] } | null>(null);

  const { currentData: trackedKeywordData, refetch: refetchKeywords } = useListKeywordsQuery(
    { workspaceId, locationId: selectedLocationId, limit: 50, sortBy: 'visibility' },
    { skip: !workspaceId || !selectedLocationId }
  );
  const trackedKeywords = trackedKeywordData?.keywords || [];

  const handleAddKeywords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordsInput.trim() || !workspaceId || !selectedLocationId) return;

    const parsedKeywords = newKeywordsInput
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (parsedKeywords.length === 0) return;

    try {
      await bulkAddKeywords({
        workspaceId,
        locationId: selectedLocationId,
        keywords: parsedKeywords,
      }).unwrap();

      setNewKeywordsInput('');
      setIsAddKeywordModalOpen(false);
      refetchKeywords();

      // Automatically select and scan first new keyword
      const firstKw = parsedKeywords[0];
      handleSelectKeyword(firstKw);
      setTimeout(() => {
        executeScan(firstKw, true);
      }, 300);
    } catch (err: any) {
      toast.error(err?.data?.error?.message || err?.message || 'Failed to add keywords.');
    }
  };

  const { currentData: scansData, isSuccess: scansLoaded, refetch: refetchScans } = useGetLocationScansQuery(
    { workspaceId, locationId: selectedLocationId, limit: 100 },
    { skip: !workspaceId || !selectedLocationId }
  );
  const scans = scansData?.data || [];

  const { currentData: historyData } = useGetLocationScanHistoryQuery(
    { workspaceId, locationId: selectedLocationId, keyword: activeKeyword },
    { skip: !workspaceId || !selectedLocationId || !activeKeyword }
  );
  const historyScans = historyData?.data || [];

  // Sync latest history index
  useEffect(() => {
    if (historyScans.length > 0) {
      setHistoryIndex(historyScans.length - 1);
    }
  }, [historyScans.length]);

  // History Playback Timer
  useEffect(() => {
    if (!isPlayingHistory || historyScans.length <= 1) return;
    const timer = setInterval(() => {
      setHistoryIndex((prev) => (prev + 1) % historyScans.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlayingHistory, historyScans.length]);

  // Sync active keyword
  useEffect(() => {
    if (requestedKeyword) {
      setActiveKeyword(requestedKeyword);
    } else if (trackedKeywords.length > 0 && !activeKeyword) {
      setActiveKeyword(trackedKeywords[0].keyword);
    }
  }, [requestedKeyword, trackedKeywords, activeKeyword]);

  // Pre-scan relevance evaluation (§Keyword Engine V2)
  useEffect(() => {
    if (!workspaceId || !selectedLocationId || !activeKeyword.trim()) {
      setKeywordRelevanceWarning(null);
      return;
    }
    let isMounted = true;
    checkRelevance({ workspaceId, locationId: selectedLocationId, keyword: activeKeyword.trim() })
      .unwrap()
      .then((res: any) => {
        if (!isMounted) return;
        if (res?.isInformational && res?.warning) {
          setKeywordRelevanceWarning({
            warning: res.warning,
            suggestions: res.suggestedReplacements || [],
          });
        } else {
          setKeywordRelevanceWarning(null);
        }
      })
      .catch(() => {
        if (isMounted) setKeywordRelevanceWarning(null);
      });
    return () => {
      isMounted = false;
    };
  }, [workspaceId, selectedLocationId, activeKeyword, checkRelevance]);

  useEffect(() => {
    setActiveScanId(null);
    setQueuedScan(null);
    setSelectedPoint(null);
  }, [requestedKeyword, selectedLocationId]);

  const selectedLocation = requestedLocation?._id === selectedLocationId
    ? requestedLocation
    : locations.find((location) => location._id === selectedLocationId);

  // Scans for active keyword
  const normalizedActiveKeyword = normalizeKeyword(activeKeyword);
  const matchingKeywordScans = useMemo(() => {
    return normalizedActiveKeyword
      ? scans.filter((scan) => normalizeKeyword(scan.keyword) === normalizedActiveKeyword && isRealSunflowerScan(scan))
      : [];
  }, [scans, normalizedActiveKeyword]);

  const latestKeywordScan = matchingKeywordScans[0];
  const previousMeasuredScan = latestKeywordScan?.status === 'FAILED'
    ? matchingKeywordScans.find((scan) => {
      if (scan.status !== 'COMPLETED' && scan.status !== 'PARTIAL') return false;
      const completedAt = scan.completedAt ? new Date(scan.completedAt).getTime() : NaN;
      const freshnessMs = scan.status === 'PARTIAL'
        ? scanConfig?.partialReuseMs : scanConfig?.staleAfterMs;
      return Number.isFinite(completedAt) && freshnessMs !== undefined &&
        Date.now() - completedAt < freshnessMs &&
        scan.gridPoints?.some((point) => point.observationState === 'OBSERVED' &&
          Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK'));
    })
    : undefined;
  const savedScanToDisplay = previousMeasuredScan || latestKeywordScan;
  const currentScanId = activeScanId || savedScanToDisplay?._id;

  const [loadActiveScan, { currentData: activeScanData }] = useLazyGetScanByIdQuery();

  useEffect(() => {
    if (!workspaceId || !currentScanId) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const fetchUntilTerminal = async () => {
      try {
        const result = await loadActiveScan({ workspaceId, scanId: currentScanId }, false).unwrap();
        const status = result.data.status;
        if (!cancelled && (status === 'QUEUED' || status === 'RUNNING')) {
          timeout = setTimeout(fetchUntilTerminal, 2500);
        }
      } catch {
        if (!cancelled) timeout = setTimeout(fetchUntilTerminal, 2500);
      }
    };
    void fetchUntilTerminal();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [workspaceId, currentScanId, loadActiveScan]);

  const scanMatchesSelection = (scan: IScanRun | null | undefined): scan is IScanRun =>
    Boolean(scan && scan.locationId === selectedLocationId &&
      normalizeKeyword(scan.keyword) === normalizedActiveKeyword && isRealSunflowerScan(scan));

  const currentScan: IScanRun | undefined =
    scanMatchesSelection(activeScanData?.data) && activeScanData?.data._id === currentScanId
      ? activeScanData.data
      : scanMatchesSelection(queuedScan) && queuedScan._id === currentScanId
        ? queuedScan
        : savedScanToDisplay;

  // Trigger scan execution
  const executeScan = useCallback(
    async (targetKeyword: string, force = false) => {
      if (!targetKeyword.trim() || !selectedLocationId || !workspaceId || !scanConfig) return;
      const requestKey = `${selectedLocationId}:${normalizeKeyword(targetKeyword)}`;
      if (pendingScanRequests.current.has(requestKey)) return;
      pendingScanRequests.current.add(requestKey);
      setScanError(null);
      setSelectedPoint(null);

      const centerCoords = useCustomCenter && Number.isFinite(parseFloat(customCenterLat)) && Number.isFinite(parseFloat(customCenterLng))
        ? { lat: parseFloat(customCenterLat), lng: parseFloat(customCenterLng) }
        : undefined;

      try {
        const res = await triggerScan({
          workspaceId,
          locationId: selectedLocationId,
          keyword: targetKeyword.trim(),
          scanShape: 'SUNFLOWER',
          radiusKm: selectedRadiusKm,
          center: centerCoords,
          force,
        }).unwrap();

        if (res?.data?._id) {
          setActiveScanId(res.data._id);
          setQueuedScan(res.data);
          setFocusedPlaceId(TARGET_PLACE_ID);
          refetchScans();
          refetchWorkspace();
        }
      } catch (err: any) {
        const data = err?.data;
        const message =
          data?.error?.message ||
          data?.message ||
          err?.error ||
          (err?.status ? `Request failed (${err.status})` : 'Could not start the scan.');
        setScanError(message);
      } finally {
        pendingScanRequests.current.delete(requestKey);
      }
    },
    [selectedLocationId, workspaceId, scanConfig, triggerScan, refetchScans, refetchWorkspace, selectedRadiusKm, useCustomCenter, customCenterLat, customCenterLng]
  );

  // A direct keyword link reuses a fresh saved 31-point scan. Only one new
  // request is attempted per keyword when there is no usable recent scan.
  useEffect(() => {
    if (!requestedKeyword || !workspaceId || !selectedLocationId ||
      !normalizedActiveKeyword || !scansLoaded || !scanConfig) return;
    const attemptKey = `${selectedLocationId}:${normalizedActiveKeyword}`;
    if (autoScanAttempts.current.has(attemptKey)) return;
    autoScanAttempts.current.add(attemptKey);

    if (latestKeywordScan?.status === 'QUEUED' || latestKeywordScan?.status === 'RUNNING' ||
      latestKeywordScan?.status === 'FAILED') return;

    const observedPoints = latestKeywordScan?.gridPoints?.filter(
      (point) => point.observationState === 'OBSERVED' &&
        Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK')
    ).length ?? 0;
    if ((latestKeywordScan?.status === 'COMPLETED' || latestKeywordScan?.status === 'PARTIAL') &&
      observedPoints === 0) return;
    const completedAt = latestKeywordScan?.completedAt
      ? new Date(latestKeywordScan.completedAt).getTime() : NaN;
    const freshnessMs = latestKeywordScan?.status === 'PARTIAL'
      ? scanConfig.partialReuseMs : scanConfig.staleAfterMs;
    const isFresh = (latestKeywordScan?.status === 'COMPLETED' || latestKeywordScan?.status === 'PARTIAL') &&
      observedPoints > 0 && Number.isFinite(completedAt) &&
      Date.now() - completedAt < freshnessMs;
    if (!isFresh) void executeScan(activeKeyword);
  }, [requestedKeyword, workspaceId, selectedLocationId, normalizedActiveKeyword, scansLoaded, scanConfig, latestKeywordScan, executeScan, activeKeyword]);

  const handleSelectKeyword = (kw: string) => {
    setActiveKeyword(kw);
    setActiveScanId(null);
    setQueuedScan(null);
    setScanError(null);
    setFocusedPlaceId(TARGET_PLACE_ID);
    setSelectedPoint(null);
    setSearchParams({ locationId: selectedLocationId, keyword: kw });
  };

  const [sidebarTab, setSidebarTab] = useState<'overview' | 'competitors' | 'actions'>('overview');
  const [leaderboardPage, setLeaderboardPage] = useState<number>(1);
  const LEADERBOARD_PAGE_SIZE = 10;

  // Extract and rank all market entities (tracked business + competitors)
  const {
    allEntities,
    targetEntity,
    targetStanding,
    totalMarketCount,
    qualifiedCompetitors,
    paginatedCompetitors,
    totalLeaderboardPages,
  } = useMemo(() => {
    if (!currentScan || !currentScan.gridPoints) {
      return {
        allEntities: [],
        targetEntity: null,
        targetStanding: null,
        totalMarketCount: 0,
        qualifiedCompetitors: [],
        paginatedCompetitors: [],
        totalLeaderboardPages: 1,
      };
    }

    const measuredPoints = currentScan.gridPoints.filter(
      (point) =>
        point.observationState === 'OBSERVED' &&
        Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK')
    );
    const totalPoints = measuredPoints.length > 0 ? measuredPoints.length : (currentScan.gridPoints.length || 1);
    const minThresholdPins = Math.max(2, Math.ceil(totalPoints * 0.1));

    const entityMap = new Map<
      string,
      {
        placeId: string;
        cid?: string;
        name: string;
        address?: string;
        primaryCategory?: string;
        rating?: number;
        reviewsCount?: number;
        ranks: number[];
        isTarget: boolean;
      }
    >();

    // 1. Initialize Tracked Business (even at 0 pins)
    const targetPlaceId = TARGET_PLACE_ID;
    entityMap.set(targetPlaceId, {
      placeId: targetPlaceId,
      name: selectedLocation?.name || 'Your Business',
      address: selectedLocation?.address,
      primaryCategory: selectedLocation?.categories?.[0] || (selectedLocation as any)?.primaryCategory,
      rating: (selectedLocation as any)?.averageRating || (selectedLocation as any)?.rating,
      reviewsCount: (selectedLocation as any)?.totalReviewCount || (selectedLocation as any)?.reviewsCount,
      ranks: [],
      isTarget: true,
    });

    // 2. Collect ranks across measured grid points with CID identity
    for (const pt of measuredPoints) {
      if (typeof pt.targetRank === 'number' && pt.targetRank >= 1 && pt.targetRank <= 20) {
        entityMap.get(targetPlaceId)!.ranks.push(pt.targetRank);
      }

      for (const it of pt.items || []) {
        if (it.isTarget) continue;
        const idKey = (it as any).cid || it.placeId || it.name;
        let comp = entityMap.get(idKey);
        if (!comp) {
          comp = {
            placeId: it.placeId || idKey,
            cid: (it as any).cid,
            name: it.name,
            address: it.address,
            primaryCategory: it.primaryCategory,
            rating: it.rating,
            reviewsCount: it.reviewsCount,
            ranks: [],
            isTarget: false,
          };
          entityMap.set(idKey, comp);
        }
        if (typeof it.rank === 'number' && it.rank >= 1 && it.rank <= 20) {
          comp.ranks.push(it.rank);
        }
        if (!comp.rating && it.rating) comp.rating = it.rating;
        if (!comp.reviewsCount && it.reviewsCount) comp.reviewsCount = it.reviewsCount;
        if (!comp.primaryCategory && it.primaryCategory) comp.primaryCategory = it.primaryCategory;
        if (!comp.address && it.address) comp.address = it.address;
      }
    }

    // 3. Compute spatial metrics for every entity
    const computedEntities: AggregatedCompetitor[] = [];
    for (const item of entityMap.values()) {
      const validRanks = item.ranks.filter((r) => r >= 1 && r <= 20);
      const rankedCount = validRanks.length;
      const unrankedCount = Math.max(0, totalPoints - rankedCount);
      const rankedSum = validRanks.reduce((a, b) => a + b, 0);
      const totalRankSum = rankedSum + unrankedCount * 21;

      const atrp = parseFloat((totalRankSum / totalPoints).toFixed(1));
      const arp = rankedCount > 0 ? parseFloat((rankedSum / rankedCount).toFixed(1)) : null;
      const top3Count = validRanks.filter((r) => r <= 3).length;
      const solv = parseFloat(((top3Count / totalPoints) * 100).toFixed(1));
      const coveragePercent = Math.round((rankedCount / totalPoints) * 100);
      const bestRank = validRanks.length > 0 ? Math.min(...validRanks) : 21;

      computedEntities.push({
        placeId: item.placeId,
        name: item.name,
        address: item.address,
        primaryCategory: item.primaryCategory,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        bestRank,
        atrp,
        arp,
        solv,
        coveragePercent,
        occurrences: rankedCount,
        isTarget: item.isTarget,
      });
    }

    // 4. Primary sort by ATRP ascending, tie-breaker SoLV descending, with deterministic name tie-break
    computedEntities.sort((a, b) => {
      // 1. Primary: ATRP ascending
      if (a.atrp !== b.atrp) return a.atrp - b.atrp;
      // 2. Tie-breaker: SoLV descending
      if (b.solv !== a.solv) return b.solv - a.solv;
      // 3. Secondary: Coverage descending
      if (b.coveragePercent !== a.coveragePercent) return b.coveragePercent - a.coveragePercent;
      // 4. Secondary: Best Rank ascending
      if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
      // 5. Secondary: Reviews / Rating
      if ((b.reviewsCount || 0) !== (a.reviewsCount || 0)) return (b.reviewsCount || 0) - (a.reviewsCount || 0);
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      // 6. Deterministic tie-breaker: Name alphabetical ascending
      return a.name.localeCompare(b.name);
    });

    // Assign standings across all market entities
    computedEntities.forEach((e, idx) => {
      e.standing = idx + 1;
    });

    const target = computedEntities.find((e) => e.isTarget) || null;
    const targetStanding = target?.standing ?? 1;
    const totalMarketCount = computedEntities.length;

    // Filter competitors with coverage threshold max(2 pins, 10%)
    const nonTargetEntities = computedEntities.filter((e) => !e.isTarget);
    const qualifiedCompetitors = nonTargetEntities.filter((e) => e.occurrences >= minThresholdPins);
    const totalLeaderboardPages = Math.max(1, Math.ceil(qualifiedCompetitors.length / LEADERBOARD_PAGE_SIZE));
    const paginatedCompetitors = qualifiedCompetitors.slice(
      (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE,
      leaderboardPage * LEADERBOARD_PAGE_SIZE
    );

    return {
      allEntities: computedEntities,
      targetEntity: target,
      targetStanding,
      totalMarketCount,
      qualifiedCompetitors,
      paginatedCompetitors,
      totalLeaderboardPages,
      minThresholdPins,
    };
  }, [currentScan, selectedLocation, leaderboardPage]);

  const competitors = qualifiedCompetitors;

  // Target business metrics
  const activeMetrics = useMemo(() => {
    if (!currentScan || !currentScan.gridPoints || currentScan.gridPoints.length === 0) {
      return currentScan?.metrics;
    }
    if (focusedPlaceId === TARGET_PLACE_ID) {
      if (targetEntity) {
        return {
          arp: targetEntity.arp,
          atrp: targetEntity.atrp,
          solv: targetEntity.solv,
          coverage: targetEntity.coveragePercent,
          visibilityIndex: currentScan.metrics?.visibilityIndex ?? targetEntity.solv,
        };
      }
      return currentScan.metrics;
    }

    const matched = allEntities.find((e) => e.placeId === focusedPlaceId);
    if (matched) {
      return {
        arp: matched.arp,
        atrp: matched.atrp,
        solv: matched.solv,
        coverage: matched.coveragePercent,
        visibilityIndex: matched.solv,
      };
    }
    return null;
  }, [currentScan, focusedPlaceId, targetEntity, allEntities]);

  // Target business display details (Visibility defined as SoLV for now)
  const targetAtrp = targetEntity?.atrp ?? (currentScan?.metrics?.atrp ?? 21.0);
  const targetArp = targetEntity?.arp ?? (currentScan?.metrics?.arp ?? null);
  const targetVisibility = targetEntity?.solv ?? (currentScan?.metrics?.solv ?? 0.0);
  const atrpDelta = useMemo(() => {
    if (historyScans.length >= 2) {
      const prevAtrp = historyScans[historyScans.length - 2]?.metrics?.atrp;
      if (typeof prevAtrp === 'number' && typeof targetAtrp === 'number') {
        return Number((prevAtrp - targetAtrp).toFixed(1));
      }
    }
    return null;
  }, [historyScans, targetAtrp]);
  const focusedCompetitor = focusedPlaceId !== TARGET_PLACE_ID ? allEntities.find((c) => c.placeId === focusedPlaceId) : null;

  const scanTimestamp = currentScan?.completedAt || currentScan?.createdAt;
  const formattedScanDate = scanTimestamp
    ? new Date(scanTimestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' at ' +
    new Date(scanTimestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    : 'No saved scan';
  const scanPointCount = scanConfig?.scanShapes?.SUNFLOWER?.pointCount || 31;
  const scanCostLabel = `${scanPointCount} map points`;
  const scanRunning = currentScan?.status === 'QUEUED' || currentScan?.status === 'RUNNING';
  const activeDisplayScan = isTimeMachineOpen && historyScans.length > 0 ? (historyScans[historyIndex] || currentScan) : currentScan;
  const comparisonScan = comparisonMode === 'baseline' ? historyScans[0] : comparisonMode === 'previous' ? historyScans[Math.max(0, historyIndex - 1)] : null;
  const comparisonPoints = comparisonMode !== 'none' ? comparisonScan?.gridPoints : null;

  const measuredPoints = activeDisplayScan?.gridPoints?.filter(
    (point) => point.observationState === 'OBSERVED' &&
      Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK')
  ) ?? [];
  const measuredSources = Array.from(new Set(measuredPoints.map((point) => point.provider?.toUpperCase()).filter(Boolean)));
  const terminalWithoutMeasurements = Boolean(
    activeDisplayScan && (activeDisplayScan.status === 'COMPLETED' || activeDisplayScan.status === 'PARTIAL') &&
    measuredPoints.length === 0
  );
  const mapCenter = activeDisplayScan?.center || selectedLocation?.coordinates;
  const hasValidMapCenter = mapCenter && typeof mapCenter.lat === 'number' && typeof mapCenter.lng === 'number' && !Number.isNaN(mapCenter.lat) && !Number.isNaN(mapCenter.lng);
  const mapRadius = activeDisplayScan?.radiusKm || scanConfig?.defaultSunflowerRadiusKm || selectedRadiusKm || 5.0;

  const currentAreaDifficulty = useMemo<'LOW' | 'MEDIUM' | 'HIGH' | null>(() => {
    if (activeDisplayScan?.areaDifficulty) {
      return activeDisplayScan.areaDifficulty;
    }
    if (selectedLocation?.cachedKpis?.areaDifficulty) {
      return selectedLocation.cachedKpis.areaDifficulty as 'LOW' | 'MEDIUM' | 'HIGH';
    }
    const pinDiffs = (activeDisplayScan?.gridPoints || [])
      .filter((p) => typeof p.difficulty === 'number' && p.observationState !== 'MISSING')
      .map((p) => p.difficulty as number);
    if (pinDiffs.length > 0) {
      const sorted = [...pinDiffs].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      return med <= 3 ? 'LOW' : med <= 6 ? 'MEDIUM' : 'HIGH';
    }
    return null;
  }, [activeDisplayScan, selectedLocation]);

  const activeTasks = useMemo(() => {
    const rawTasks = selectedLocation?.recommendedTasks || [];
    return rawTasks.filter((t) => !dismissedTaskIds.includes(t.id));
  }, [selectedLocation?.recommendedTasks, dismissedTaskIds]);

  const renderSidebarContent = () => (
    <div className="p-4 space-y-3.5">
      {/* 1. Keywords Section */}
      <KeywordSelectorBar
        trackedKeywords={trackedKeywords}
        activeKeyword={activeKeyword}
        onSelectKeyword={(kw) => {
          handleSelectKeyword(kw);
          setIsMobileDrawerOpen(false);
        }}
        onOpenAddModal={() => setIsAddKeywordModalOpen(true)}
        scanCostLabel={scanCostLabel}
        measuredSources={measuredSources as string[]}
        formattedScanDate={formattedScanDate}
        keywordRelevanceWarning={keywordRelevanceWarning}
        onSelectSuggestedKeyword={(sug) => {
          handleSelectKeyword(sug);
          setKeywordRelevanceWarning(null);
        }}
      />

      {currentScan?.status === 'PARTIAL' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>Degraded Scan Results</span>
            </div>
            <button
              onClick={() => executeScan(activeKeyword, true)}
              disabled={isTriggering || scanRunning}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={isTriggering ? 'animate-spin' : ''} />
              <span>Retry Missing Pins</span>
            </button>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {measuredPoints.length} of {currentScan.gridPoints?.length || 31} points measured
            {currentScan.gridPoints && currentScan.gridPoints.length > measuredPoints.length
              ? ` (${currentScan.gridPoints.length - measuredPoints.length} unavailable due to technical failures).`
              : '.'}
            {(() => {
              const failurePoints = (currentScan.gridPoints || []).filter(
                (p) => p.observationState === 'MISSING' || (p.error && (!p.items || p.items.length === 0))
              );
              if (failurePoints.length === 0) return '';
              const reasonCounts = new Map<string, number>();
              for (const p of failurePoints) {
                const err = p.error || '';
                let label = 'Network failure';
                if (err.includes('The client is destroyed') || err.includes('client is destroyed') || err.includes('LOCAL_CLIENT_ERROR')) {
                  label = 'Local client error';
                } else if (err.includes('CIRCUIT_BREAKER') || err.includes('All configured live SERP providers are unavailable')) {
                  label = 'Circuit breaker open';
                } else if (err.includes('POINT_TIMEOUT') || err.includes('12s')) {
                  label = 'Point timeout (12s)';
                } else if (err.includes('TIMEOUT')) {
                  label = 'Upstream timeout';
                } else if (err.includes('403') || err.includes('BLOCKED')) {
                  label = 'Blocked (403)';
                } else if (err.includes('CAPTCHA')) {
                  label = 'Bot challenge/CAPTCHA';
                } else if (err.includes('budget')) {
                  label = 'Spend budget limit';
                }
                reasonCounts.set(label, (reasonCounts.get(label) || 0) + 1);
              }
              const breakdown = Array.from(reasonCounts.entries())
                .map(([lbl, count]) => `${count} ${lbl}`)
                .join(', ');
              return breakdown ? ` Causes: ${breakdown}.` : '';
            })()}
            {currentScan.credits?.refundAmount
              ? ` ${currentScan.credits.refundAmount} credits were refunded to your balance.`
              : ' Metrics calculated across measured points.'}
          </p>
        </div>
      )}

      {/* 2. Dedicated Navigation Tabs */}
      <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold gap-1">
        <button
          type="button"
          onClick={() => setSidebarTab('overview')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            sidebarTab === 'overview'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setSidebarTab('competitors')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            sidebarTab === 'competitors'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={13} className={sidebarTab === 'competitors' ? 'text-[#006EEE]' : 'text-slate-400'} />
          <span>Competitors</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              sidebarTab === 'competitors'
                ? 'bg-[#006EEE] text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {qualifiedCompetitors.length}
          </span>
        </button>

        {activeTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setSidebarTab('actions')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              sidebarTab === 'actions'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={13} className={sidebarTab === 'actions' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Actions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                sidebarTab === 'actions'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeTasks.length}
            </span>
          </button>
        )}
      </div>

      {/* 3. Tab: OVERVIEW */}
      {sidebarTab === 'overview' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Target Business Performance Card */}
          <BusinessPerformanceCard
            selectedLocation={selectedLocation}
            focusedPlaceId={focusedPlaceId}
            onFocusTarget={() => setFocusedPlaceId(TARGET_PLACE_ID)}
            targetStanding={targetStanding}
            totalMarketCount={totalMarketCount}
            targetEntity={targetEntity}
            targetAtrp={targetAtrp}
            targetVisibility={targetVisibility}
            currentAreaDifficulty={currentAreaDifficulty}
            measuredPointsCount={measuredPoints.length}
            totalGridPointsCount={currentScan?.gridPoints?.length || 31}
            formattedScanDate={formattedScanDate}
            currentScan={currentScan}
            atrpDelta={atrpDelta}
          />

          {/* Quick Competitors Preview Card */}
          {qualifiedCompetitors.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Trophy size={14} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">Top Competitors</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarTab('competitors')}
                  className="text-[11px] font-semibold text-[#006EEE] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View all {qualifiedCompetitors.length}</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="space-y-1.5">
                {qualifiedCompetitors.slice(0, 3).map((comp) => {
                  const isFocused = focusedPlaceId === comp.placeId;
                  return (
                    <div
                      key={comp.placeId}
                      onClick={() => {
                        setFocusedPlaceId(isFocused ? TARGET_PLACE_ID : comp.placeId);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 bg-white ${
                        isFocused
                          ? 'border-[#006EEE] ring-1 ring-[#006EEE]/20'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black shrink-0 ${
                          comp.standing === 1
                            ? 'bg-amber-100 text-amber-800'
                            : comp.standing === 2
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          #{comp.standing}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{comp.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{comp.address || 'Local competitor'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-slate-700">
                          ATRP {comp.atrp.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-[#006EEE] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          SoLV {comp.solv.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Actions CTA Button */}
          {activeTasks.length > 0 && (
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                navigate(`/recommendations?locationId=${selectedLocationId}`);
              }}
              className="w-full p-3.5 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/80 hover:from-indigo-100/90 hover:to-blue-100/90 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between text-left group shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#623CD0] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles size={15} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Recommended Actions
                    </span>
                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-extrabold shrink-0">
                      {activeTasks.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {activeTasks.filter((t) => t.impact === 'HIGH').length > 0
                      ? `${activeTasks.filter((t) => t.impact === 'HIGH').length} high-impact steps to beat rivals`
                      : 'Actionable steps to close pack gaps'}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* 4. Tab: COMPETITORS */}
      {sidebarTab === 'competitors' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <CompetitorsLeaderboard
            competitors={qualifiedCompetitors}
            paginatedCompetitors={paginatedCompetitors}
            focusedPlaceId={focusedPlaceId}
            onFocusCompetitor={(id) => {
              setFocusedPlaceId(id);
              setIsMobileDrawerOpen(false);
            }}
            competitorsHidden={competitorsHidden}
            onToggleHidden={() => setCompetitorsHidden(!competitorsHidden)}
            measuredPointsCount={measuredPoints.length}
            leaderboardPage={leaderboardPage}
            totalLeaderboardPages={totalLeaderboardPages}
            onPageChange={(p) => setLeaderboardPage(p)}
            hasScan={Boolean(currentScan)}
            isTriggering={isTriggering}
          />
        </div>
      )}

      {/* 5. Tab: ACTIONS */}
      {sidebarTab === 'actions' && activeTasks.length > 0 && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-slate-800">Priority Steps ({activeTasks.length})</span>
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                navigate(`/recommendations?locationId=${selectedLocationId}`);
              }}
              className="text-xs font-bold text-[#006EEE] hover:underline cursor-pointer"
            >
              Full Recommendations →
            </button>
          </div>
          <div className="space-y-2">
            {activeTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    task.impact === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {task.impact} IMPACT
                  </span>
                  {task.category && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      {task.category}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{task.title}</h4>
                {task.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-screen h-screen bg-white overflow-hidden">
      {/* Dedicated Full-Width Top Header */}
      <RankTrackingSubNavbar
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocationId={(nextId) => {
          setSelectedLocationId(nextId);
          setActiveKeyword('');
          setSearchParams({ locationId: nextId });
        }}
        requestedLocation={requestedLocation}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        onBack={() => navigate('/locations')}
        currentScan={currentScan}
        isTriggering={isTriggering}
        scanRunning={scanRunning}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        onOpenRadiusSettings={() => setIsRadiusSettingsOpen(true)}
        selectedRadiusKm={selectedRadiusKm}
        onRefreshScan={() => executeScan(activeKeyword, true)}
        scanCostLabel={scanCostLabel}
        canRefresh={!isTriggering && !scanRunning && Boolean(activeKeyword) && Boolean(scanConfig)}
        keywordsCount={trackedKeywords.length}
        formattedScanDate={formattedScanDate}
      />

        {/* Main Body Split: Left Sidebar & Right Map Area */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Desktop Left Sidebar */}
          {isSidebarOpen && (
            <aside className="w-[480px] lg:w-[480px] xl:w-[540px] 2xl:w-[600px] bg-white border-r border-slate-200 hidden lg:flex flex-col shrink-0 overflow-y-auto z-20 shadow-xs">
              {renderSidebarContent()}
            </aside>
          )}

          {/* Mobile / Tablet Drawer Modal */}
          {isMobileDrawerOpen && (
            <div className="fixed inset-0 z-[500] flex lg:hidden">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
                onClick={() => setIsMobileDrawerOpen(false)}
              />
              <div className="relative w-[380px] sm:w-[460px] max-w-[90vw] h-full bg-white shadow-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-left">
                <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                  <span className="font-bold text-xs text-slate-800">Keywords & Competitors</span>
                  <button
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderSidebarContent()}
                </div>
              </div>
            </div>
          )}

          {/* Right Main Map Area */}
          <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-100 min-w-0">

            {(scanError || currentScan?.status === 'FAILED' || terminalWithoutMeasurements || scanConfigError) && (
              <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[450] rounded-xl border border-red-200 bg-white/95 backdrop-blur-md px-4 py-3 text-xs text-red-700 shadow-xl animate-in fade-in">
                <div className="font-bold text-sm">Rank scan unavailable</div>
                <p className="mt-1 leading-relaxed">
                  {scanError || latestKeywordScan?.error || currentScan?.error ||
                    (scanConfigError ? 'Could not load scan settings from the server.' : 'The provider did not return any measured rankings.')}
                  {previousMeasuredScan ? ' Showing an earlier saved map.' : ''}
                </p>
                {activeKeyword && scanConfig && !isTriggering && (
                  <button onClick={() => executeScan(activeKeyword, true)} className="mt-2 inline-flex font-bold text-[#006EEE] hover:underline cursor-pointer">
                    Retry · {scanCostLabel}
                  </button>
                )}
              </div>
            )}

            {scanRunning && (
              <div className="absolute top-16 left-3 sm:left-4 z-[440] rounded-xl border border-blue-200 bg-white/95 backdrop-blur-md px-3.5 py-2 text-xs text-blue-800 shadow-lg flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-[#006EEE]" />
                <span>
                  {currentScan?.status === 'QUEUED' ? 'Waiting for the scan worker…' : 'Collecting real Google Maps results'}
                  {' · '}{measuredPoints.length}/{currentScan?.pointCount || scanPointCount || '—'} points
                </span>
              </div>
            )}

            {/* KPI Floating Bar (Top-Left Clean & Compact) */}
            {currentScan?.metrics && measuredPoints.length > 0 && (
              <div className="absolute top-3 left-3 z-[400] pointer-events-none flex flex-col gap-2 max-w-[calc(100%-24px)] sm:max-w-none">
                <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-4 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-2 shadow-lg">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">ARP (Avg)</div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {activeMetrics?.arp ? `#${activeMetrics.arp.toFixed(1)}` : '—'}
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200" />
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">SoLV (Top 3)</div>
                    <div className="text-base sm:text-lg font-black text-emerald-600">
                      {activeMetrics?.solv !== undefined ? `${activeMetrics.solv.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200" />
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Visibility</div>
                    <div className="text-base sm:text-lg font-black text-[#006EEE]">
                      {activeMetrics?.visibilityIndex !== undefined ? `${activeMetrics.visibilityIndex.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>

                {focusedCompetitor && (
                  <div className="pointer-events-auto bg-[#006EEE] text-white rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2 max-w-fit">
                    <span className="text-[11px] sm:text-xs font-bold truncate max-w-[200px] sm:max-w-xs">Viewing: {focusedCompetitor.name}</span>
                    <button
                      onClick={() => setFocusedPlaceId(TARGET_PLACE_ID)}
                      className="px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Map Legend (Bottom-Right Floating Pill, Zero Collision with Top KPIs) */}
            <div className="absolute bottom-4 right-4 z-[400] pointer-events-none">
              <div className="pointer-events-auto flex flex-wrap items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-lg text-[11px] sm:text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" /> 1–3 (Top 3)
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" /> 4–10
                </span>
                <span className="flex items-center gap-1 text-rose-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shrink-0" /> 11–20
                </span>
                <span className="flex items-center gap-1 text-rose-950">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-900 inline-block shrink-0" /> 20+ / not found
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block shrink-0" /> Unavailable
                </span>
              </div>
            </div>

            {/* Heatmap */}
            <div className="w-full h-full">
              {mapCenter ? (
                <>
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
                        Loading interactive position map…
                      </div>
                    }
                  >
                    <GeoGridHeatmap
                      radiusKm={mapRadius}
                      center={mapCenter}
                      focusedPlaceId={focusedPlaceId}
                      gridPoints={activeDisplayScan?.gridPoints || []}
                      comparisonPoints={comparisonPoints}
                      selectedPoint={selectedPoint}
                      gridSpec={activeDisplayScan?.gridSpec}
                      maxRank={scanConfig?.maxRank ?? 20}
                      top3Threshold={scanConfig?.top3Threshold ?? 3}
                      top10Threshold={scanConfig?.top10Threshold ?? 10}
                      onSelectPoint={selectPoint}
                    />
                  </Suspense>
                  {measuredPoints.length === 0 && !scanError && activeDisplayScan?.status !== 'FAILED' && (
                    <div className="pointer-events-none absolute inset-0 z-[350] flex items-center justify-center p-6">
                      <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg max-w-sm">
                        <h3 className="font-bold text-slate-900">
                          {scanRunning || isTriggering ? 'Collecting map rankings' : 'No measured map rankings yet'}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {scanRunning || isTriggering
                            ? 'Results appear as rank measurements are recorded.'
                            : activeKeyword
                              ? 'This keyword has no completed provider results. A new map uses the search quota shown beside the keywords.'
                              : 'Choose a tracked keyword to see its saved rank map.'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-slate-50">
                  <RefreshCw size={36} className={`text-[#006EEE] mb-3 ${isTriggering ? 'animate-spin' : ''}`} />
                  <h3 className="text-base font-bold text-slate-800">
                    {isTriggering
                      ? `Fetching real Google Maps rankings for "${activeKeyword}"…`
                      : `Select a keyword to view position map`}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    {isTriggering
                      ? 'Live results are being collected across the search grid.'
                      : 'Click a keyword on the left to start collecting rankings from the map points.'}
                  </p>
                  {!isTriggering && activeKeyword && scanConfig && (
                    <button
                      onClick={() => executeScan(activeKeyword)}
                      className="mt-4 px-4 py-2 rounded-xl bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Scan &quot;{activeKeyword}&quot; · {scanCostLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer for inspecting individual grid points */}
        <PointRankDrawer
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />

        {/* Share Client Scan Modal */}
        {currentScan && isShareModalOpen && (
          <ShareScanModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            scan={currentScan as any}
            workspaceId={workspaceId}
            locationName={selectedLocation?.name || 'Local Business'}
          />
        )}

        {/* White-Label PDF Export Modal */}
        {currentScan && isPdfModalOpen && (
          <WhiteLabelPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            scan={activeDisplayScan || currentScan}
            locationName={selectedLocation?.name || 'Local Business'}
            locationAddress={selectedLocation?.address}
            defaultAgencyName="Rankora Local SEO Agency"
          />
        )}

        {/* Add Keywords Modal */}
        {isAddKeywordModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsAddKeywordModalOpen(false)}
          >
            <div
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Add Tracked Keywords
                </h3>
                <button
                  onClick={() => setIsAddKeywordModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Enter target search keywords separated by commas or line breaks. Rankora will begin live radial coordinate rank tracking.
              </p>

              <form onSubmit={handleAddKeywords} className="space-y-4">
                <textarea
                  rows={4}
                  required
                  placeholder="e.g.&#10;best trading company near me&#10;wholesale trading in delhi&#10;industrial suppliers"
                  value={newKeywordsInput}
                  onChange={(e) => setNewKeywordsInput(e.target.value)}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus-visible:outline-blue-600 transition resize-none font-medium text-slate-800"
                />

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddKeywordModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingKeywords || !newKeywordsInput.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAddingKeywords ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Adding & Starting Scan…</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Add & Scan Geo-Grid</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Grid & Radius Configuration Modal */}
        {isRadiusSettingsOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsRadiusSettingsOpen(false)}
          >
            <div
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      31-Pin Geo-Grid Configuration
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Equal-density concentric multi-ring measurement geometry
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRadiusSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Standard Fixed 5 km Radius */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Scan Radius</label>
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-extrabold text-blue-900">5 km (Standard Local Radius)</div>
                    <div className="text-[11px] text-blue-700">
                      Standard 5 km radial coverage across 31 equi-areal measurement points
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                    5 km Active
                  </span>
                </div>
              </div>

              {/* Geometry Specs Summary Card */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Geometry Specifications
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400">Farthest Pin:</span>{' '}
                    <span className="font-bold text-slate-800">5 km</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Pins:</span>{' '}
                    <span className="font-bold text-slate-800">31 measurement pins</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Pin Spacing:</span>{' '}
                    <span className="font-bold text-slate-800">
                      nearest pins ~1.5 km apart (up to ~2.3 km along outer ring)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Covered Area:</span>{' '}
                    <span className="font-bold text-slate-800">78.5 km²</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Scan Geometry:</span>{' '}
                    <span className="font-bold text-emerald-700">31-Point Sunflower Grid (Equi-Areal)</span>
                  </div>
                </div>
              </div>

              {/* Custom Center Coordinates */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomCenter}
                      onChange={(e) => {
                        setUseCustomCenter(e.target.checked);
                        if (e.target.checked && selectedLocation?.coordinates) {
                          setCustomCenterLat(String(selectedLocation.coordinates.lat));
                          setCustomCenterLng(String(selectedLocation.coordinates.lng));
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Custom Scan Center</span>
                  </label>
                  {useCustomCenter && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLocation?.coordinates) {
                          setCustomCenterLat(String(selectedLocation.coordinates.lat));
                          setCustomCenterLng(String(selectedLocation.coordinates.lng));
                        }
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset to Business
                    </button>
                  )}
                </div>

                {useCustomCenter && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Center Latitude</span>
                      <input
                        type="number"
                        step="any"
                        placeholder={selectedLocation?.coordinates ? String(selectedLocation.coordinates.lat) : 'e.g. Center Latitude'}
                        value={customCenterLat}
                        onChange={(e) => setCustomCenterLat(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-600"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Center Longitude</span>
                      <input
                        type="number"
                        step="any"
                        placeholder={selectedLocation?.coordinates ? String(selectedLocation.coordinates.lng) : 'e.g. Center Longitude'}
                        value={customCenterLng}
                        onChange={(e) => setCustomCenterLng(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRadiusSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRadiusSettingsOpen(false);
                    if (activeKeyword) {
                      executeScan(activeKeyword, true);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Apply & Run {scanPointCount}-Pin Scan</span>
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
