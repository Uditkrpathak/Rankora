/**
 * Category Resolver Module
 * 
 * Resolves a high-confidence, actionable business category for keyword seeding.
 * Priority order:
 *   1. Google Business Profile primary category + additional categories (if connected via OAuth).
 *   2. Google Places API (New) primaryTypeDisplayName / primaryType / types.
 *   3. User-selected category / manual category.
 *   4. Name heuristic mapping (loaded strictly from data/category-map.json).
 *   5. Market discovery (top competitor category from probe).
 * 
 * Generality Rule:
 *   ZERO category terms or business names in code. All category definitions,
 *   aliases, and name heuristic patterns live strictly in data/category-map.json.
 */

import categoryMapData from './data/category-map.json';

export const PLACES_NEW_FIELD_MASK = 'places.id,places.primaryType,places.primaryTypeDisplayName,places.types,places.addressComponents';

export type CategoryResolutionSource = 'GBP_OAUTH' | 'PLACES_PRIMARYTYPE' | 'USER_SELECTED' | 'HEURISTIC' | 'MARKET_DISCOVERY';

export interface ResolvedCategory {
  primary: string;
  primaryKey: string;
  secondary: string[];
  source: CategoryResolutionSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  needsUserConfirmation?: boolean;
}

function normalizeCategoryString(cat?: string): string {
  if (!cat) return '';
  return cat
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_BLOCKLIST: string[] = categoryMapData.genericBlocklist || [];

export function isGenericType(typeStr?: string): boolean {
  if (!typeStr) return true;
  const raw = typeStr.toLowerCase().trim();
  const norm = raw.replace(/[\s_]+/g, '_');
  const normSpace = raw.replace(/[_\s]+/g, ' ');
  const singular = raw.endsWith('s') ? raw.slice(0, -1) : raw;

  return (
    GENERIC_BLOCKLIST.includes(raw) ||
    GENERIC_BLOCKLIST.includes(norm) ||
    GENERIC_BLOCKLIST.includes(normSpace) ||
    GENERIC_BLOCKLIST.includes(singular)
  );
}

/**
 * Checks whether two categories belong to the same family based on category-map.json.
 */
export function isCategoryInSameFamily(cat1?: string, cat2?: string): boolean {
  if (!cat1 || !cat2) return false;
  const c1 = cat1.toLowerCase().trim();
  const c2 = cat2.toLowerCase().trim();
  if (c1 === c2 || c1.includes(c2) || c2.includes(c1)) return true;

  const categories = categoryMapData.categories as Record<string, { familyCategories?: string[] }>;
  for (const cat of Object.values(categories)) {
    const family = (cat.familyCategories || []).map((f) => f.toLowerCase().trim());
    const matchesC1 = family.some((f) => c1.includes(f) || f.includes(c1));
    const matchesC2 = family.some((f) => c2.includes(f) || f.includes(c2));
    if (matchesC1 && matchesC2) return true;
  }

  return false;
}

/**
 * Matches business name against heuristic keywords loaded strictly from category-map.json.
 */
function matchNameHeuristicFromData(businessName?: string): { primary: string; primaryKey: string; secondary: string[] } | null {
  if (!businessName) return null;
  const name = businessName.toLowerCase();
  const categories = categoryMapData.categories as Record<
    string,
    { displayName: string; familyCategories?: string[]; nameHeuristicKeywords?: string[] }
  >;

  for (const [key, cat] of Object.entries(categories)) {
    const keywords = cat.nameHeuristicKeywords || [];
    for (const kw of keywords) {
      if (name.includes(kw.toLowerCase())) {
        return {
          primary: cat.displayName,
          primaryKey: key,
          secondary: (cat.familyCategories || []).slice(0, 3),
        };
      }
    }
  }

  return null;
}

export class CategoryResolver {
  public static resolve(input: {
    gbpPrimaryCategory?: string;
    gbpAdditionalCategories?: string[];
    placesPrimaryTypeDisplayName?: string;
    placesPrimaryType?: string;
    placesTypes?: string[];
    userSelectedCategory?: string;
    existingCategories?: string[];
    businessName?: string;
    competitorCategories?: string[];
  }): ResolvedCategory {
    // 1. Google Business Profile Verified OAuth Categories (Highest Confidence)
    if (input.gbpPrimaryCategory && !isGenericType(input.gbpPrimaryCategory)) {
      const primary = normalizeCategoryString(input.gbpPrimaryCategory);
      const secondary = (input.gbpAdditionalCategories || [])
        .map(normalizeCategoryString)
        .filter((c) => c && !isGenericType(c) && c.toLowerCase() !== primary.toLowerCase());

      return {
        primary,
        primaryKey: primary.toLowerCase().replace(/\s+/g, '_'),
        secondary,
        source: 'GBP_OAUTH',
        confidence: 'HIGH',
      };
    }

    // 2. Google Places API (New) Display Name or Specific Primary Type
    const placesDisplay = normalizeCategoryString(input.placesPrimaryTypeDisplayName);
    if (placesDisplay && !isGenericType(placesDisplay)) {
      const placesTypeKey = (input.placesPrimaryType || placesDisplay).toLowerCase().replace(/[\s_]+/g, '_');
      const secondary = (input.placesTypes || [])
        .filter((t) => !isGenericType(t))
        .map(normalizeCategoryString)
        .filter((c) => c && c.toLowerCase() !== placesDisplay.toLowerCase());

      return {
        primary: placesDisplay,
        primaryKey: placesTypeKey,
        secondary,
        source: 'PLACES_PRIMARYTYPE',
        confidence: 'HIGH',
      };
    }

    if (input.placesPrimaryType && !isGenericType(input.placesPrimaryType)) {
      const primary = normalizeCategoryString(input.placesPrimaryType);
      return {
        primary,
        primaryKey: input.placesPrimaryType.toLowerCase().replace(/[\s_]+/g, '_'),
        secondary: [],
        source: 'PLACES_PRIMARYTYPE',
        confidence: 'MEDIUM',
      };
    }

    // 3. User Selected Category or Existing Categories
    const manualCat = normalizeCategoryString(input.userSelectedCategory || input.existingCategories?.[0]);
    if (manualCat && !isGenericType(manualCat)) {
      return {
        primary: manualCat,
        primaryKey: manualCat.toLowerCase().replace(/\s+/g, '_'),
        secondary: (input.existingCategories || []).slice(1).map(normalizeCategoryString).filter((c) => !isGenericType(c)),
        source: 'USER_SELECTED',
        confidence: 'MEDIUM',
      };
    }

    // 4. Name Heuristic Mapping (Loaded dynamically from category-map.json)
    const nameMatch = matchNameHeuristicFromData(input.businessName);
    if (nameMatch) {
      return {
        primary: nameMatch.primary,
        primaryKey: nameMatch.primaryKey,
        secondary: nameMatch.secondary,
        source: 'HEURISTIC',
        confidence: 'MEDIUM',
      };
    }

    // 5. Market Discovery Fallback (Top competitor primary category)
    if (input.competitorCategories && input.competitorCategories.length > 0) {
      const counts = new Map<string, number>();
      for (const cat of input.competitorCategories) {
        if (!cat || isGenericType(cat)) continue;
        const norm = normalizeCategoryString(cat);
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
      if (counts.size > 0) {
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const topCompCat = sorted[0][0];
        const topKey = topCompCat.toLowerCase().replace(/\s+/g, '_');
        return {
          primary: topCompCat,
          primaryKey: topKey,
          secondary: sorted.slice(1, 4).map(([c]) => c),
          source: 'MARKET_DISCOVERY',
          confidence: 'MEDIUM',
        };
      }
    }

    // 6. When all sources are generic or unknown, flag NEEDS_USER_CONFIRMATION
    return {
      primary: 'Local Business',
      primaryKey: 'local_business',
      secondary: [],
      source: 'HEURISTIC',
      confidence: 'LOW',
      needsUserConfirmation: true,
    };
  }
}
