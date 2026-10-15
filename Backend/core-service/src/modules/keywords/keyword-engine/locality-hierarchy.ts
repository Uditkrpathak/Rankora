/**
 * Locality Hierarchy Module
 * 
 * Builds a strict geographic hierarchy for a business from Places API addressComponents
 * and formatted address tokens.
 * 
 * Rules:
 *   1. Hierarchy levels ordered smallest to largest (neighborhood/sublocality_2 -> sublocality_1 -> locality -> state -> country).
 *   2. Any keyword naming a place must name a place in this hierarchy. Place names outside the hierarchy (e.g. "new delhi" when address says "delhi / tri nagar", or other localities) are rejected.
 *   3. Country or state suffixes (e.g. "india", "in india") are rejected.
 *   4. Plural / singular duplicate keywords are normalized and deduplicated.
 */

export interface HierarchyLevel {
  name: string;
  normalizedName: string;
  type: 'neighborhood' | 'sublocality_level_2' | 'sublocality_level_1' | 'sublocality' | 'locality' | 'admin_area_2' | 'admin_area_1' | 'country';
  rank: number; // 1 = smallest (neighborhood/sublocality_2), 2 = sublocality_1, 3 = locality (city), 4 = admin_area_2, 5 = admin_area_1, 6 = country
}

export interface LocalityHierarchy {
  levels: HierarchyLevel[];
  sublocalities: string[]; // Smallest first, e.g. ["Kanhiya Nagar", "Tri Nagar"]
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  allowedPlaceNames: Set<string>;
  disallowedPlaceNames: Set<string>;
}

export interface AddressComponentLike {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types?: string[];
}

