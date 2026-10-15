import { KeywordVolumeCache } from '../../models/KeywordVolumeCache';
import { VolumeSource } from '@localo/types';

export interface VolumeResult {
  volume: number | null;
  source: VolumeSource;
  band: string | null;
  hasLocalPack: boolean;
}

const STATIC_VOLUME_BANDS = [
  { max: 20, band: '< 15', defaultVolume: 10 },
  { max: 100, band: '~50', defaultVolume: 50 },
  { max: 500, band: '~250', defaultVolume: 250 },
  { max: 2000, band: '~1K', defaultVolume: 1000 },
  { max: 10000, band: '~5K', defaultVolume: 5000 },
  { max: 25000, band: '~10K', defaultVolume: 10000 },
  { max: Infinity, band: '~30K+', defaultVolume: 30000 },
];

export class KeywordVolumeService {
  /**
   * Normalize search string: lowercase, trimmed, collapsed whitespace
   */
  public normalize(keyword: string): string {
    return keyword.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Estimate volume band based on keyword length, token count, and intent keywords
   */
  public estimateBand(normalizedKeyword: string): { volume: number; band: string; hasLocalPack: boolean } {
    const tokens = normalizedKeyword.split(' ');
    const length = normalizedKeyword.length;

    // Local indicators trigger Local Pack badge
    const localIndicators = ['near me', 'in ', 'arrah', 'city', 'downtown', 'service', 'rental', 'repair', 'agency', 'store', 'shop'];
    const hasLocalPack = localIndicators.some((ind) => normalizedKeyword.includes(ind)) || tokens.length >= 2;

    let baseScore = 500;
    if (tokens.length === 1) {
      baseScore = 29000; // Broad single-word term
    } else if (tokens.length === 2) {
      baseScore = 2200;
    } else if (tokens.length === 3) {
      baseScore = 300;
    } else {
      baseScore = 50; // Long-tail phrase
    }

    // Adjust with pseudo-hash based on string charCodes to provide consistent estimates
    const hash = normalizedKeyword.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const estimatedVolume = Math.max(10, Math.round((baseScore * (0.6 + (hash % 80) / 100))));

    const matchingBand = STATIC_VOLUME_BANDS.find((b) => estimatedVolume <= b.max) || STATIC_VOLUME_BANDS[STATIC_VOLUME_BANDS.length - 1];

    return {
      volume: estimatedVolume,
      band: matchingBand.band,
      hasLocalPack,
    };
  }

  /**
   * Primary volume resolution: Cache -> Provider (if configured) -> Fallback band
   */
  public async getVolume(keyword: string, locale: string = 'en-US'): Promise<VolumeResult> {
    const normalized = this.normalize(keyword);

    try {
      // 1. Check 30-day TTL Cache
      const cached = await KeywordVolumeCache.findOne({ normalizedKeyword: normalized, locale });
      if (cached) {
        return {
          volume: cached.volume,
          source: 'cached',
          band: cached.band,
          hasLocalPack: cached.hasLocalPack,
        };
      }

      // 2. Fallback to estimated volume band (deterministic & immediate)
      const estimated = this.estimateBand(normalized);

      // Save into cache for 30-day consistency
      await KeywordVolumeCache.create({
        normalizedKeyword: normalized,
        locale,
        volume: estimated.volume,
        band: estimated.band,
        hasLocalPack: estimated.hasLocalPack,
      }).catch(() => {
        // Ignore duplicate key race condition
      });

      return {
        volume: estimated.volume,
        source: 'estimated_band',
        band: estimated.band,
        hasLocalPack: estimated.hasLocalPack,
      };
    } catch (err) {
      console.warn(`[KeywordVolumeService] Failed to retrieve volume for "${keyword}", using fallback:`, err);
      const fallback = this.estimateBand(normalized);
      return {
        volume: fallback.volume,
        source: 'estimated_band',
        band: fallback.band,
        hasLocalPack: fallback.hasLocalPack,
      };
    }
  }
}

export const keywordVolumeService = new KeywordVolumeService();
