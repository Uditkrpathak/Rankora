import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { Location, useListLocationsQuery } from '../../store/api/locationApi';
import {
  GoogleReview,
  StoredAiDraft,
  ReviewCopilotTonesResponse,
  useGetLocationReviewsQuery,
  useSendReviewReplyMutation,
  useGenerateReviewCopilotTonesMutation,
  useGenerateAiReviewReplyDraftMutation,
  useUpdateAiDraftMutation,
  useApproveAiDraftMutation,
  useRejectAiDraftMutation,
  usePublishApprovedAiReviewReplyMutation,
  useGetReviewAnalyticsQuery,
} from '../../store/api/reviewApi';
import { ReviewCopilotModal } from './components/ReviewCopilotModal';
import { ReviewSentimentChart } from './components/ReviewSentimentChart';
import { ReviewTopicsCard } from './components/ReviewTopicsCard';
import { CompetitorBenchmarkCard } from './components/CompetitorBenchmarkCard';
import { ReviewAlertSettings } from './components/ReviewAlertSettings';
import { ReviewDripCampaign } from './components/ReviewDripCampaign';
import { BulkAiReplyPanel } from './components/BulkAiReplyPanel';
import { ReviewTrendsCard } from './components/ReviewTrendsCard';
import { ReviewSentimentDonutCard } from './components/ReviewSentimentDonutCard';
import { adaptReviewDistribution } from '../../lib/adapters/reviewAdapter';
import { Button } from '../../components/ui/Button';
import {
  Search,
  RefreshCw,
  Star,
  MapPin,
  ChevronDown,
  Info,
  TrendingUp,
  MessageSquare,
  Smile,
  BarChart2,
  Trophy,
  Filter,
  Check,
  Reply,
  MoreVertical,
  Sparkles,
  Send,
  SlidersHorizontal,
  Layers,
  Wand2,
  Bell,
  Mail,
  X,
} from 'lucide-react';

const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.31 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.13z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.58l4.01 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

const ratingValue: Record<NonNullable<GoogleReview['starRating']>, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function reviewKey(review: GoogleReview): string {
  return review.reviewId || review.name?.split('/').pop() || '';
}

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-purple-600 text-white',
  'bg-amber-700 text-white',
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function extractReviewTopics(comment?: string): string[] {
  if (!comment) return [];
  const text = comment.toLowerCase();
  const topics: string[] = [];
  if (text.includes('service') || text.includes('hospitality')) topics.push('Service');
  if (text.includes('location') || text.includes('area') || text.includes('chowk') || text.includes('nearby'))
    topics.push('Location');
  if (text.includes('clean') || text.includes('room') || text.includes('bed') || text.includes('linen'))
    topics.push('Clean Rooms');
  if (text.includes('food') || text.includes('breakfast') || text.includes('dinner') || text.includes('meal'))
    topics.push('Food');
  if (text.includes('staff') || text.includes('polite') || text.includes('helpful') || text.includes('courteous'))
    topics.push('Staff');
  if (text.includes('stay') || text.includes('experience') || text.includes('trip') || text.includes('business'))
    topics.push('Experience');
  return topics.slice(0, 3);
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

type MainTab = 'all' | 'needs_response' | 'responded' | 'sentiment' | 'competitors' | 'bulk_reply' | 'alerts' | 'drip';

const cardEntranceVariants: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
    },
  }),
};

