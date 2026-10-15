import { ISERPProvider, SERPOptions, SERPResult, SERPItem } from './serp.types';
import { ENV } from '../../config/env';

export class MockSERPProvider implements ISERPProvider {
  public name = 'MOCK';

  constructor() {
    if (ENV.NODE_ENV === 'production') {
      throw new Error(
        'MockSERPProvider cannot be instantiated in production environment. Configure a live SERP provider.'
      );
    }
  }

  public async search(options: SERPOptions): Promise<SERPResult> {
    if (ENV.NODE_ENV === 'production') {
      throw new Error('MockSERPProvider cannot run in production');
    }

    // Small simulated network latency
    await new Promise((r) => setTimeout(r, 40));

    const { keyword, lat, lng } = options;

    if (keyword.toLowerCase().includes('empty') || keyword.toLowerCase().includes('no_local_results')) {
      return {
        provider: 'MOCK',
        providerRequestId: `mock_req_empty_${Date.now()}`,
        parserVersion: '1.0',
        items: [],
        rawPayload: { mock: true, options, generatedCount: 0 },
        fetchedAt: new Date(),
        costUsd: 0.0,
      };
    }

    // Deterministic pseudo-random seed based on coordinates and keyword
    const seedStr = `${keyword.toLowerCase()}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const pseudoRandom = Math.abs(Math.sin(hash));

    // Generate 20 local business ranking competitors
    const baseCompetitors = [
      { name: 'Apex Premier Services', rating: 4.9, reviews: 142, category: 'Local Business' },
      { name: 'Summit Local Experts', rating: 4.7, reviews: 88, category: 'Local Business' },
      { name: 'Metro Quality Pro', rating: 4.6, reviews: 110, category: 'Local Business' },
      { name: 'Downtown Specialists', rating: 4.8, reviews: 205, category: 'Local Business' },
      { name: 'Beacon City Center', rating: 4.5, reviews: 67, category: 'Local Business' },
      { name: 'Pioneer & Co.', rating: 4.4, reviews: 53, category: 'Local Business' },
      { name: 'Silverline Professional', rating: 4.9, reviews: 310, category: 'Local Business' },
      { name: 'Central District Care', rating: 4.3, reviews: 41, category: 'Local Business' },
      { name: 'Horizon Group', rating: 4.7, reviews: 95, category: 'Local Business' },
      { name: 'Vanguard Hub', rating: 4.6, reviews: 76, category: 'Local Business' },
      { name: 'Gold Standard Local', rating: 4.8, reviews: 180, category: 'Local Business' },
      { name: 'Neighborhood First', rating: 4.2, reviews: 34, category: 'Local Business' },
      { name: 'Prime Route Associates', rating: 4.5, reviews: 89, category: 'Local Business' },
      { name: 'Elite Performance Hub', rating: 4.7, reviews: 122, category: 'Local Business' },
      { name: 'Evergreen Local Solutions', rating: 4.4, reviews: 49, category: 'Local Business' },
      { name: 'Civic Center Pros', rating: 4.6, reviews: 104, category: 'Local Business' },
      { name: 'NextGen Services', rating: 4.8, reviews: 165, category: 'Local Business' },
      { name: 'Benchmark Providers', rating: 4.3, reviews: 38, category: 'Local Business' },
      { name: 'Cornerstone Point', rating: 4.5, reviews: 82, category: 'Local Business' },
      { name: 'Atlas Regional Group', rating: 4.7, reviews: 140, category: 'Local Business' },
    ];

    const items: SERPItem[] = baseCompetitors.map((c, idx) => {
      // Stable placeId per entity index so multi-keyword scans update the same entity rather than duplicating
      const placeId = `mock_place_${idx + 1}`;
      return {
        placeId,
        name: c.name,
        address: `${100 + idx * 10} Main St, Suite ${idx + 1}`,
        rating: c.rating,
        reviewsCount: c.reviews,
        primaryCategory: c.category,
        phone: `+1 (555) 019-${(1000 + idx).toString().slice(1)}`,
        website: `https://example-${idx + 1}.com`,
        rank: idx + 1,
        isTarget: false,
      };
    });

    // Realistic target business placement when target is provided
    if (options.targetName || options.targetPlaceId) {
      const targetName = options.targetName || 'Target Business';
      const targetPlaceId = options.targetPlaceId || 'mock_target_place_1';
      const kwNorm = keyword.toLowerCase().trim();
      const targetNorm = targetName.toLowerCase().trim();

      let targetRankIndex = 0;
      if (kwNorm === targetNorm) {
        targetRankIndex = 0; // Brand search ranks #1
      } else {
        let kwHash = 0;
        for (let i = 0; i < keyword.length; i++) {
          kwHash = (kwHash << 5) - kwHash + keyword.charCodeAt(i);
        }
        // Realistic distribution between rank 2 and rank 16
        targetRankIndex = Math.min(17, Math.max(1, (Math.abs(kwHash) % 15) + 1));
      }

      items[targetRankIndex] = {
        placeId: targetPlaceId,
        name: targetName,
        address: `${100 + targetRankIndex * 12} Market St, Suite ${targetRankIndex + 1}`,
        rating: 4.8,
        reviewsCount: 96,
        primaryCategory: keyword,
        phone: '+1 (555) 019-8888',
        website: 'https://business.example.com',
        rank: targetRankIndex + 1,
        isTarget: true,
      };
    }

    // Ensure 1-indexed ranks
    items.forEach((it, idx) => {
      it.rank = idx + 1;
    });

    return {
      provider: 'MOCK',
      providerRequestId: `mock_req_${Date.now()}_${Math.floor(pseudoRandom * 10000)}`,
      parserVersion: '1.0',
      items,
      rawPayload: { mock: true, options, generatedCount: items.length },
      fetchedAt: new Date(),
    };
  }
}
