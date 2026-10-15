import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
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
import { ChartContainer } from '../../components/ui/ChartContainer';
import { DistributionBarChart } from '../../components/ui/charts/DistributionBarChart';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { adaptReviewDistribution } from '../../lib/adapters/reviewAdapter';
import {
  MessageSquareText,
  Send,
  Star,
  Sparkles,
  CheckCircle2,
  Database,
  RefreshCw,
  BarChart3,
  Bell,
  Mail,
  Layers,
  TrendingUp,
  Trophy,
  Copy,
  Filter,
  Wand2,
} from 'lucide-react';

const ratingValue: Record<NonNullable<GoogleReview['starRating']>, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

function reviewKey(review: GoogleReview): string {
  return review.reviewId || review.name?.split('/').pop() || '';
}

type Tab = 'inbox' | 'analytics' | 'bulk-reply' | 'alerts' | 'drip';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'inbox', label: 'Review Inbox', icon: MessageSquareText },
  { id: 'analytics', label: 'Sentiment & Topics', icon: BarChart3 },
  { id: 'bulk-reply', label: 'Bulk AI Replies', icon: Wand2 },
  { id: 'alerts', label: 'Negative Alerts', icon: Bell },
  { id: 'drip', label: 'Review Request Drip', icon: Mail },
];

