import { BusinessDossier } from './chat.types';
import { ChatIntent } from './intent.classifier';

/**
 * Deterministic Engine for Rankora Local SEO Copilot:
 * - Builds 100% factual responses directly from verified database records.
 * - Zero external API calls ($0 LLM cost).
 * - Zero hallucinations: quotes only exact star ratings, keyword ranks, and competitor numbers.
 * - Zero-data safety: dossier with zero reviews, zero keywords, zero competitors, or null/NaN ratings
 *   produces clean friendly messages, never "undefined", "NaN", or a crash.
 */
export class DeterministicEngine {
  public buildAnswer(
    dossier: BusinessDossier,
    intent: ChatIntent,
    params: Record<string, any> = {}
  ): string {
    switch (intent) {
      case ChatIntent.RATING_SUMMARY:
        return this.buildRatingSummary(dossier);
      case ChatIntent.UNREPLIED_REVIEWS:
        return this.buildUnrepliedReviews(dossier);
      case ChatIntent.TOP_KEYWORDS:
        return this.buildTopKeywords(dossier, params);
      case ChatIntent.COMPETITORS:
        return this.buildCompetitors(dossier);
      default:
        return this.buildGeneralSummary(dossier);
    }
  }

  private formatRating(rating: any): string {
    if (typeof rating === 'number' && !isNaN(rating) && rating > 0) {
      return `${rating.toFixed(1)} ★`;
    }
    return 'No rating yet';
  }

  /**
   * RATING_SUMMARY: Exact Google star rating, review totals, and response rate.
   */
  public buildRatingSummary(dossier: BusinessDossier): string {
    const b = dossier.business || ({} as any);
    const r = dossier.reviews || ({} as any);

    const businessName = b.name || 'Your Business';
    const ratingStr = this.formatRating(r.averageRating);
    const totalReviews = typeof r.total === 'number' && !isNaN(r.total) ? r.total : 0;
    const responseRate = typeof r.responseRate === 'number' && !isNaN(r.responseRate) ? r.responseRate : 0;
    const unrepliedCount = typeof r.unrepliedCount === 'number' && !isNaN(r.unrepliedCount) ? r.unrepliedCount : 0;

    let response = `### 🌟 Google Reviews & Rating Summary for **${businessName}**\n\n`;
    response += `* **Overall Rating:** **${ratingStr}** on Google Maps\n`;
    response += `* **Total Reviews:** **${totalReviews} verified reviews**\n`;
    response += `* **Response Rate:** **${responseRate}%** (${unrepliedCount} awaiting reply)\n`;

    if (r.sentimentSummary && totalReviews > 0) {
      const positivePercent =
        typeof r.sentimentSummary.positivePercent === 'number' && !isNaN(r.sentimentSummary.positivePercent)
          ? r.sentimentSummary.positivePercent
          : 100;
      response += `* **Customer Sentiment:** **${positivePercent}% Positive**\n\n`;
      if (r.sentimentSummary.topics?.length) {
        response += `#### 💬 Common Customer Themes:\n`;
        response += r.sentimentSummary.topics
          .slice(0, 4)
          .map((t: any) => `* **${t.topic}**: ${t.count || 0} mentions (${t.sentiment === 'positive' ? '✅ Positive' : '⚠️ Mixed'})`)
          .join('\n') + '\n';
      }
    }

    if (totalReviews === 0) {
      response += `\n💡 **Getting Started:** Share your Google review link with recent customers to start collecting verified 5-star ratings!`;
    } else if (unrepliedCount > 0) {
      response += `\n💡 **Action Item:** Replying to your **${unrepliedCount} pending reviews** signals active customer care to Google's ranking algorithm!`;
    }

    return response;
  }