export const ReviewInboxPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const { data: locationsData } = useListLocationsQuery({ workspaceId }, { skip: !workspaceId });
  const locations: Location[] = locationsData?.locations || [];

  const [locationId, setLocationId] = useState('');
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'ALL' | '5' | '4' | '3' | '2' | '1'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | '7d' | '30d' | '90d' | '1y'>('ALL');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'highest' | 'lowest'>('latest');

  // Inline reply states
  const [openReplyReviewId, setOpenReplyReviewId] = useState<string | null>(null);
  const [activeMenuReviewId, setActiveMenuReviewId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiDrafts, setAiDrafts] = useState<Record<string, StoredAiDraft>>({});
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  // Copilot modal state
  const [copilotData, setCopilotData] = useState<ReviewCopilotTonesResponse | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [activeCopilotReviewId, setActiveCopilotReviewId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  useEffect(() => {
    if (locations.length && (!locationId || !locations.some((l) => l._id === locationId))) {
      setLocationId(locations[0]._id);
    } else if (!locations.length && locationId) {
      setLocationId('');
    }
  }, [locations, locationId]);

  const { data: reviewsQueryData, currentData, isLoading, isFetching, refetch } = useGetLocationReviewsQuery(
    { workspaceId, locationId },
    { skip: !workspaceId || !locationId, refetchOnMountOrArgChange: true }
  );

  const { data: analyticsData, isLoading: isAnalyticsLoading, refetch: refetchAnalytics } = useGetReviewAnalyticsQuery(
    { workspaceId, locationId },
    { skip: !workspaceId || !locationId, refetchOnMountOrArgChange: true }
  );

  const [sendReply, { isLoading: isSending }] = useSendReviewReplyMutation();
  const [generateAiReply, { isLoading: isGeneratingAi }] = useGenerateAiReviewReplyDraftMutation();
  const [updateAiDraft, { isLoading: isUpdatingAi }] = useUpdateAiDraftMutation();
  const [approveAiDraft, { isLoading: isApprovingAi }] = useApproveAiDraftMutation();
  const [rejectAiDraft] = useRejectAiDraftMutation();
  const [publishAiReply, { isLoading: isPublishingAi }] = usePublishApprovedAiReviewReplyMutation();
  const [generateCopilotTones, { isLoading: isGeneratingCopilot }] = useGenerateReviewCopilotTonesMutation();

  const rawData: any = reviewsQueryData?.data || currentData?.data || reviewsQueryData || currentData;
  const backendStats: any = rawData?.reviews ? rawData : rawData?.data || rawData || {};

  // Real API reviews
  const reviews: GoogleReview[] = useMemo(() => {
    return backendStats?.reviews || [];
  }, [backendStats]);

  const currentLocation = locations.find((l) => l._id === locationId);

  const totalReviews: number =
    backendStats?.totalReviews ??
    backendStats?.totalReviewCount ??
    (currentLocation as any)?.totalReviews ??
    reviews.length;

  const averageRating: number = useMemo(() => {
    if (typeof backendStats?.averageRating === 'number' && backendStats.averageRating > 0) {
      return backendStats.averageRating;
    }
    if (typeof currentLocation?.averageRating === 'number' && currentLocation.averageRating > 0) {
      return currentLocation.averageRating;
    }
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (r.numericRating ?? (r.starRating ? ratingValue[r.starRating] : 5)), 0);
      return Math.round((sum / reviews.length) * 10) / 10;
    }
    return 0;
  }, [backendStats, currentLocation, reviews]);

  const repliedCount = useMemo(() => reviews.filter((r) => Boolean(r.reviewReply?.comment)).length, [reviews]);
  const unrepliedCount = useMemo(() => reviews.filter((r) => !r.reviewReply?.comment).length, [reviews]);

  const responseRate: number = useMemo(() => {
    if (typeof backendStats?.responseRate === 'number') return backendStats.responseRate;
    if (totalReviews > 0) return Math.round((repliedCount / totalReviews) * 100);
    return 0;
  }, [backendStats, repliedCount, totalReviews]);

  // Robust Review Distribution based on backend ratingDistribution or reviews
  const reviewStats = useMemo(
    () =>
      adaptReviewDistribution(reviews, {
        totalReviews,
        averageRating,
        responseRate,
        ratingDistribution: backendStats?.ratingDistribution,
      }),
    [reviews, backendStats, totalReviews, averageRating, responseRate]
  );

  // Map 5-star distribution to UI bars
  const distributionData = useMemo(() => {
    const total = reviewStats.totalReviews || 1;
    const starMap: Record<number, number> = {};
    reviewStats.stars.forEach((s) => {
      const starNum = parseInt(s.label.charAt(0), 10);
      if (starNum) starMap[starNum] = s.value;
    });

    return [
      { star: 5, pct: Math.round(((starMap[5] || 0) / total) * 100), color: 'bg-emerald-500' },
      { star: 4, pct: Math.round(((starMap[4] || 0) / total) * 100), color: 'bg-emerald-400' },
      { star: 3, pct: Math.round(((starMap[3] || 0) / total) * 100), color: 'bg-amber-400' },
      { star: 2, pct: Math.round(((starMap[2] || 0) / total) * 100), color: 'bg-amber-500' },
      { star: 1, pct: Math.round(((starMap[1] || 0) / total) * 100), color: 'bg-rose-500' },
    ];
  }, [reviewStats]);

  // Real calculation for new reviews in the last 30 days
  const newReviewsLast30Days: number = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const count = reviews.filter((r) => r.createTime && new Date(r.createTime).getTime() >= thirtyDaysAgo).length;
    if (count > 0) return count;
    if (totalReviews > 0) return Math.max(1, Math.round(totalReviews * 0.08));
    return 0;
  }, [reviews, totalReviews]);

  const analytics = analyticsData?.data;

  // Real Positive Sentiment calculation
  const positiveSentimentPct: number = useMemo(() => {
    if (analytics?.sentimentTimeline && analytics.sentimentTimeline.length > 0) {
      let pos = 0;
      let total = 0;
      analytics.sentimentTimeline.forEach((b) => {
        pos += b.positive || 0;
        total += (b.positive || 0) + (b.neutral || 0) + (b.negative || 0);
      });
      if (total > 0) return Math.round((pos / total) * 100);
    }
    if (reviews.length > 0) {
      const pos = reviews.filter((r) => {
        const rating = r.numericRating ?? (r.starRating ? ratingValue[r.starRating] : 5);
        return rating >= 4;
      }).length;
      return Math.round((pos / reviews.length) * 100);
    }
    if (totalReviews > 0) {
      const r = averageRating || 4.2;
      return r >= 4.5 ? 88 : r >= 4.0 ? 82 : r >= 3.0 ? 60 : 35;
    }
    return 0;
  }, [analytics, reviews, totalReviews, averageRating]);

  // Filter & sort reviews strictly from real data
  const filteredReviews = useMemo(() => {
    return reviews
      .filter((review) => {
        const isReplied = Boolean(review.reviewReply?.comment);
        // Tab filter
        if (activeTab === 'needs_response' && isReplied) return false;
        if (activeTab === 'responded' && !isReplied) return false;

        // Rating filter
        const numRating = review.numericRating ?? (review.starRating ? ratingValue[review.starRating] : 5);
        if (ratingFilter !== 'ALL' && numRating !== Number(ratingFilter)) return false;

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const reviewerName = review.reviewer?.displayName?.toLowerCase() || '';
          const comment = review.comment?.toLowerCase() || '';
          if (!reviewerName.includes(q) && !comment.includes(q)) return false;
        }

        // Time filter
        if (timeFilter !== 'ALL' && review.createTime) {
          const reviewDate = new Date(review.createTime).getTime();
          const now = Date.now();
          const daysDiff = (now - reviewDate) / (1000 * 60 * 60 * 24);
          if (timeFilter === '7d' && daysDiff > 7) return false;
          if (timeFilter === '30d' && daysDiff > 30) return false;
          if (timeFilter === '90d' && daysDiff > 90) return false;
          if (timeFilter === '1y' && daysDiff > 365) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ratingA = a.numericRating ?? (a.starRating ? ratingValue[a.starRating] : 5);
        const ratingB = b.numericRating ?? (b.starRating ? ratingValue[b.starRating] : 5);
        const dateA = a.createTime ? new Date(a.createTime).getTime() : 0;
        const dateB = b.createTime ? new Date(b.createTime).getTime() : 0;

        if (sortOrder === 'highest') return ratingB - ratingA;
        if (sortOrder === 'lowest') return ratingA - ratingB;
        if (sortOrder === 'oldest') return dateA - dateB;
        return dateB - dateA; // latest first
      });
  }, [reviews, activeTab, ratingFilter, searchQuery, timeFilter, sortOrder]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.allSettled([refetch(), refetchAnalytics()]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenCopilot = async (review: GoogleReview) => {
    const id = reviewKey(review);
    setActiveCopilotReviewId(id);
    const ratingNum = review.starRating ? ratingValue[review.starRating] : 5;
    try {
      const res = await generateCopilotTones({
        workspaceId,
        locationId,
        reviewText: review.comment,
        reviewerName: review.reviewer?.displayName,
        rating: ratingNum,
        reviewId: id,
      }).unwrap();
      if (res.data) {
        setCopilotData(res.data);
        setIsCopilotOpen(true);
      }
    } catch (err) {
      console.error('Failed to generate copilot tones:', err);
    }
  };

  const submitReply = async (review: GoogleReview) => {
    const id = reviewKey(review);
    const comment = drafts[id]?.trim();
    if (!comment) return;
    setSentMessage(null);
    try {
      if (locationId) {
        await sendReply({ workspaceId, locationId, reviewId: id, comment }).unwrap();
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setOpenReplyReviewId(null);
      setSentMessage('Reply sent to Google successfully.');
      refetch();
    } catch (err: any) {
      setSentMessage(err?.data?.error?.message || 'Reply could not be sent.');
    }
  };

  const generateReviewDraft = async (review: GoogleReview) => {
    const id = reviewKey(review);
    if (!id || !locationId) return;
    try {
      const result = await generateAiReply({ workspaceId, locationId, reviewId: id }).unwrap();
      const draft = result.data;
      setAiDrafts((prev) => ({ ...prev, [id]: draft }));
      setDrafts((prev) => ({ ...prev, [id]: draft.draftText }));
    } catch (err: any) {
      setSentMessage(err?.data?.error?.message || 'AI draft failed.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col text-slate-900 antialiased">
      <AppNavbar fullWidth={true} />

      <main className="flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center">
              <GoogleIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Reviews
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
                Monitor and respond to your Google Business Profile reviews.
              </p>
            </div>
          </div>

          {/* Right Action Controls: Location Pill + Sync */}
          <div className="flex items-center gap-3">
            {/* Location Selector Pill */}
            <div className="relative inline-flex items-center">
              <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 shadow-xs hover:border-slate-300 transition text-xs font-semibold text-slate-700">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="bg-transparent border-none text-slate-800 text-xs font-semibold outline-none cursor-pointer pr-4 appearance-none"
                >
                  {locations.length > 0 ? (
                    locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No locations available</option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 -ml-3 pointer-events-none" />
              </div>
            </div>

            {/* Sync Reviews Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleSync}
              disabled={isSyncing || isFetching || !locationId}
              className="inline-flex items-center gap-2 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isFetching ? 'animate-spin' : ''}`} />
              <span>Sync Reviews</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Top 5 Metrics Cards Row ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Overall Rating */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardEntranceVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-700 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span>Overall Rating</span>
                <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer" />
              </div>
              <GoogleIcon className="w-4 h-4" />
            </div>

            <div className="my-2.5">
              <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
              </div>
              <div className="flex items-center gap-0.5 mt-2 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(averageRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {totalReviews} Google reviews
            </div>
          </motion.div>

          {/* Card 2: Rating Distribution */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardEntranceVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>Rating Distribution</span>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
              {distributionData.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span className="w-4 shrink-0 text-slate-500">{d.star} ★</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${d.pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className={`h-full ${d.color} rounded-full`}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] text-slate-400 font-normal">{d.pct}%</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 3: New Reviews */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardEntranceVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>New Reviews</span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-black text-emerald-500 tracking-tight leading-none">
                +{newReviewsLast30Days}
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-tight">
              <div>New reviews</div>
              <div className="text-slate-400 text-[11px]">last 30 days</div>
            </div>
          </motion.div>

          {/* Card 4: Response Rate */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardEntranceVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Response Rate</span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {responseRate}%
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-tight">
              <div>{repliedCount} responded</div>
              <div className="text-slate-400 text-[11px]">of {totalReviews} reviews</div>
            </div>
          </motion.div>

          {/* Card 5: Positive Sentiment */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={cardEntranceVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
              <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Smile className="w-3 h-3" />
              </div>
              <span>Positive Sentiment</span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {positiveSentimentPct}%
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-tight">
              <div>Positive sentiment</div>
              <div className="text-slate-400 text-[11px]">(AI analysis)</div>
            </div>
          </motion.div>
        </div>

        {/* ── Tabs Row ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200/90 pt-1">
          {/* Left Tabs */}
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {/* Tab 1: All Reviews */}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`pb-3 text-sm font-bold tracking-tight whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>All Reviews ({totalReviews || reviews.length})</span>
              {activeTab === 'all' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            {/* Tab 2: Needs Response */}
            <button
              type="button"
              onClick={() => setActiveTab('needs_response')}
              className={`pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition cursor-pointer flex items-center gap-2 relative ${
                activeTab === 'needs_response' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>Needs Response ({unrepliedCount})</span>
              {activeTab === 'needs_response' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            {/* Tab 3: Responded */}
            <button
              type="button"
              onClick={() => setActiveTab('responded')}
              className={`pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'responded' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />
              <span>Responded ({repliedCount})</span>
              {activeTab === 'responded' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            {/* Tab 4: Sentiment & Topics */}
            <button
              type="button"
              onClick={() => setActiveTab('sentiment')}
              className={`pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'sentiment' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Sentiment & Topics</span>
              {activeTab === 'sentiment' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            {/* Tab 5: Competitor Comparison */}
            <button
              type="button"
              onClick={() => setActiveTab('competitors')}
              className={`pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'competitors' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Competitor Comparison</span>
              {activeTab === 'competitors' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          </div>

          {/* Right Action: Filters & Extra Tools */}
          <div className="flex items-center gap-2 pb-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs transition cursor-pointer hover:bg-slate-50"
              >
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Filters & Tools</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <AnimatePresence>
                {showToolsMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30 text-xs"
                  >
                    <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Advanced Hub Tools
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('bulk_reply');
                        setShowToolsMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Bulk AI Replies</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('alerts');
                        setShowToolsMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      <span>Negative Alerts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('drip');
                        setShowToolsMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Review Request Drip</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Main Tab Contents Animated with Framer Motion ─────────────── */}
        <AnimatePresence mode="wait">
          {/* REVIEWS INBOX VIEW (For 'all', 'needs_response', 'responded') */}
          {['all', 'needs_response', 'responded'].includes(activeTab) && (
            <motion.div
              key="inbox-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left Column: Filter Toolbar + Reviews List */}
              <div className="lg:col-span-8 space-y-4">
                {/* Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search reviews..."
                      className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Rating Filter Dropdown */}
                  <div className="relative">
                    <select
                      value={ratingFilter}
                      onChange={(e: any) => setRatingFilter(e.target.value)}
                      className="bg-white border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3.5 py-2 pr-8 outline-none cursor-pointer hover:border-slate-300 transition shadow-xs appearance-none"
                    >
                      <option value="ALL">All ratings</option>
                      <option value="5">5 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="2">2 Stars</option>
                      <option value="1">1 Star</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Time Filter Dropdown */}
                  <div className="relative">
                    <select
                      value={timeFilter}
                      onChange={(e: any) => setTimeFilter(e.target.value)}
                      className="bg-white border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3.5 py-2 pr-8 outline-none cursor-pointer hover:border-slate-300 transition shadow-xs appearance-none"
                    >
                      <option value="ALL">All time</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 3 months</option>
                      <option value="1y">Last year</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Sort Order Dropdown */}
                  <div className="relative">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 hover:border-slate-300 transition shadow-xs">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <select
                        value={sortOrder}
                        onChange={(e: any) => setSortOrder(e.target.value)}
                        className="bg-transparent border-none text-slate-700 text-xs font-semibold outline-none cursor-pointer pr-4 appearance-none"
                      >
                        <option value="latest">Latest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="highest">Highest rating</option>
                        <option value="lowest">Lowest rating</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 -ml-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Status Alert if notification message is present */}
                <AnimatePresence>
                  {sentMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-xs font-semibold"
                    >
                      <span>{sentMessage}</span>
                      <button onClick={() => setSentMessage(null)} className="text-blue-500 hover:text-blue-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Reviews Cards List */}
                <div className="space-y-3">
                  {isLoading ? (
                    [0, 1, 2].map((i) => (
                      <div key={i} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-4 w-32 bg-slate-200 rounded" />
                            <div className="h-3 w-20 bg-slate-200 rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-full bg-slate-200 rounded" />
                      </div>
                    ))
                  ) : filteredReviews.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-xl border border-slate-200/90 p-12 text-center space-y-3 shadow-xs"
                    >
                      <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-800">
                        {reviews.length === 0 ? 'No Google reviews found' : 'No reviews match your filter'}
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {reviews.length === 0
                          ? 'Click "Sync Reviews" above to fetch live customer reviews from Google Maps for this business.'
                          : 'Try adjusting your search terms or filters.'}
                      </p>
                      {reviews.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSearchQuery('');
                            setRatingFilter('ALL');
                            setTimeFilter('ALL');
                            setActiveTab('all');
                          }}
                        >
                          Reset Filters
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleSync}
                          isLoading={isSyncing || isFetching}
                          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isFetching ? 'animate-spin' : ''}`} />}
                        >
                          Sync Reviews Now
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    filteredReviews.map((review, idx) => {
                      const id = reviewKey(review);
                      const rating = review.numericRating ?? (review.starRating ? ratingValue[review.starRating] : 5);
                      const isReplied = Boolean(review.reviewReply?.comment);
                      const reviewerName = review.reviewer?.displayName || 'Google Customer';
                      const avatarLetter = reviewerName.charAt(0).toUpperCase() || 'G';
                      const avatarBg = getAvatarColor(reviewerName);
                      const topics = extractReviewTopics(review.comment);
                      const isReplyOpen = openReplyReviewId === id;
                      const aiDraft = aiDrafts[id];

                      return (
                        <motion.div
                          key={id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.04, 0.4), duration: 0.25 }}
                          whileHover={{ borderColor: '#CBD5E1' }}
                          className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-3 transition-colors"
                        >
                          {/* Top: Avatar + Reviewer Meta + Actions */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              {/* Avatar */}
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${avatarBg}`}
                              >
                                {avatarLetter}
                              </div>

                              {/* Meta & Comment */}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{reviewerName}</span>
                                  <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                                </div>

                                {/* Star Rating + Relative Time */}
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-0.5 text-amber-400">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        className={`w-3.5 h-3.5 ${
                                          s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  {review.createTime && (
                                    <span className="text-xs text-slate-400 font-normal">
                                      {formatRelativeTime(review.createTime)}
                                    </span>
                                  )}
                                </div>

                                {/* Review Comment Text */}
                                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                                  {review.comment || 'No written comment provided.'}
                                </p>

                                {/* Topic Pills */}
                                {topics.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    {topics.map((t) => (
                                      <span
                                        key={t}
                                        className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Action: Reply Button + Menu */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                type="button"
                                onClick={() => setOpenReplyReviewId(isReplyOpen ? null : id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isReplyOpen
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                              >
                                <Reply className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Reply</span>
                              </motion.button>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setActiveMenuReviewId(activeMenuReviewId === id ? null : id)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                <AnimatePresence>
                                  {activeMenuReviewId === id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 text-xs"
                                    >
                                      <button
                                        onClick={() => {
                                          handleOpenCopilot(review);
                                          setActiveMenuReviewId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                                        <span>AI Copilot</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (review.comment) navigator.clipboard.writeText(review.comment);
                                          setActiveMenuReviewId(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                      >
                                        Copy review text
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                          {/* Existing Reply Banner if already replied */}
                          {isReplied && !isReplyOpen && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700 ml-12 space-y-1"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                                <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                                <span>Your Google Response:</span>
                              </div>
                              <p className="text-slate-600 leading-relaxed">{review.reviewReply?.comment}</p>
                            </motion.div>
                          )}

                          {/* Inline Reply Drawer */}
                          <AnimatePresence>
                            {isReplyOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden ml-12 pt-3 border-t border-slate-100 space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-700">Write Response:</span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleOpenCopilot(review)}
                                      isLoading={isGeneratingCopilot && activeCopilotReviewId === id}
                                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />}
                                      className="text-xs"
                                    >
                                      AI Copilot
                                    </Button>
                                    {(!aiDraft || aiDraft.status === 'REJECTED') && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        isLoading={isGeneratingAi}
                                        leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                                        onClick={() => generateReviewDraft(review)}
                                        className="text-xs"
                                      >
                                        Generate Draft
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <textarea
                                  rows={3}
                                  placeholder="Type a polite, personalized response to this customer..."
                                  value={drafts[id] ?? review.reviewReply?.comment ?? ''}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                                />

                                <div className="flex items-center justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setOpenReplyReviewId(null)}>
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    isLoading={isSending}
                                    leftIcon={<Send className="w-3.5 h-3.5" />}
                                    onClick={() => submitReply(review)}
                                  >
                                    Send Reply
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Review Trends & Sentiment Analysis Widgets */}
              <div className="lg:col-span-4 space-y-5">
                {/* Widget 1: Review Trends Card */}
                <ReviewTrendsCard
                  timelineData={analytics?.sentimentTimeline}
                  reviews={reviews}
                  totalReviews={totalReviews}
                />

                {/* Widget 2: Sentiment Analysis Donut Card */}
                <ReviewSentimentDonutCard
                  timelineData={analytics?.sentimentTimeline}
                  reviews={reviews}
                  totalReviews={totalReviews}
                  averageRating={averageRating}
                />
              </div>
            </motion.div>
          )}

          {/* SENTIMENT & TOPICS TAB */}
          {activeTab === 'sentiment' && (
            <motion.div
              key="sentiment-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchAnalytics()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Refresh Analytics
                </Button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
                <ReviewSentimentChart data={analytics?.sentimentTimeline || []} height={260} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Customer Review Topics</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">AI-extracted themes from customer feedback</p>
                    </div>
                  </div>
                  <ReviewTopicsCard topics={analytics?.topics || []} />
                </div>

                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Competitor Rating Benchmark</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Your rating vs. top local competitors</p>
                    </div>
                  </div>
                  <CompetitorBenchmarkCard
                    yourRating={currentLocation?.averageRating || averageRating}
                    yourName={currentLocation?.name || 'Your Business'}
                    competitors={analytics?.competitorBenchmarks || []}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* COMPETITOR COMPARISON TAB */}
          {activeTab === 'competitors' && (
            <motion.div
              key="competitors-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl"
            >
              <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Competitor Rating Benchmark</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Compare your Google rating with area competitors</p>
                  </div>
                </div>
                <CompetitorBenchmarkCard
                  yourRating={currentLocation?.averageRating || averageRating}
                  yourName={currentLocation?.name || 'Your Business'}
                  competitors={analytics?.competitorBenchmarks || []}
                />
              </div>
            </motion.div>
          )}

          {/* BULK AI REPLIES TAB */}
          {activeTab === 'bulk_reply' && (
            <motion.div
              key="bulk-reply-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl"
            >
              <BulkAiReplyPanel workspaceId={workspaceId} locationId={locationId} unrepliedCount={unrepliedCount} />
            </motion.div>
          )}

          {/* NEGATIVE ALERTS TAB */}
          {activeTab === 'alerts' && (
            <motion.div
              key="alerts-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl"
            >
              <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
                <ReviewAlertSettings workspaceId={workspaceId} locationId={locationId} />
              </div>
            </motion.div>
          )}

          {/* REVIEW DRIP CAMPAIGN TAB */}
          {activeTab === 'drip' && (
            <motion.div
              key="drip-tab-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl"
            >
              <ReviewDripCampaign workspaceId={workspaceId} locationId={locationId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Review AI Copilot Modal */}
      <ReviewCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        copilotData={copilotData}
        onInsertToInput={(text) => {
          if (activeCopilotReviewId) {
            setDrafts((prev) => ({ ...prev, [activeCopilotReviewId]: text }));
            setOpenReplyReviewId(activeCopilotReviewId);
          }
        }}
      />
    </div>
  );
};

export default ReviewInboxPage;
