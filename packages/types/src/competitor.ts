export interface ICompetitor {
  _id: string;
  workspaceId: string;
  locationId: string;
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  avgRank: number;
  solv: number; // Share of Local Voice for competitor
  visibilityIndex: number;
  lastObservedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompetitorRadarVectors {
  profileCompleteness: number;
  keywordRelevance: number;
  reviewQuality: number;
  reviewVolume: number;
  citationStrength: number;
  websiteAuthority: number;
  reviewRating?: number;
  reviewCountScore?: number;
}

export interface ICompetitorBenchmark {
  targetLocation: {
    locationId: string;
    name: string;
    arp: number;
    solv: number;
    visibilityIndex: number;
    rating: number;
    reviewsCount: number;
  };
  competitors: Array<{
    placeId: string;
    name: string;
    arp: number;
    solv: number;
    visibilityIndex: number;
    rating?: number;
    reviewsCount?: number;
    primaryCategory?: string;
  }>;
  locationSignals?: ICompetitorRadarVectors;
  marketAverages?: ICompetitorRadarVectors;
  compositeScore?: number;
  marketCompositeAverage?: number;
}
