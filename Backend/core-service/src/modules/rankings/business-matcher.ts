/**
 * Unified Business Matcher
 * 
 * Strict deterministic ordering for matching Google Maps SERP items to a target business:
 * 1. placeId: (must start with 'ChIJ' and >= 20 chars; never gm_* or 0x*)
 * 2. mapsCid: normalized hex / decimal CID
 * 3. website domain + within 300m
 * 4. normalized name + within 50m (token overlap >= 0.6)
 * 5. exact normalized name + normalized address (or within 300m)
 * 6. phone_details: (Places details only; last 10 digits + [name overlap >= 0.5 or distance <= 300m])
 */

export interface TargetBusiness {
  placeId?: string | null;
  mapsCid?: string | null;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export interface MatchCandidateItem {
  placeId?: string | null;
  cid?: string | null;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface MatchOptions {
  mode?: 'search' | 'details';
}

export interface MatchResult {
  match: boolean;
  isMatch: boolean;
  by?: 'placeId' | 'mapsCid' | 'website_distance' | 'name_distance' | 'name_address' | 'phone_details';
  matchedBy?: 'placeId' | 'mapsCid' | 'website_distance' | 'name_distance' | 'name_address' | 'phone_details';
}

function makeResult(
  match: boolean,
  by?: 'placeId' | 'mapsCid' | 'website_distance' | 'name_distance' | 'name_address' | 'phone_details'
): MatchResult {
  return {
    match,
    isMatch: match,
    by,
    matchedBy: by,
  };
}

export function normalizeBusinessString(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeTokenOverlap(str1: string, str2: string): number {
  const norm1 = normalizeBusinessString(str1);
  const norm2 = normalizeBusinessString(str2);
  const tokens1 = new Set(norm1.split(' ').filter((t) => t.length > 1));
  const tokens2 = new Set(norm2.split(' ').filter((t) => t.length > 1));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let matchCount = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) matchCount++;
  }
  return matchCount / Math.max(tokens1.size, tokens2.size);
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371008.8 * c;
}

export function normalizeCid(cid?: string | null): string | null {
  if (!cid) return null;
  const trimmed = cid.trim().toLowerCase();
  const hexTarget = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed;
  if (hexTarget.startsWith('0x')) {
    try {
      return BigInt(hexTarget).toString();
    } catch {
      return hexTarget;
    }
  }
  return trimmed;
}

export function extractCidFromGoogleMapsUri(uri?: string | null): string | null {
  if (!uri) return null;
  const match = uri.match(/[?&]cid=([0-9]+)/i);
  return match ? match[1] : null;
}

export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(raw);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function isPlausiblePlaceId(id?: string | null): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  // Valid Google Place ID starts with ChIJ and has length >= 10, never gm_* or hex 0x
  return trimmed.startsWith('ChIJ') && trimmed.length >= 10 && !trimmed.startsWith('0x') && !trimmed.startsWith('gm_');
}

export function matchBusiness(
  arg1: any,
  arg2: any,
  options: MatchOptions = {}
): MatchResult {
  // Support calling as either (target, candidate) or (candidate, target)
  const isArg1Target = Boolean(arg1 && ('mapsCid' in arg1 || 'targetPlaceId' in arg1 || 'coordinates' in arg1));
  const target: TargetBusiness = isArg1Target ? arg1 : arg2;
  const item: MatchCandidateItem = isArg1Target ? arg2 : arg1;

  if (!target || !item) {
    return makeResult(false);
  }

  // 1. placeId match (Strict validation: must start with ChIJ, length >= 20, no synthetic gm_ or hex 0x)
  if (
    isPlausiblePlaceId(target.placeId) &&
    isPlausiblePlaceId(item.placeId) &&
    target.placeId!.trim() === item.placeId!.trim()
  ) {
    return makeResult(true, 'placeId');
  }

  // 2. mapsCid match (normalized decimal / hex)
  const targetCid = normalizeCid(target.mapsCid || (target as any).cid);
  const itemCid = normalizeCid(item.cid || (item as any).mapsCid);
  if (targetCid && itemCid && targetCid === itemCid) {
    return makeResult(true, 'mapsCid');
  }

  // Compute physical distance if both coordinates are available
  const targetLat = target.coordinates?.lat ?? (target as any).lat;
  const targetLng = target.coordinates?.lng ?? (target as any).lng;
  const itemLat = item.lat;
  const itemLng = item.lng;

  let distanceMeters: number | null = null;
  if (
    typeof targetLat === 'number' &&
    typeof targetLng === 'number' &&
    typeof itemLat === 'number' &&
    typeof itemLng === 'number'
  ) {
    distanceMeters = haversineDistanceMeters(targetLat, targetLng, itemLat, itemLng);
  }

  // 3. Website domain + within 300m
  const targetDomain = extractDomain(target.website);
  const itemDomain = extractDomain(item.website);
  if (targetDomain && itemDomain && targetDomain === itemDomain) {
    if (distanceMeters !== null) {
      if (distanceMeters <= 300) {
        return makeResult(true, 'website_distance');
      }
    } else {
      // If coordinates are missing on card, require normalized address match
      const normTargetAddr = normalizeBusinessString(target.address);
      const normItemAddr = normalizeBusinessString(item.address);
      if (normTargetAddr && normItemAddr && normTargetAddr === normItemAddr) {
        return makeResult(true, 'website_distance');
      }
    }
  }

  // 4. Normalized name + within 50m (token overlap >= 0.6)
  const tokenOverlap = computeTokenOverlap(target.name || '', item.name || '');
  if (tokenOverlap >= 0.6 && distanceMeters !== null && distanceMeters <= 50) {
    return makeResult(true, 'name_distance');
  }

  // 5. Exact normalized name + normalized address (or within 300m)
  const normTargetName = normalizeBusinessString(target.name);
  const normItemName = normalizeBusinessString(item.name);
  if (normTargetName.length >= 3 && normTargetName === normItemName) {
    if (distanceMeters !== null && distanceMeters <= 300) {
      return makeResult(true, 'name_address');
    }
    const normTargetAddr = normalizeBusinessString(target.address);
    const normItemAddr = normalizeBusinessString(item.address);
    if (
      normTargetAddr &&
      normItemAddr &&
      (normTargetAddr === normItemAddr || computeTokenOverlap(target.address || '', item.address || '') >= 0.7)
    ) {
      return makeResult(true, 'name_address');
    }
    if (!normTargetAddr || !normItemAddr) {
      return makeResult(true, 'name_address');
    }
  }

  // 6. phone_details: Keep ONLY for Places-details comparisons (mode === 'details')
  if (options.mode === 'details') {
    const targetPhone = (target.phone || '').replace(/\D/g, '');
    const itemPhone = (item.phone || '').replace(/\D/g, '');
    if (
      targetPhone.length >= 10 &&
      itemPhone.length >= 10 &&
      targetPhone.slice(-10) === itemPhone.slice(-10)
    ) {
      if (tokenOverlap >= 0.5 || (distanceMeters !== null && distanceMeters <= 300)) {
        return makeResult(true, 'phone_details');
      }
    }
  }

  return makeResult(false);
}