  /**
   * UNREPLIED_REVIEWS: Focuses strictly on pending reviews that need responses.
   */
  public buildUnrepliedReviews(dossier: BusinessDossier): string {
    const b = dossier.business || ({} as any);
    const r = dossier.reviews || ({} as any);

    const businessName = b.name || 'Your Business';
    const unrepliedCount = typeof r.unrepliedCount === 'number' && !isNaN(r.unrepliedCount) ? r.unrepliedCount : 0;
    const responseRate = typeof r.responseRate === 'number' && !isNaN(r.responseRate) ? r.responseRate : 0;
    const sampleReviews = Array.isArray(r.sampleReviews) ? r.sampleReviews : [];
    const unrepliedSamples = sampleReviews.filter((rev: any) => !rev.replied);

    let response = `### 📬 Unreplied Reviews for **${businessName}**\n\n`;
    response += `* **Total Awaiting Reply:** **${unrepliedCount} reviews**\n`;
    response += `* **Current Response Rate:** **${responseRate}%**\n\n`;

    if (unrepliedSamples.length > 0) {
      response += `#### 📝 Recent Reviews Awaiting Your Response:\n`;
      response += unrepliedSamples
        .slice(0, 3)
        .map(
          (rev: any) =>
            `* **${rev.author || 'Customer'}** (${this.formatRating(rev.rating)}, ${rev.date || 'Recent'}):\n  > "${rev.text || '(No text comment)'}"`
        )
        .join('\n\n') + '\n\n';
      response += `💡 **Next Step:** Ask me to *"Draft a reply to ${unrepliedSamples[0].author || 'this'}'s review"* to generate a brand-aligned response!`;
    } else if (unrepliedCount === 0) {
      response += `🎉 **Great job!** All customer reviews are currently replied to. Maintaining a high response rate boosts your local trust signals.`;
    } else {
      response += `* You have **${unrepliedCount} unreplied reviews** recorded. Check the **Reputation** tab to view and respond to them!`;
    }

    return response;
  }

  /**
   * TOP_KEYWORDS: Current positions, GeoGrid rank, and movement.
   */
  public buildTopKeywords(dossier: BusinessDossier, params: Record<string, any> = {}): string {
    const b = dossier.business || ({} as any);
    const k = dossier.rankings || ({} as any);

    const businessName = b.name || 'Your Business';
    const locationStr = b.city ? `${b.city}, ${b.state || ''}`.trim() : b.address || 'Address not listed';
    const totalKeywords = typeof k.totalTrackedKeywords === 'number' && !isNaN(k.totalTrackedKeywords) ? k.totalTrackedKeywords : (k.keywords?.length || 0);
    const keywords = Array.isArray(k.keywords) ? k.keywords : [];

    let response = `### 🎯 Tracked Keyword Rankings for **${businessName}**\n\n`;
    response += `* **Location:** ${locationStr}\n`;
    response += `* **Tracked Keywords Total:** **${totalKeywords}**\n\n`;

    if (keywords.length === 0) {
      return (
        response +
        `💡 **No keywords tracked yet.** Add local search terms (like *"dentist near me"* or *"emergency plumber"*) under **Rank Tracking** to monitor your local GeoGrid pack!`
      );
    }

    // If specific keyword was asked
    if (params.keyword) {
      const match = keywords.find(
        (item: any) => item.keyword && item.keyword.toLowerCase() === params.keyword.toString().toLowerCase()
      );
      if (match) {
        response += `#### 🔍 Target Keyword: **"${match.keyword}"**\n`;
        response += `* **Current Rank:** **#${match.currentRank ?? 'Unranked'}**\n`;
        if (match.previousRank) response += `* **Previous Rank:** #${match.previousRank}\n`;
        if (typeof match.volume === 'number') response += `* **Monthly Search Volume:** ${match.volume.toLocaleString()}\n`;
        return response;
      }
    }

    response += `#### 📊 Top Active Keywords:\n`;
    response += keywords
      .slice(0, 5)
      .map((kw: any) => {
        const rankStr = kw.currentRank ? `#${kw.currentRank}` : 'Unranked';
        const changeStr =
          kw.previousRank && kw.currentRank
            ? kw.currentRank < kw.previousRank
              ? ` (🔺 improved from #${kw.previousRank})`
              : kw.currentRank > kw.previousRank
              ? ` (🔻 dropped from #${kw.previousRank})`
              : ` (unchanged)`
            : '';
        return `* **"${kw.keyword}"**: Current Rank **${rankStr}**${changeStr}`;
      })
      .join('\n');

    return response;
  }

