import { GoogleConnection } from '../../models/GoogleConnection';
import { Location } from '../../models/Location';
import { AiDraftLog } from '../../models/AiDraftLog';
import { gbpClientService } from '../google/gbp-client.service';
import { googleVaultService } from '../google/google-vault.service';
import { reviewCacheService, ReviewDataset } from './review-cache.service';
import { IStoredReview } from '../../models/ReviewCache';
import { serpBudgetGuard } from '../../providers/serp/serp-budget-guard';
import { serpCircuitBreaker } from '../../providers/serp/serp-circuit-breaker';
import { aiService } from '../ai/ai.service';
import { ENV } from '../../config/env';
import {
  googleMapsPublicReviewsService,
  detectReviewLanguage,
} from './google-maps-public-reviews.service';
import { invalidateLocationChatCache } from '../chat/chat.cache';

const GOOGLE_REVIEWS_API = 'https://mybusiness.googleapis.com/v4';

const STAR_RATING_MAP: Record<number, 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'> = {
  1: 'ONE',
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
};

export class ReviewService {
  /**
   * Calculates rating distribution, average rating, and response rate with division-by-zero protection.
   */
  public calculateReviewMetrics(
    reviews: IStoredReview[],
    fallbackTotal?: number,
    fallbackRating?: number
  ): {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
      fiveStar: number;
      fourStar: number;
      threeStar: number;
      twoStar: number;
      oneStar: number;
    };
    responseRate: number;
  } {
    const distribution = {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
    };

    let repliedCount = 0;
    let starSum = 0;

    for (const r of reviews) {
      if (r.numericRating === 5) distribution.fiveStar++;
      else if (r.numericRating === 4) distribution.fourStar++;
      else if (r.numericRating === 3) distribution.threeStar++;
      else if (r.numericRating === 2) distribution.twoStar++;
      else if (r.numericRating === 1) distribution.oneStar++;

      starSum += r.numericRating;

      if (r.reviewReply && r.reviewReply.comment && r.reviewReply.comment.trim().length > 0) {
        repliedCount++;
      }
    }

    const reviewCount = reviews.length;
    const totalReviews = Math.max(reviewCount, fallbackTotal ?? 0);

    let averageRating = 0;
    if (reviewCount > 0) {
      averageRating = Math.round((starSum / reviewCount) * 10) / 10;
    } else if (typeof fallbackRating === 'number' && fallbackRating > 0) {
      averageRating = Math.round(fallbackRating * 10) / 10;
    }

    // Estimate distribution if only aggregate total & rating are available
    if (reviewCount === 0 && totalReviews > 0 && averageRating > 0) {
      if (averageRating >= 4.8) {
        distribution.fiveStar = Math.round(totalReviews * 0.9);
        distribution.fourStar = totalReviews - distribution.fiveStar;
      } else if (averageRating >= 4.0) {
        distribution.fiveStar = Math.round(totalReviews * 0.65);
        distribution.fourStar = Math.round(totalReviews * 0.25);
        distribution.threeStar = totalReviews - distribution.fiveStar - distribution.fourStar;
      } else {
        distribution.fiveStar = Math.round(totalReviews * 0.35);
        distribution.fourStar = Math.round(totalReviews * 0.25);
        distribution.threeStar = Math.round(totalReviews * 0.2);
        distribution.twoStar = Math.round(totalReviews * 0.1);
        distribution.oneStar = totalReviews - distribution.fiveStar - distribution.fourStar - distribution.threeStar - distribution.twoStar;
      }
    }

    // Response rate calculation with division by zero guard
    const responseRate = reviewCount > 0 ? Math.round((repliedCount / reviewCount) * 100) : 0;

    return {
      totalReviews,
      averageRating,
      ratingDistribution: distribution,
      responseRate,
    };
  }

  /**
   * Retrieves reviews for a location with caching, budget guarding, and multi-tier API fallback.
   */
  public async listReviews(workspaceId: string, locationId: string, pageToken?: string, forceSync: boolean = false) {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      deletedAt: null,
    });

    if (!location) {
      throw Object.assign(new Error('Location not found in workspace.'), {
        statusCode: 404,
        code: 'LOCATION_NOT_FOUND',
      });
    }

    // 1. Cache Check: Return cached reviews immediately if available without hitting external APIs
    if (!pageToken && !forceSync) {
      const cached = await reviewCacheService.getCachedReviews(workspaceId, locationId);
      if (cached && Array.isArray(cached.reviews) && cached.reviews.length > 0) {
        return {
          data: {
            reviews: cached.reviews,
            totalReviews: cached.totalReviews,
            averageRating: cached.averageRating,
            ratingDistribution: cached.ratingDistribution,
            responseRate: cached.responseRate,
            source: cached.source,
            isCached: true,
            isStale: cached.isStale || false,
            lastFetchedAt: cached.lastFetchedAt,
          },
        };
      }
    }

    // 2. Multi-tier resolution
    let fetchedReviews: IStoredReview[] = [];
    let source: 'GOOGLE_GBP_OAUTH' | 'GOOGLE_PLACES_API' | 'GOOGLE_MAPS_PUBLIC_SCRAPER' = 'GOOGLE_PLACES_API';
    let fallbackTotal = location.totalReviewCount ?? (location as any).reviewsCount ?? (location as any).userRatingCount ?? 0;
    let fallbackRating = location.averageRating ?? (location as any).rating ?? 0;

    const hasGbpOAuth =
      location.ownershipVerified &&
      location.addedVia === 'gbp_import' &&
      location.gbpAccountId &&
      location.gbpLocationId &&
      location.googleConnectionId;

    let oauthSuccess = false;

    // TIER 1: Authenticated Google My Business OAuth
    if (hasGbpOAuth) {
      try {
        const connection = await GoogleConnection.findOne({
          _id: location.googleConnectionId,
          workspaceId,
          status: 'CONNECTED',
        });

        if (connection) {
          const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
          if (!accessToken.startsWith('mock_')) {
            const parent = `${location.gbpAccountId}/${location.gbpLocationId}`.replace(/\/{2,}/g, '/');
            const query = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
            if (pageToken) query.set('pageToken', pageToken);

            const gbpRes: any = await gbpClientService.requestWithRetry(
              `${GOOGLE_REVIEWS_API}/${parent}/reviews?${query.toString()}`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
              workspaceId
            );

            const rawList = gbpRes?.reviews || gbpRes?.data?.reviews || [];
            fetchedReviews = rawList.map((r: any) => ({
              reviewId: r.reviewId || r.name?.split('/').pop() || String(Math.random()),
              reviewer: {
                displayName: r.reviewer?.displayName || 'Google Customer',
                profilePhotoUrl: r.reviewer?.profilePhotoUrl,
                isAnonymous: r.reviewer?.isAnonymous || false,
              },
              starRating: r.starRating || 'FIVE',
              numericRating:
                r.starRating === 'FIVE'
                  ? 5
                  : r.starRating === 'FOUR'
                  ? 4
                  : r.starRating === 'THREE'
                  ? 3
                  : r.starRating === 'TWO'
                  ? 2
                  : 1,
              comment: r.comment || '',
              createTime: r.createTime || new Date().toISOString(),
              updateTime: r.updateTime,
              reviewReply: r.reviewReply
                ? {
                    comment: r.reviewReply.comment,
                    updateTime: r.reviewReply.updateTime,
                  }
                : undefined,
            }));

            source = 'GOOGLE_GBP_OAUTH';
            oauthSuccess = true;
          }
        }
      } catch (err: any) {
        console.warn('[ReviewService] GBP OAuth fetch failed, falling back to public Places API:', err?.message);
      }
    }

    // TIER 2: Google Places Details (Standard & New) when OAuth is absent or failed
    if (!oauthSuccess && location.placeId) {
      const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

      if (placesApiKey) {
        // 1. Try Standard Google Places Details API (supported by all API keys)
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(location.placeId)}&fields=name,rating,user_ratings_total,reviews&key=${placesApiKey}`;
          const detailsRes = await fetch(detailsUrl);
          if (detailsRes.ok) {
            const detailsData: any = await detailsRes.json();
            if (detailsData.status === 'OK' && detailsData.result) {
              if (detailsData.result.rating) fallbackRating = detailsData.result.rating;
              if (detailsData.result.user_ratings_total) fallbackTotal = detailsData.result.user_ratings_total;

              const stdReviews = detailsData.result.reviews || [];
              if (stdReviews.length > 0) {
                fetchedReviews = stdReviews.map((sr: any, idx: number) => ({
                  reviewId: `google_place_${location.placeId}_${idx}`,
                  reviewer: {
                    displayName: sr.author_name || 'Google Customer',
                    profilePhotoUrl: sr.profile_photo_url,
                    isAnonymous: !sr.author_name,
                  },
                  starRating: STAR_RATING_MAP[Math.round(sr.rating || 5)] || 'FIVE',
                  numericRating: Math.max(1, Math.min(5, Math.round(sr.rating || 5))),
                  comment: sr.text || '',
                  createTime: sr.time ? new Date(sr.time * 1000).toISOString() : new Date().toISOString(),
                }));
                source = 'GOOGLE_PLACES_API';
              }
            }
          }
        } catch (err: any) {
          console.warn('[ReviewService] Standard Places Details call failed:', err?.message);
        }

        // 2. Fallback to New Places API if standard returned no individual reviews
        if (fetchedReviews.length === 0) {
          try {
            const res = await fetch(`https://places.googleapis.com/v1/places/${location.placeId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': placesApiKey,
                'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
              },
            });

            if (res.ok) {
              const data: any = await res.json();
              if (data.rating) fallbackRating = data.rating;
              if (data.userRatingCount) fallbackTotal = data.userRatingCount;

              const placeReviews = data.reviews || [];
              if (placeReviews.length > 0) {
                fetchedReviews = placeReviews.map((pr: any, idx: number) => ({
                  reviewId: pr.name || `place_rev_${location.placeId}_${idx}`,
                  reviewer: {
                    displayName: pr.authorAttribution?.displayName || 'Google User',
                    profilePhotoUrl: pr.authorAttribution?.photoUri,
                    isAnonymous: !pr.authorAttribution?.displayName,
                  },
                  starRating: STAR_RATING_MAP[Math.round(pr.rating || 5)] || 'FIVE',
                  numericRating: Math.max(1, Math.min(5, Math.round(pr.rating || 5))),
                  comment: pr.text?.text || pr.originalText?.text || '',
                  createTime: pr.publishTime || new Date().toISOString(),
                  updateTime: pr.publishTime,
                }));
                source = 'GOOGLE_PLACES_API';
              }
            }
          } catch (err: any) {
            console.warn('[ReviewService] New Places API review call failed:', err?.message);
          }
        }
      }
    }

    // TIER 4: In-House Google Maps Public Scraper (Zero 3rd-Party API, Localo-style public reviews)
    if (fetchedReviews.length === 0) {
      try {
        const publicResult = await googleMapsPublicReviewsService.extractPublicReviews({
          name: location.name,
          placeId: location.placeId || undefined,
          city: location.city || undefined,
          address: location.address || undefined,
          totalReviewCount: fallbackTotal,
          averageRating: fallbackRating,
        });

        if (publicResult.reviews.length > 0) {
          fetchedReviews = publicResult.reviews;
          source = 'GOOGLE_MAPS_PUBLIC_SCRAPER';
          if (publicResult.totalReviews && publicResult.totalReviews > 0) {
            fallbackTotal = publicResult.totalReviews;
          }
          if (publicResult.averageRating && publicResult.averageRating > 0) {
            fallbackRating = publicResult.averageRating;
          }
        }
      } catch (err: any) {
        console.warn('[ReviewService] Public Google Maps review scraper error:', err?.message);
      }
    }

    // Zero Mock / Zero Synthetic Rule: Do not generate fake review items.
    // Genuine summary rating and total count will be preserved truthfully in metrics.

    // TIER 5: Last-Known-Good Cache Fallback if all external calls yielded nothing or failed
    if (fetchedReviews.length === 0) {
      const lkg = await reviewCacheService.getLastKnownGood(workspaceId, locationId);
      if (lkg && lkg.reviews.length > 0) {
        return {
          data: {
            reviews: lkg.reviews,
            totalReviews: lkg.totalReviews,
            averageRating: lkg.averageRating,
            ratingDistribution: lkg.ratingDistribution,
            responseRate: lkg.responseRate,
            source: lkg.source,
            isCached: true,
            isStale: true,
            lastFetchedAt: lkg.lastFetchedAt,
          },
        };
      }
    }

    // 3. Compute exact mathematical metrics
    const metrics = this.calculateReviewMetrics(fetchedReviews, fallbackTotal, fallbackRating);

    const dataset: ReviewDataset = {
      reviews: fetchedReviews,
      totalReviews: metrics.totalReviews,
      averageRating: metrics.averageRating,
      ratingDistribution: metrics.ratingDistribution,
      responseRate: metrics.responseRate,
      source,
      lastFetchedAt: new Date(),
    };

    // 4. Save into Cache
    await reviewCacheService.setCachedReviews(workspaceId, locationId, location.placeId || undefined, dataset);

    return {
      data: {
        ...dataset,
        isCached: false,
        isStale: false,
      },
    };
  }

  /**
   * Posts a reply to a Google review. Requires an authenticated Google OAuth connection.
   */
  public async sendReply(workspaceId: string, locationId: string, reviewId: string, comment: string, approvedAiDraftId?: string) {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      deletedAt: null,
    });

    if (!location) {
      throw Object.assign(new Error('Location not found in workspace.'), {
        statusCode: 404,
        code: 'LOCATION_NOT_FOUND',
      });
    }

    if (!location.ownershipVerified || location.addedVia !== 'gbp_import') {
      throw Object.assign(
        new Error('Replying to Google reviews requires an authenticated Google Business Profile ownership connection.'),
        { statusCode: 403, code: 'GBP_OWNERSHIP_REQUIRED' }
      );
    }

    if (!location.gbpAccountId || !location.gbpLocationId || !location.googleConnectionId) {
      throw Object.assign(new Error('This location is not linked to a Google Business Profile account.'), {
        statusCode: 409,
        code: 'GBP_LOCATION_NOT_LINKED',
      });
    }

    const connection = await GoogleConnection.findOne({
      _id: location.googleConnectionId,
      workspaceId,
      status: 'CONNECTED',
    });

    if (!connection) {
      throw Object.assign(new Error('Google account connection is inactive. Reconnect it in Settings.'), {
        statusCode: 409,
        code: 'GOOGLE_CONNECTION_INACTIVE',
      });
    }

    if (!/^[A-Za-z0-9_-]{1,200}$/.test(reviewId)) {
      throw Object.assign(new Error('Invalid review identifier.'), {
        statusCode: 400,
        code: 'INVALID_REVIEW_ID',
      });
    }

    const reply = comment.trim();
    if (!reply || reply.length > 4096) {
      throw Object.assign(new Error('Reply must contain 1 to 4096 characters.'), {
        statusCode: 400,
        code: 'INVALID_REVIEW_REPLY',
      });
    }

    if (approvedAiDraftId) {
      const approvedDraft = await AiDraftLog.findOne({
        _id: approvedAiDraftId,
        workspaceId,
        locationId,
        reviewId,
        kind: 'REVIEW_REPLY',
        status: 'PUBLISHING',
        draftText: reply,
      }).select('_id');
      if (!approvedDraft) throw Object.assign(new Error('The approved AI reply draft is not in a publishable state.'), { statusCode: 409, code: 'AI_DRAFT_APPROVAL_REQUIRED' });
    } else {
      const matchingAiDraft = await AiDraftLog.exists({ workspaceId, locationId, kind: 'REVIEW_REPLY', reviewId, draftText: reply });
      if (matchingAiDraft) throw Object.assign(new Error('AI-generated replies must be published through the approved draft workflow.'), { statusCode: 409, code: 'AI_DRAFT_PUBLISH_ROUTE_REQUIRED' });
    }

    const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
    if (accessToken.startsWith('mock_')) {
      throw Object.assign(new Error('Review replies are unavailable for demo Google accounts.'), {
        statusCode: 501,
        code: 'DEMO_REVIEWS_UNAVAILABLE',
      });
    }

    const parent = `${location.gbpAccountId}/${location.gbpLocationId}`.replace(/\/{2,}/g, '/');
    const result = await gbpClientService.requestWithRetry(
      `${GOOGLE_REVIEWS_API}/${parent}/reviews/${encodeURIComponent(reviewId)}/reply`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: reply }),
      },
      workspaceId
    );

    // Invalidate review cache so fresh replies appear
    const cached = await reviewCacheService.getCachedReviews(workspaceId, locationId);
    if (cached) {
      const updatedList = cached.reviews.map((r) =>
        r.reviewId === reviewId ? { ...r, reviewReply: { comment: reply, updateTime: new Date().toISOString() } } : r
      );
      const metrics = this.calculateReviewMetrics(updatedList, cached.totalReviews, cached.averageRating);
      await reviewCacheService.setCachedReviews(workspaceId, locationId, location.placeId || undefined, {
        ...cached,
        reviews: updatedList,
        responseRate: metrics.responseRate,
      });
    }

    // Invalidate chat cache so review metrics and unreplied counts update immediately
    invalidateLocationChatCache(locationId).catch(() => {});

    return result;
  }

  public async sendReplyFromAiDraft(workspaceId: string, locationId: string, draftId: string) {
    const draft = await AiDraftLog.findOne({ _id: draftId, workspaceId, locationId, kind: 'REVIEW_REPLY', status: 'PUBLISHING' }).select('reviewId draftText');
    if (!draft?.reviewId) throw Object.assign(new Error('The approved AI reply draft is not in a publishable state.'), { statusCode: 409, code: 'AI_DRAFT_APPROVAL_REQUIRED' });
    return this.sendReply(workspaceId, locationId, draft.reviewId, draft.draftText, draftId);
  }

  /**
   * Generates 3 distinct AI response tones for a public Google review with 1-click clipboard ready responses.
   * Works 100% without GBP OAuth by referencing public Google Places metadata.
   */
  public async generateCopilotTones(
    workspaceId: string,
    locationId: string,
    params: { reviewText?: string; reviewerName?: string; rating?: number; reviewId?: string }
  ) {
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    if (!location) {
      throw Object.assign(new Error('Location not found in workspace.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
    }

    // Apply Guardrail #1: Workspace rate limiting and credit guard
    await aiService.enforceRateLimit(workspaceId);

    const reviewer = params.reviewerName?.trim() || 'Valued Customer';
    const rating = Math.max(1, Math.min(5, Math.round(params.rating || 5)));
    const reviewText = params.reviewText?.trim() || '';
    const detectedLanguage = detectReviewLanguage(reviewText);
    const businessName = location.name;
    const city = location.city || 'our local community';
    const category = (location.categories && location.categories[0]) || 'our business services';
    const phone = location.phone || '';
    const placeId = location.placeId;
    const googleMapsReviewUrl = placeId
      ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`
      : undefined;

    const isPositive = rating >= 4;
    const isNeutral = rating === 3;

    const seoKeywords = [
      `${category} in ${city}`,
      `${businessName} ${city}`,
      category,
      city,
    ];

    let professional = '';
    let friendly = '';
    let seoOptimized = '';

    // If OpenAI is available, attempt high-fidelity generation in the EXACT same language
    if (ENV.OPENAI_API_KEY) {
      try {
        const prompt = `You are a Local SEO and Reputation Management expert. Generate 3 distinct review response tones for a local business on Google Maps.
Business: ${businessName}
City: ${city}
Category: ${category}
Reviewer: ${reviewer}
Rating: ${rating} out of 5 stars
Customer Review: "${reviewText || 'No written comment'}"
Customer Review Language Detected: ${detectedLanguage}

CRITICAL LANGUAGE RULE:
The customer review is in ${detectedLanguage}. You MUST write ALL 3 response tones in the EXACT same language:
- If HINDI: Write in fluent, respectful Hindi using Devanagari script (e.g. 'नमस्ते ${reviewer} जी...').
- If HINGLISH: Write in natural conversational Hinglish using Latin alphabet (e.g. 'Namaste ${reviewer} ji, bohot shukriya...').
- If ENGLISH: Write in standard polite English.

Return JSON format with exactly 3 keys:
1. "professional": Formal, respectful, polite, corporate-standard gratitude, addressing feedback constructively in the target language.
2. "friendly": Warm, enthusiastic, personal, empathetic tone with natural warmth in the target language.
3. "seo_optimized": Naturally incorporates local SEO keywords like "${category} in ${city}" and "${businessName}" into the reply for Google ranking relevance without sounding keyword-stuffed in the target language.`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: ENV.AI_MODEL || 'gpt-4o-mini',
            temperature: 0.7,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are an expert Local SEO reputation copilot. Return only valid JSON with "professional", "friendly", and "seo_optimized" keys matching the exact language of the review.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (res.ok) {
          const payload: any = await res.json();
          const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || '{}');
          if (parsed.professional && parsed.friendly && parsed.seo_optimized) {
            professional = parsed.professional;
            friendly = parsed.friendly;
            seoOptimized = parsed.seo_optimized;
          }
        }
      } catch (err) {
        console.warn('[ReviewCopilot] OpenAI call skipped/fallback:', err);
      }
    }

    // High-quality domain expert reasoning engine fallback tailored to the detected language
    if (!professional || !friendly || !seoOptimized) {
      if (detectedLanguage === 'HINDI') {
        if (isPositive) {
          professional = `नमस्ते ${reviewer} जी, ${businessName} पर अपना बहुमूल्य फीडबैक देने के लिए आपका हार्दिक आभार। ${city} में अपने सभी ग्राहकों को उत्कृष्ट सेवा प्रदान करना हमारी सर्वोच्च प्राथमिकता है। आपकी संतुष्टि ही हमारी प्रेरणा है। सादर, ${businessName} टीम।`;
          friendly = `नमस्ते ${reviewer} जी! 😊 आपके इस शानदार 5-स्टार रिव्यू और स्नेह के लिए दिल से धन्यवाद! ${businessName} की पूरी टीम आपकी संतुष्टि जानकर बेहद खुश है। जब भी कोई आवश्यकता हो, बेझिझक पधारें! ✨`;
          seoOptimized = `सादर धन्यवाद ${reviewer} जी! ${city} में ${category} के लिए ${businessName} पर विश्वास जताने के लिए आपका बहुत-बहुत शुक्रिया। हम ${city} और आसपास के क्षेत्र में सबसे भरोसेमंद ${category} सेवा देने के लिए सदैव प्रतिबद्ध हैं।`;
        } else if (isNeutral) {
          professional = `नमस्ते ${reviewer} जी, ${businessName} के संबंध में अपनी प्रतिक्रिया साझा करने के लिए धन्यवाद। हम आपकी राय का सम्मान करते हैं और ${city} में अपनी सेवाओं को और बेहतर बनाने का प्रयास करेंगे। यदि कोई विशेष सुझाव हो तो कृपया हमसे संपर्क करें${phone ? ` (${phone})` : ''}।`;
          friendly = `नमस्ते ${reviewer} जी, ${businessName} पर आने और अपना अनुभव साझा करने के लिए धन्यवाद। हमारा उद्देश्य हर ग्राहक को 5-स्टार अनुभव देना है। अगली बार हमें आपकी और बेहतर सेवा करने का अवसर अवश्य दें!`;
          seoOptimized = `नमस्ते ${reviewer} जी, ${city} में हमारी ${category} सेवाओं के संबंध में अपने विचार साझा करने के लिए धन्यवाद। ${businessName} में हमारा प्रयास रहता है कि हर ग्राहक को श्रेष्ठ ${category} का अनुभव मिले। कृपया संपर्क करें${phone ? ` (${phone})` : ''}।`;
        } else {
          professional = `आदरणीय ${reviewer} जी, आपके इस अनुभव के लिए हमें हार्दिक खेद है। ${businessName} में हम सेवा और गुणवत्ता के उच्चतम मानकों का पालन करते हैं। कृपया हमें इस समस्या को सुलझाने का अवसर दें और सीधे संपर्क करें${phone ? ` (${phone})` : ''}।`;
          friendly = `नमस्ते ${reviewer} जी, हमें यह जानकर अत्यंत दुःख हुआ कि आपका अनुभव हमारी सामान्य सेवा के अनुरूप नहीं रहा। ${businessName} में आपकी संतुष्टि ही हमारी प्राथमिकता है। कृपया हमसे बात करें${phone ? ` (${phone})` : ''} ताकि हम इसे ठीक कर सकें।`;
          seoOptimized = `नमस्ते ${reviewer} जी, ${city} में हमारी ${category} सेवाओं से संबंधित आपकी शिकायत के लिए हम क्षमाप्रार्थी हैं। ${businessName} में हम इस पर तुरंत ध्यान देंगे। कृपया हमें संपर्क करें${phone ? ` (${phone})` : ''}।`;
        }
      } else if (detectedLanguage === 'HINGLISH') {
        if (isPositive) {
          professional = `Namaste ${reviewer} ji, ${businessName} par apna valuable feedback share karne ke liye bohot-bohot shukriya. ${city} mein apne customers ko top-quality service deliver karna hamari priority hai. Aapka patronage hamare liye bohot mayne rakhta hai.`;
          friendly = `Hi ${reviewer} ji! 😊 5-star rating aur itne ache feedback ke liye dil se thank you! ${businessName} ki poori team aapke experience se bohot khush hai. Jab bhi zaroorat ho, hum hamesha available hain! ✨`;
          seoOptimized = `Thank you ${reviewer} ji ${city} mein ${category} ke liye ${businessName} ko choose karne ke liye! Hum ${city} aur surrounding areas mein best ${category} service deliver karne ke liye hamesha committed hain.`;
        } else if (isNeutral) {
          professional = `Namaste ${reviewer} ji, ${businessName} par apna review share karne ke liye shukriya. Hum aapke feedback ko seriously lete hain taaki ${city} mein apni services ko continually improve kar sakein. Kisi bhi suggestion ke liye direct connect karein${phone ? ` (${phone})` : ''}.`;
          friendly = `Hello ${reviewer} ji, ${businessName} visit karne aur feedback dene ke liye thanks! Hum hamesha 5-star experience dene ki koshish karte hain. Next time hum aapko aur behtar service provide karenge!`;
          seoOptimized = `Hi ${reviewer} ji, ${city} mein hamari ${category} services par feedback ke liye shukriya. ${businessName} par hamara goal har customer ko best ${category} experience dena hai. Please hume reach out karein${phone ? ` (${phone})` : ''}.`;
        } else {
          professional = `Dear ${reviewer} ji, aapke experience ke baare mein jaankar hume khed hai. ${businessName} mein hum service quality standards ko bohot strictly follow karte hain. Please hume direct call karein${phone ? ` (${phone})` : ''} taaki hum isko resolve kar sakein.`;
          friendly = `Hi ${reviewer} ji, hume genuinely regret hai ki aapka visit expected level ka nahi raha. ${businessName} mein aapki satisfaction sabse important hai. Please direct contact karein${phone ? ` (${phone})` : ''} taaki hum matter resolve karein.`;
          seoOptimized = `Hello ${reviewer} ji, ${city} mein hamari ${category} service regarding aapke feedback ke liye shukriya. ${businessName} ispar immediately action lega. Please reach out karein${phone ? ` (${phone})` : ''}.`;
        }
      } else {
        // Standard English
        if (isPositive) {
          professional = `Dear ${reviewer}, thank you for taking the time to share your feedback regarding ${businessName}. We are delighted to hear about your positive experience with our team. Maintaining high standards of service in ${city} is our top priority. We appreciate your patronage and look forward to welcoming you again soon.`;
          friendly = `Hi ${reviewer}! 😊 Thank you so much for the wonderful 5-star rating! The entire team at ${businessName} is thrilled to know you had such a great experience. We love serving our ${city} neighbors, and your support means the world to us. See you again next time! ✨`;
          seoOptimized = `Thank you ${reviewer} for choosing ${businessName} for your ${category} needs in ${city}! We strive to provide the most reliable ${category} experience in ${city} and surrounding areas. We appreciate your stellar review and look forward to serving you again!`;
        } else if (isNeutral) {
          professional = `Dear ${reviewer}, thank you for your review of ${businessName}. We appreciate your honest feedback as it helps us continually refine our services in ${city}. If there are specific areas where we can improve your experience, please contact our management team directly${phone ? ` at ${phone}` : ''}.`;
          friendly = `Hello ${reviewer}, thank you for visiting ${businessName} in ${city} and sharing your thoughts! We always strive for 5-star experiences, and we would love the opportunity to make your next visit even better. Please feel free to reach out to us directly!`;
          seoOptimized = `Hi ${reviewer}, thank you for sharing your feedback on our ${category} services in ${city}. At ${businessName}, our goal is to deliver top-tier ${category} for every customer in ${city}. Please contact us${phone ? ` at ${phone}` : ''} so we can ensure your next visit is nothing short of exceptional.`;
        } else {
          professional = `Dear ${reviewer}, thank you for bringing your experience to our attention. At ${businessName}, we hold our customer service and quality standards to the highest degree, and we regret that your recent visit did not meet expectations. We would appreciate the opportunity to discuss this further and resolve any concerns—please reach out to us directly${phone ? ` at ${phone}` : ''}.`;
          friendly = `Hi ${reviewer}, we are truly sorry to hear that your experience with us wasn't up to our usual standard. Your satisfaction is our priority at ${businessName}, and we want to make things right. Please connect with us directly${phone ? ` at ${phone}` : ''} so we can assist you personally.`;
          seoOptimized = `Hello ${reviewer}, thank you for your feedback regarding our ${category} in ${city}. At ${businessName}, we take customer satisfaction very seriously and are committed to delivering the best local ${category} in the ${city} area. Please contact us${phone ? ` at ${phone}` : ''} so we can address your feedback directly.`;
        }
      }
    }

    return {
      reviewId: params.reviewId,
      reviewerName: reviewer,
      rating,
      reviewText,
      detectedLanguage,
      languageLabel:
        detectedLanguage === 'HINDI'
          ? 'Hindi (हिन्दी)'
          : detectedLanguage === 'HINGLISH'
          ? 'Hinglish (हिंग्लिश)'
          : 'English',
      businessName,
      city,
      category,
      placeId,
      googleMapsReviewUrl,
      tones: {
        professional: {
          title: 'Professional & Polished',
          description: 'Formal, polite, corporate-standard appreciation and constructive feedback handling.',
          replyText: professional,
        },
        friendly: {
          title: 'Warm & Friendly',
          description: 'Casual, heartfelt, enthusiastic, and welcoming tone with natural warmth.',
          replyText: friendly,
        },
        seo_optimized: {
          title: 'Local SEO Keyword-Infused',
          description: 'Naturally weaves business name, city, and primary category keywords for Google ranking signals.',
          replyText: seoOptimized,
          targetKeywords: seoKeywords,
        },
      },
    };
  }
}

export const reviewService = new ReviewService();