export const ReviewInboxPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const { data: locationsData } = useListLocationsQuery({ workspaceId }, { skip: !workspaceId });
  const locations: Location[] = locationsData?.locations || [];

  const [locationId, setLocationId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [replyFilter, setReplyFilter] = useState<'ALL' | 'UNREPLIED' | 'REPLIED'>('ALL');
  const [ratingFilter, setRatingFilter] = useState<'ALL' | '1' | '2' | '3' | '4' | '5'>('ALL');
  const [pageTokens, setPageTokens] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiDrafts, setAiDrafts] = useState<Record<string, StoredAiDraft>>({});
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [copilotData, setCopilotData] = useState<ReviewCopilotTonesResponse | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [activeCopilotReviewId, setActiveCopilotReviewId] = useState<string | null>(null);
  const [generateCopilotTones, { isLoading: isGeneratingCopilot }] = useGenerateReviewCopilotTonesMutation();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (locations.length && (!locationId || !locations.some((l) => l._id === locationId))) {
      selectLocation(locations[0]._id);
    } else if (!locations.length && locationId) {
      selectLocation('');
    }
  }, [locations, locationId]);

  const pageToken = pageTokens[pageIndex];
  const { data: reviewsQueryData, currentData, isLoading, isFetching, refetch } = useGetLocationReviewsQuery(
    { workspaceId, locationId, pageToken },
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

  const rawData: any = reviewsQueryData?.data || currentData?.data || reviewsQueryData || currentData;
  const backendStats: any = rawData?.reviews ? rawData : rawData?.data || rawData || {};
  const reviews: GoogleReview[] = backendStats?.reviews || [];

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const replied = Boolean(review.reviewReply?.comment);
      const rating = review.numericRating ?? (review.starRating ? ratingValue[review.starRating] : 5);
      return (
        (replyFilter === 'ALL' || (replyFilter === 'REPLIED' ? replied : !replied)) &&
        (ratingFilter === 'ALL' || rating === Number(ratingFilter))
      );
    });
  }, [reviews, replyFilter, ratingFilter]);

  const unrepliedCount = reviews.filter((r) => !r.reviewReply?.comment).length;

  const selectLocation = (id: string) => {
    setLocationId(id);
    setPageTokens([]);
    setPageIndex(0);
    setSentMessage(null);
  };

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
      const res = await generateCopilotTones({ workspaceId, locationId, reviewText: review.comment, reviewerName: review.reviewer?.displayName, rating: ratingNum, reviewId: id }).unwrap();
      if (res.data) { setCopilotData(res.data); setIsCopilotOpen(true); }
    } catch (err) { console.error('Failed to generate copilot tones:', err); }
  };

  const submitReply = async (review: GoogleReview) => {
    const id = reviewKey(review);
    const comment = drafts[id]?.trim();
    if (!comment || !locationId) return;
    setSentMessage(null);
    try {
      await sendReply({ workspaceId, locationId, reviewId: id, comment }).unwrap();
      setDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setSentMessage('Reply sent to Google successfully.');
      refetch();
    } catch (err: any) { setSentMessage(err?.data?.error?.message || 'Reply could not be sent.'); }
  };

  const generateReviewDraft = async (review: GoogleReview) => {
    const id = reviewKey(review);
    if (!id || !locationId) return;
    try {
      const result = await generateAiReply({ workspaceId, locationId, reviewId: id }).unwrap();
      const draft = result.data;
      setAiDrafts((prev) => ({ ...prev, [id]: draft }));
      setDrafts((prev) => ({ ...prev, [id]: draft.draftText }));
    } catch (err: any) { setSentMessage(err?.data?.error?.message || 'AI draft failed.'); }
  };

  const approveReviewDraft = async (review: GoogleReview) => {
    const id = reviewKey(review);
    const current = aiDrafts[id];
    if (!current) return;
    try {
      const updated = await updateAiDraft({ workspaceId, draftId: current._id, draftText: drafts[id] ?? current.draftText }).unwrap();
      const approved = await approveAiDraft({ workspaceId, draftId: current._id }).unwrap();
      setAiDrafts((prev) => ({ ...prev, [id]: approved.data || updated.data }));
    } catch (err: any) { setSentMessage(err?.data?.error?.message || 'Could not approve draft.'); }
  };

  const rejectReviewDraft = async (review: GoogleReview) => {
    const id = reviewKey(review);
    const current = aiDrafts[id];
    if (!current) return;
    try {
      const result = await rejectAiDraft({ workspaceId, draftId: current._id }).unwrap();
      setAiDrafts((prev) => ({ ...prev, [id]: result.data }));
      setDrafts((prev) => ({ ...prev, [id]: '' }));
    } catch (err: any) { setSentMessage(err?.data?.error?.message || 'Could not reject draft.'); }
  };

  const publishReviewDraft = async (review: GoogleReview) => {
    const id = reviewKey(review);
    const current = aiDrafts[id];
    if (!current || current.status !== 'APPROVED') return;
    try {
      await publishAiReply({ workspaceId, locationId, draftId: current._id }).unwrap();
      setSentMessage('Approved AI reply published to Google.');
      refetch();
    } catch (err: any) { setSentMessage(err?.data?.error?.message || 'Could not publish reply.'); }
  };

  const reviewStats = useMemo(
    () => adaptReviewDistribution(reviews, { totalReviews: backendStats?.totalReviews, averageRating: backendStats?.averageRating, responseRate: backendStats?.responseRate }),
    [reviews, backendStats]
  );

  const analytics = analyticsData?.data;
  const currentLocation = locations.find((l) => l._id === locationId);

  const sourceLabel =
    backendStats?.source === 'GOOGLE_GBP_OAUTH' ? 'GBP OAuth (Verified)' :
    backendStats?.source === 'GOOGLE_MAPS_PUBLIC_SCRAPER' ? 'Public Maps Scraper' :
    backendStats?.source === 'SERPAPI_MAPS' ? 'SerpApi Maps' : 'Google Places API';

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="w-full space-y-6 pb-12 font-sans">

          {/* ── Page Header ───────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shadow-xs">
                <MessageSquareText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Review Intelligence Hub
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>Sentiment analysis · Topic extraction · Competitor benchmarking · Alert system · Drip campaigns</span>
                  {backendStats && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Database size={11} />
                      {sourceLabel}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">Location:</span>
              <select
                value={locationId}
                onChange={(e) => selectLocation(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus-visible:outline-brand-500 shadow-2xs cursor-pointer"
              >
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>{loc.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={handleSync} isLoading={isSyncing || isFetching} leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isFetching ? 'animate-spin' : ''}`} />}>
                Sync
              </Button>
            </div>
          </div>

          {/* ── KPI Strip ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="Overall Rating"
              value={reviewStats.totalReviews > 0 ? `${reviewStats.averageRating.toFixed(1)} ★` : '–'}
              icon={<Star className="w-4 h-4 text-amber-500" />}
              subtitle={`${reviewStats.totalReviews} Google reviews`}
            />
            <MetricCard
              title="Response Rate"
              value={`${reviewStats.responseRate}%`}
              icon={<CheckCircle2 className="w-4 h-4" />}
              subtitle={`${unrepliedCount} awaiting reply`}
            />
            <MetricCard
              title="Positive Sentiment"
              value={
                analytics?.sentimentTimeline?.length
                  ? (() => {
                      const last = analytics.sentimentTimeline[analytics.sentimentTimeline.length - 1];
                      return last.total > 0 ? `${Math.round((last.positive / last.total) * 100)}%` : '–';
                    })()
                  : '–'
              }
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              subtitle="Latest month"
            />
            <MetricCard
              title="Competitor Rank"
              value={
                analytics?.competitorBenchmarks?.length
                  ? (() => {
                      const myRating = currentLocation?.averageRating || reviewStats.averageRating;
                      const all = [myRating, ...analytics.competitorBenchmarks.map((c) => c.rating)].sort((a, b) => b - a);
                      const rank = all.indexOf(myRating) + 1;
                      return `#${rank} of ${all.length}`;
                    })()
                  : '–'
              }
              icon={<Trophy className="w-4 h-4 text-amber-500" />}
              subtitle="vs local area"
            />
          </div>

          {/* ── Tab Nav ───────────────────────────────────────────────────── */}
          <div className="flex overflow-x-auto gap-1 bg-slate-100/70 border border-slate-200 rounded-2xl p-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-brand-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === 'inbox' && unrepliedCount > 0 && (
                    <span className="ml-0.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {unrepliedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab Content ───────────────────────────────────────────────── */}

          {/* INBOX TAB */}
          {activeTab === 'inbox' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ChartContainer
                    title="Rating Distribution"
                    subtitle="5-star sentiment breakdown"
                    isLoading={isLoading}
                    isEmpty={reviewStats.totalReviews === 0}
                    emptyTitle="No reviews recorded yet"
                    emptyMessage="This location does not have any recorded Google customer reviews."
                  >
                    <DistributionBarChart data={reviewStats.stars} layout="horizontal" height={220} unit="reviews" />
                  </ChartContainer>
                </div>
                <div className="space-y-4">
                  <MetricCard title="Overall Rating" value={reviewStats.totalReviews > 0 ? `${reviewStats.averageRating.toFixed(1)} ★` : '0.0 ★'} icon={<Star className="w-4 h-4" />} subtitle={`Based on ${reviewStats.totalReviews} reviews`} />
                  <MetricCard title="Response Rate" value={`${reviewStats.responseRate}%`} icon={<CheckCircle2 className="w-4 h-4" />} delta={reviewStats.responseRate > 0 ? { value: `${reviewStats.responseRate}% answered`, trend: 'up' } : undefined} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Filter:</span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
                      {(['ALL', 'UNREPLIED', 'REPLIED'] as const).map((mode) => (
                        <button key={mode} onClick={() => setReplyFilter(mode)} className={`px-3 py-1 rounded-md transition cursor-pointer ${replyFilter === mode ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                          {mode}
                        </button>
                      ))}
                    </div>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold ml-1">
                      {(['ALL', '5', '4', '3', '2', '1'] as const).map((n) => (
                        <button key={n} onClick={() => setRatingFilter(n)} className={`px-2.5 py-1 rounded-md transition cursor-pointer ${ratingFilter === n ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                          {n === 'ALL' ? 'All ★' : `${n}★`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sentMessage && <Badge variant="brand" size="sm">{sentMessage}</Badge>}
                </div>

                <div className="divide-y divide-slate-100">
                  {isLoading ? (
                    [0, 1, 2].map((i) => (
                      <div key={i} className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1 max-w-md">
                            <div className="flex items-center gap-2"><div className="h-4 w-32 shimmer rounded-md" /><div className="h-3 w-16 shimmer rounded-md" /></div>
                            <div className="h-3 w-full shimmer rounded-md" /><div className="h-3 w-3/4 shimmer rounded-md" />
                          </div>
                          <div className="h-6 w-20 shimmer rounded-full" />
                        </div>
                      </div>
                    ))
                  ) : filteredReviews.length === 0 ? (
                    <div className="p-10 text-center space-y-2 max-w-md mx-auto">
                      <MessageSquareText className="w-8 h-8 text-slate-300 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-800">No reviews found</h3>
                      <p className="text-xs text-slate-500">{reviews.length === 0 ? 'No public reviews on Google Maps for this profile yet.' : 'Try adjusting your filters.'}</p>
                    </div>
                  ) : (
                    filteredReviews.map((review) => {
                      const id = reviewKey(review);
                      const rating = review.starRating ? ratingValue[review.starRating] : 5;
                      const isReplied = Boolean(review.reviewReply?.comment);
                      const devanagariCount = (review.comment?.match(/[\u0900-\u097F]/g) || []).length;
                      const isHinglish = /\b(bahut|bohot|acha|achha|achi|badhiya|bhai|shandar|shukriya)\b/i.test(review.comment || '');
                      const langBadge = devanagariCount >= 3 ? '🇮🇳 Hindi' : isHinglish ? '🗣️ Hinglish' : null;
                      const aiDraft = aiDrafts[id];

                      return (
                        <div key={id} className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">{review.reviewer?.displayName || 'Google Customer'}</span>
                                <div className="flex text-amber-500">
                                  {[...Array(rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                                </div>
                                {langBadge && <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold">{langBadge}</span>}
                                {review.createTime && (
                                  <span className="text-[10px] text-slate-400">{new Date(review.createTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{review.comment || 'No written comment provided.'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" variant="secondary" onClick={() => handleOpenCopilot(review)} isLoading={isGeneratingCopilot && activeCopilotReviewId === id} leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />} className="bg-brand-50/70 hover:bg-brand-100/80 text-brand-700 border border-brand-200/80 text-xs font-bold">
                                AI Copilot
                              </Button>
                              <Badge variant={isReplied ? 'success' : 'warning'} size="sm" dot>
                                {isReplied ? 'Replied' : 'Pending'}
                              </Badge>
                            </div>
                          </div>

                          {isReplied && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700 ml-4">
                              <span className="font-bold text-slate-900 block mb-1">Your Response:</span>
                              {review.reviewReply?.comment}
                            </div>
                          )}

                          {!isReplied && (
                            <div className="ml-4 space-y-2">
                              {aiDraft && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="brand" size="sm">AI-GENERATED</Badge>
                                  <Badge variant={aiDraft.status === 'APPROVED' ? 'success' : aiDraft.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'} size="sm">
                                    {aiDraft.status.replaceAll('_', ' ')}
                                  </Badge>
                                </div>
                              )}
                              <textarea
                                rows={2}
                                placeholder="Write a personalized reply..."
                                value={drafts[id] || ''}
                                readOnly={Boolean(aiDraft && aiDraft.status !== 'PENDING_APPROVAL')}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus-visible:outline-brand-500 transition"
                              />
                              <div className="flex flex-wrap justify-end gap-2">
                                {(!aiDraft || aiDraft.status === 'REJECTED') && (
                                  <Button size="sm" variant="secondary" isLoading={isGeneratingAi} leftIcon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => generateReviewDraft(review)}>Generate AI draft</Button>
                                )}
                                {!aiDraft && (
                                  <Button size="sm" variant="primary" isLoading={isSending} leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => submitReply(review)}>Send reply</Button>
                                )}
                                {aiDraft?.status === 'PENDING_APPROVAL' && <>
                                  <Button size="sm" variant="secondary" onClick={() => rejectReviewDraft(review)}>Reject</Button>
                                  <Button size="sm" variant="primary" isLoading={isUpdatingAi || isApprovingAi} onClick={() => approveReviewDraft(review)}>Approve</Button>
                                </>}
                                {aiDraft?.status === 'APPROVED' && (
                                  <Button size="sm" variant="primary" isLoading={isPublishingAi} leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => publishReviewDraft(review)}>Publish reply</Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => refetchAnalytics()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Refresh Analytics
                </Button>
              </div>

              {/* Sentiment Timeline */}
              <ChartContainer
                title="Sentiment Trend Over Time"
                subtitle="Monthly breakdown of positive, neutral, and negative reviews from real customer feedback"
                isLoading={isAnalyticsLoading}
                isEmpty={!analytics?.sentimentTimeline?.length}
                emptyTitle="No sentiment history yet"
                emptyMessage="Sync reviews to start analyzing sentiment trends over time."
              >
                <ReviewSentimentChart data={analytics?.sentimentTimeline || []} height={260} />
              </ChartContainer>

              {/* Topics + Competitors side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Topic Extraction */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-900">Customer Review Topics</h3>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">AI-extracted themes from real review text</p>
                    </div>
                    {analytics?.topics?.length ? (
                      <Badge variant="brand" size="sm">{analytics.topics.length} topics</Badge>
                    ) : null}
                  </div>
                  {isAnalyticsLoading ? (
                    <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
                  ) : (
                    <ReviewTopicsCard topics={analytics?.topics || []} />
                  )}
                </div>

                {/* Competitor Benchmark */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Competitor Rating Benchmark</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Your rating vs. top local competitors</p>
                    </div>
                  </div>
                  {isAnalyticsLoading ? (
                    <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
                  ) : (
                    <CompetitorBenchmarkCard
                      yourRating={currentLocation?.averageRating || reviewStats.averageRating}
                      yourName={currentLocation?.name || 'Your Business'}
                      competitors={analytics?.competitorBenchmarks || []}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BULK REPLY TAB */}
          {activeTab === 'bulk-reply' && (
            <div className="max-w-2xl">
              <BulkAiReplyPanel workspaceId={workspaceId} locationId={locationId} unrepliedCount={unrepliedCount} />
            </div>
          )}

          {/* ALERTS TAB */}
          {activeTab === 'alerts' && (
            <div className="max-w-xl">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <ReviewAlertSettings workspaceId={workspaceId} locationId={locationId} />
              </div>
            </div>
          )}

          {/* DRIP TAB */}
          {activeTab === 'drip' && (
            <div className="max-w-3xl">
              <ReviewDripCampaign workspaceId={workspaceId} locationId={locationId} />
            </div>
          )}
        </div>
      </main>

      <ReviewCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        copilotData={copilotData}
        onInsertToInput={(text) => { if (activeCopilotReviewId) setDrafts((prev) => ({ ...prev, [activeCopilotReviewId]: text })); }}
      />
    </div>
  );
};

export default ReviewInboxPage;
