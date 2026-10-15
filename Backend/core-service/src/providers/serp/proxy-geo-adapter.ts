import { GeoTarget, INDIAN_METRO_NORMALIZATION_MAP } from './proxy-manager';

export interface IProxyGeoAdapter {
  readonly vendorName: string;
  formatUsername(
    baseUsername: string,
    geo?: GeoTarget,
    sessionId?: string
  ): { username: string; appliedLevel: 'city' | 'region' | 'country' | 'none' };
  supportsCityLevel(): boolean;
  getDocumentation(): string;
}

/**
 * Normalizes city names for Indian metros to match proxy vendor IP databases.
 */
export function normalizeIndianCity(cityName?: string): string {
  if (!cityName) return '';
  const clean = cityName.trim().toLowerCase();
  return INDIAN_METRO_NORMALIZATION_MAP[clean] || clean.replace(/[^a-z0-9]/g, '');
}

/**
 * Webshare Datacenter Proxy Adapter
 *
 * Real Vendor Documentation:
 * - Webshare Datacenter (Shared and Dedicated) proxies do NOT support username-based
 *   city targeting on their rotating backbone (p.webshare.io).
 * - Datacenter proxies are bound to fixed IP addresses allocated to the account.
 * - City-level targeting: NOT SUPPORTED.
 * - Fallback: Country-level or fixed IP assignment.
 */
export class WebshareDatacenterAdapter implements IProxyGeoAdapter {
  public readonly vendorName = 'webshare_datacenter';

  public supportsCityLevel(): boolean {
    return false;
  }

  public getDocumentation(): string {
    return 'Webshare Datacenter proxies do NOT support username city targeting on rotating backbone. Supports fixed IP list only.';
  }

  public formatUsername(
    baseUsername: string,
    geo?: GeoTarget,
    sessionId?: string
  ): { username: string; appliedLevel: 'city' | 'region' | 'country' | 'none' } {
    // Webshare Datacenter ignores city/region tags in username.
    return {
      username: baseUsername,
      appliedLevel: 'none',
    };
  }
}

/**
 * Webshare Residential Proxy Adapter
 *
 * Real Vendor Documentation:
 * - Webshare Residential proxies support country and city targeting via username syntax:
 *   Format: <username>-country-<cc>-city-<city>-session-<sessionid>
 * - City-level targeting: Supported on Residential plan with Geo-Targeting add-on.
 * - Indian metros supported: Mumbai, Bangalore, Delhi, Chennai, Hyderabad.
 * - If city is missing or unsupported, falls back to country-level:
 *   Format: <username>-country-<cc>-session-<sessionid>
 */
export class WebshareResidentialAdapter implements IProxyGeoAdapter {
  public readonly vendorName = 'webshare_residential';

  public supportsCityLevel(): boolean {
    return true;
  }

  public getDocumentation(): string {
    return 'Webshare Residential supports city targeting with username format: <user>-country-<cc>-city-<city>-session-<id>';
  }

  public formatUsername(
    baseUsername: string,
    geo?: GeoTarget,
    sessionId?: string
  ): { username: string; appliedLevel: 'city' | 'region' | 'country' | 'none' } {
    const country = geo?.country ? geo.country.trim().toLowerCase() : 'in';
    const city = normalizeIndianCity(geo?.city);
    const sid = sessionId || 'sess1';

    if (city) {
      return {
        username: `${baseUsername}-country-${country}-city-${city}-session-${sid}`,
        appliedLevel: 'city',
      };
    }

    if (geo?.region) {
      const regionClean = geo.region.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return {
        username: `${baseUsername}-country-${country}-state-${regionClean}-session-${sid}`,
        appliedLevel: 'region',
      };
    }

    return {
      username: `${baseUsername}-country-${country}-session-${sid}`,
      appliedLevel: 'country',
    };
  }
}

/**
 * Generic Template Geo Adapter
 * Configured via env PROXY_GEO_TEMPLATE, e.g.:
 * "${USER}-country-${COUNTRY}-city-${CITY}-session-${SESSION}"
 */
export class GenericTemplateGeoAdapter implements IProxyGeoAdapter {
  public readonly vendorName = 'generic_template';

  constructor(private readonly template: string = '${USER}-country-${COUNTRY}-city-${CITY}-session-${SESSION}') {}

  public supportsCityLevel(): boolean {
    return this.template.includes('${CITY}') || this.template.includes('$CITY');
  }

  public getDocumentation(): string {
    return `Configured via PROXY_GEO_TEMPLATE: "${this.template}"`;
  }

  public formatUsername(
    baseUsername: string,
    geo?: GeoTarget,
    sessionId?: string
  ): { username: string; appliedLevel: 'city' | 'region' | 'country' | 'none' } {
    const country = geo?.country ? geo.country.trim().toLowerCase() : 'in';
    const region = geo?.region ? geo.region.trim().toLowerCase() : '';
    const city = normalizeIndianCity(geo?.city);
    const sid = sessionId || 'sess1';

    let appliedLevel: 'city' | 'region' | 'country' | 'none' = 'none';
    let formatted = this.template
      .replace(/\$\{USER\}|\$USER/g, baseUsername)
      .replace(/\$\{SESSION\}|\$SESSION/g, sid);

    if (city && (formatted.includes('${CITY}') || formatted.includes('$CITY'))) {
      formatted = formatted.replace(/\$\{CITY\}|\$CITY/g, city);
      appliedLevel = 'city';
    } else if (region && (formatted.includes('${CITY}') || formatted.includes('$CITY'))) {
      formatted = formatted.replace(/\$\{CITY\}|\$CITY/g, region);
      appliedLevel = 'region';
    } else {
      formatted = formatted.replace(/\$\{CITY\}|\$CITY/g, country);
      if (appliedLevel === 'none') appliedLevel = 'country';
    }

    formatted = formatted.replace(/\$\{REGION\}|\$REGION/g, region || country);
    formatted = formatted.replace(/\$\{COUNTRY\}|\$COUNTRY/g, country);

    return {
      username: formatted,
      appliedLevel,
    };
  }
}

/**
 * Factory function to retrieve the configured Geo Adapter
 */
export function getProxyGeoAdapter(geoMode?: string, template?: string): IProxyGeoAdapter {
  const mode = (geoMode || process.env.PROXY_GEO_MODE || 'none').toLowerCase();
  if (mode === 'none') {
    return new WebshareDatacenterAdapter();
  }

  const customTemplate = template || process.env.PROXY_GEO_TEMPLATE;
  if (customTemplate) {
    return new GenericTemplateGeoAdapter(customTemplate);
  }

  // Default username geo mode uses Webshare Residential format
  return new WebshareResidentialAdapter();
}
