import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'Backend/core-service/.env') });

export type ScraperPoolType = 'own' | 'proxy';

export interface ScraperSystemConfig {
  trialPool: ScraperPoolType;
  paidPool: ScraperPoolType;
  freePool: ScraperPoolType;
  gridScansPool: ScraperPoolType;
  trialDurationDays: number;
  trialKeywordLimit: number;
  trialGridScanLimit: number;
  trialGridPins: number;
  dailyRateLimitPerHomeIp: number;
}

export const SCRAPER_CONFIG: ScraperSystemConfig = {
  // Config switch: Default to 'proxy' per user specifications
  trialPool: (process.env.SCRAPER_TRIAL_POOL as ScraperPoolType) || 'proxy',
  paidPool: 'proxy',
  freePool: 'own',
  gridScansPool: 'proxy',
  trialDurationDays: 14,
  trialKeywordLimit: 5,
  trialGridScanLimit: 1,
  trialGridPins: 9, // 3x3 grid
  dailyRateLimitPerHomeIp: 1200,
};