export class LocalityHierarchyService {
  /**
   * Normalizes a place name for consistent comparison.
   */
  public static normalizePlaceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Builds the locality hierarchy from Places addressComponents and formatted address string.
   */
  public static buildHierarchy(input: {
    addressComponents?: AddressComponentLike[];
    formattedAddress?: string;
    city?: string;
    state?: string;
    sublocality?: string;
    neighborhood?: string;
    country?: string;
    countryCode?: string;
  }): LocalityHierarchy {
    const levelsMap = new Map<string, HierarchyLevel>();
    const seenNames = new Set<string>();

    const addLevel = (name: string, type: HierarchyLevel['type'], rank: number) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2) return;
      // Skip pure digits (PIN / ZIP codes) or street numbers
      if (/^\d+$/.test(trimmed) || /^(street|road|plot|gali|lane|block|sector|house|flat|no|number)\b/i.test(trimmed)) {
        return;
      }
      const norm = this.normalizePlaceName(trimmed);
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        levelsMap.set(norm, {
          name: trimmed,
          normalizedName: norm,
          type,
          rank,
        });
      }
    };

    // 1. Ingest Places API addressComponents
    if (input.addressComponents && Array.isArray(input.addressComponents)) {
      for (const comp of input.addressComponents) {
        const text = comp.longText || comp.long_name || comp.shortText || comp.short_name;
        if (!text) continue;
        const types = comp.types || [];

        if (types.includes('neighborhood') || types.includes('sublocality_level_2')) {
          addLevel(text, 'sublocality_level_2', 1);
        } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
          addLevel(text, 'sublocality_level_1', 2);
        } else if (types.includes('locality')) {
          addLevel(text, 'locality', 3);
        } else if (types.includes('administrative_area_level_2')) {
          addLevel(text, 'admin_area_2', 4);
        } else if (types.includes('administrative_area_level_1')) {
          addLevel(text, 'admin_area_1', 5);
        } else if (types.includes('country')) {
          addLevel(text, 'country', 6);
        }
      }
    }

    // 2. Fallbacks from explicit input parameters
    if (input.neighborhood) addLevel(input.neighborhood, 'sublocality_level_2', 1);
    if (input.sublocality) addLevel(input.sublocality, 'sublocality_level_1', 2);
    if (input.city) addLevel(input.city, 'locality', 3);
    if (input.state) addLevel(input.state, 'admin_area_1', 5);
    if (input.country) addLevel(input.country, 'country', 6);

    // 3. Parse formatted address tokens (e.g. "3773, Street Number 4, Kanhiya Nagar, Tri Nagar, Delhi 110035")
    if (input.formattedAddress) {
      const parts = input.formattedAddress
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        // Strip 6-digit or 5-digit postal code from token
        part = part.replace(/\b\d{5,6}\b/g, '').trim();
        if (!part) continue;

        // Skip house/street number indicators
        if (/^\d+/.test(part) || /^(street|road|plot|gali|lane|block|sector|house|flat|no|number)\b/i.test(part)) {
          continue;
        }

        const norm = this.normalizePlaceName(part);
        // If not already in hierarchy, add it based on position
        if (!seenNames.has(norm)) {
          // If later in address string, higher rank (locality/state), if earlier, lower rank (sublocality)
          const inferredRank = i >= parts.length - 2 ? 3 : 2;
          const inferredType: HierarchyLevel['type'] = inferredRank === 3 ? 'locality' : 'sublocality';
          addLevel(part, inferredType, inferredRank);
        }
      }
    }

    // Sort levels by rank ascending (smallest first: rank 1 -> 6)
    const sortedLevels = Array.from(levelsMap.values()).sort((a, b) => a.rank - b.rank);

    const sublocalities = sortedLevels
      .filter((lvl) => lvl.rank <= 2)
      .map((lvl) => lvl.name);

    const cityLvl = sortedLevels.find((lvl) => lvl.rank === 3);
    const stateLvl = sortedLevels.find((lvl) => lvl.rank === 5);
    const countryLvl = sortedLevels.find((lvl) => lvl.rank === 6);

    const allowedPlaceNames = new Set<string>();
    for (const lvl of sortedLevels) {
      allowedPlaceNames.add(lvl.normalizedName);
    }

    // Common known mismatches: e.g. "new delhi" when city is "delhi"
    const disallowedPlaceNames = new Set<string>();
    if (cityLvl && cityLvl.normalizedName === 'delhi' && !allowedPlaceNames.has('new delhi')) {
      disallowedPlaceNames.add('new delhi');
    }

    return {
      levels: sortedLevels,
      sublocalities,
      city: cityLvl?.name || input.city,
      state: stateLvl?.name || input.state,
      country: countryLvl?.name || input.country || 'India',
      countryCode: input.countryCode || 'in',
      allowedPlaceNames,
      disallowedPlaceNames,
    };
  }

  /**
   * Verifies if a place named in a candidate keyword belongs to this business's hierarchy.
   * If the keyword contains a geographic modifier (e.g. "in <place>", "at <place>", or trailing place token),
   * that place MUST be in allowedPlaceNames and MUST NOT be in disallowedPlaceNames.
   */
  public static validateKeywordPlace(keyword: string, hierarchy: LocalityHierarchy): {
    valid: boolean;
    reason?: string;
    namedPlace?: string;
    isSublocality: boolean;
    isCityLevel: boolean;
  } {
    const lower = keyword.toLowerCase().trim();

    // 1. Check for country or state suffixes: e.g. "... india", "... in india"
    const countryNorm = hierarchy.country ? this.normalizePlaceName(hierarchy.country) : 'india';
    if (countryNorm && (lower.endsWith(` ${countryNorm}`) || lower.includes(` in ${countryNorm}`))) {
      return {
        valid: false,
        reason: `CONTAINS_COUNTRY_SUFFIX (${countryNorm})`,
        isSublocality: false,
        isCityLevel: false,
      };
    }

    // 2. Disallow explicit disallowed place names (e.g. "new delhi" when city is Delhi / Tri Nagar)
    for (const dis of hierarchy.disallowedPlaceNames) {
      const disPattern = new RegExp(`(^|\\s)${dis}(\\s|$)`, 'i');
      if (disPattern.test(lower)) {
        return {
          valid: false,
          reason: `DISALLOWED_PLACE_NAME (${dis})`,
          isSublocality: false,
          isCityLevel: false,
        };
      }
    }

    // 3. Extract potential place segment from "in <place>", "at <place>", "near <place>" (excluding "near me" / "nearby")
    const cleanForPlace = lower.replace(/\b(?:near\s+me|nearby)\b/gi, '').trim();
    const inMatch = cleanForPlace.match(/\b(?:in|at|near)\s+([a-z0-9\s]+)$/i);
    let matchedPlace: string | undefined;
    let isSubloc = false;
    let isCity = false;

    if (inMatch) {
      const placeCandidate = inMatch[1].trim();
      const normCandidate = this.normalizePlaceName(placeCandidate);

      // Check against allowed hierarchy place names
      let foundMatch = false;
      for (const lvl of hierarchy.levels) {
        if (normCandidate === lvl.normalizedName || normCandidate.includes(lvl.normalizedName)) {
          foundMatch = true;
          matchedPlace = lvl.name;
          if (lvl.rank <= 2) isSubloc = true;
          if (lvl.rank === 3) isCity = true;
          break;
        }
      }

      if (!foundMatch) {
        // Keyword names a place outside hierarchy
        return {
          valid: false,
          reason: `PLACE_OUTSIDE_HIERARCHY ("${placeCandidate}")`,
          namedPlace: placeCandidate,
          isSublocality: false,
          isCityLevel: false,
        };
      }
    } else {
      // Check if keyword contains any allowed sublocality or city without preposition
      for (const lvl of hierarchy.levels) {
        const lvlPattern = new RegExp(`(^|\\s)${lvl.normalizedName}(\\s|$)`, 'i');
        if (lvlPattern.test(lower)) {
          matchedPlace = lvl.name;
          if (lvl.rank <= 2) isSubloc = true;
          if (lvl.rank === 3) isCity = true;
          break;
        }
      }
    }

    return {
      valid: true,
      namedPlace: matchedPlace,
      isSublocality: isSubloc,
      isCityLevel: isCity && !isSubloc,
    };
  }

  /**
   * Singularizes standard English plural noun endings for duplicate comparison.
   * e.g. "stores" -> "store", "shops" -> "shop", "clinics" -> "clinic".
   */
  public static singularizeToken(token: string): string {
    const t = token.toLowerCase();
    if (t.endsWith('ies') && t.length > 4) {
      return t.slice(0, -3) + 'y';
    }
    if (
      (t.endsWith('ches') || t.endsWith('shes') || t.endsWith('sses') || t.endsWith('xes') || t.endsWith('zes')) &&
      t.length > 4
    ) {
      return t.slice(0, -2);
    }
    if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is') && t.length > 3) {
      return t.slice(0, -1);
    }
    return t;
  }

  /**
   * Generates a singular canonical signature for plural deduplication.
   */
  public static getSingularSignature(kw: string): string {
    return kw
      .toLowerCase()
      .split(/\s+/)
      .map((tok) => this.singularizeToken(tok))
      .join(' ');
  }
}