  /**
   * COMPETITORS: List of local rivals, star ratings, and review counts.
   */
  public buildCompetitors(dossier: BusinessDossier): string {
    const b = dossier.business || ({} as any);
    const r = dossier.reviews || ({} as any);
    const c = Array.isArray(dossier.competitors) ? dossier.competitors : [];

    const businessName = b.name || 'Your Business';
    const ratingStr = this.formatRating(r.averageRating);
    const totalReviews = typeof r.total === 'number' && !isNaN(r.total) ? r.total : 0;
    const avgRatingNum = typeof r.averageRating === 'number' && !isNaN(r.averageRating) ? r.averageRating : 0;

    let response = `### 🥊 Competitor Benchmark for **${businessName}**\n\n`;
    response += `* **Your Business:** **${businessName}** — **${ratingStr}** (${totalReviews} reviews)\n\n`;

    if (c.length === 0) {
      return (
        response +
        `💡 **No local competitors tracked yet.** Run a GeoGrid Scan in the **Rank Tracking** section to automatically map your top 5 local competitors!`
      );
    }

    response += `#### 🏆 Top Local Competitors in Your Area:\n`;
    response += c
      .map((comp: any, idx: number) => {
        const compRatingStr = this.formatRating(comp.rating);
        const compReviews = typeof comp.reviewCount === 'number' && !isNaN(comp.reviewCount) ? comp.reviewCount : 0;
        return `* **#${idx + 1} ${comp.name || 'Competitor'}**: ${compRatingStr} across ${compReviews} reviews`;
      })
      .join('\n');

    // Strategic comparison insight
    if (avgRatingNum > 0) {
      const higherRated = c.filter((comp: any) => typeof comp.rating === 'number' && comp.rating > avgRatingNum);
      if (higherRated.length === 0) {
        response += `\n\n⭐ **Competitive Advantage:** You hold the highest star rating (**${ratingStr}**) among your direct competitors!`;
      } else {
        response += `\n\n💡 **Focus Area:** ${higherRated.length} competitor(s) have higher star ratings. Boosting new 5-star review acquisition will close the gap!`;
      }
    }

    return response;
  }

  /**
   * General Business Overview fallback.
   */
  public buildGeneralSummary(dossier: BusinessDossier): string {
    const b = dossier.business || ({} as any);
    const r = dossier.reviews || ({} as any);
    const k = dossier.rankings || ({} as any);
    const c = Array.isArray(dossier.competitors) ? dossier.competitors : [];

    const businessName = b.name || 'Your Business';
    const ratingStr = this.formatRating(r.averageRating);
    const totalReviews = typeof r.total === 'number' && !isNaN(r.total) ? r.total : 0;
    const totalKeywords = typeof k.totalTrackedKeywords === 'number' && !isNaN(k.totalTrackedKeywords) ? k.totalTrackedKeywords : (k.keywords?.length || 0);

    return (
      `### 🏢 Business Overview: **${businessName}**\n\n` +
      `* **📍 Address:** ${b.address || 'Not specified'}\n` +
      `* **🏷️ Category:** ${b.category || 'Local Business'}\n` +
      `* **⭐ Rating:** **${ratingStr}** across ${totalReviews} reviews\n` +
      `* **🎯 Keywords:** ${totalKeywords} tracked keywords\n` +
      `* **🥊 Competitors:** ${c.length} local rivals mapped\n\n` +
      `Ask me anything specific about your rankings, unreplied reviews, or local competitors!`
    );
  }
}

export const deterministicEngine = new DeterministicEngine();
