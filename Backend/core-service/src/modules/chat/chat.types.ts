export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: 'reviews' | 'rankings' | 'competitors' | 'audit' | 'general' | 'post_generation';
    referencedData?: string[];
  };
}

export interface BusinessDossier {
  business: {
    id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    website?: string;
    category?: string;
    categories?: string[];
    description?: string;
    coordinates?: { lat: number; lng: number };
    totalReviewCount: number;
    averageRating: number;
    responseRate: number;
    hasSchema: boolean;
  };
  reviews: {
    total: number;
    averageRating: number;
    responseRate: number;
    unrepliedCount: number;
    sampleReviews: Array<{
      author: string;
      rating: number;
      text: string;
      date: string;
      replied: boolean;
    }>;
    sentimentSummary?: {
      positivePercent: number;
      topics: Array<{ topic: string; count: number; sentiment: string }>;
    };
  };
  rankings: {
    totalTrackedKeywords: number;
    keywords: Array<{
      keyword: string;
      currentRank?: number;
      previousRank?: number;
      volume?: number;
    }>;
  };
  competitors: Array<{
    name: string;
    rating: number;
    reviewCount: number;
  }>;
  audit?: {
    healthScore?: number;
    issuesCount?: number;
    topRecommendations?: string[];
  };
}

export interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponse {
  answer: string;
  source: 'cache' | 'deterministic' | 'llm' | 'blocked' | 'fallback';
  badge: 'Verified from Rankora Live Data' | 'Generated with AI Copilot' | null;
  remainingQuota?: number;

  // Backwards compatibility for existing UI
  reply: string;
  suggestions: string[];
  intent: string;
  businessName: string;
}

