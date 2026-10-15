import { ISchemaVerification } from '@localo/types';
import http from 'http';
import https from 'https';
import dns from 'dns';
import { URL } from 'url';

export class SchemaCrawlerService {
  private static MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB max memory cap
  private static MAX_REDIRECTS = 3;

  /**
   * SSRF Protection: Validates whether an IP address belongs to private, loopback, link-local, or cloud metadata ranges.
   */
  public isPrivateIp(ip: string): boolean {
    if (!ip) return true;

    // IPv6 checks
    if (ip.includes(':')) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (lower.startsWith('fe80:')) return true; // link-local
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
      return false;
    }

    // IPv4 checks
    const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return true;

    const [o1, o2] = match.slice(1, 3).map(Number);

    // 0.0.0.0/8
    if (o1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (o1 === 10) return true;
    // 172.16.0.0/12 (Private)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return true;
    // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
    if (o1 === 169 && o2 === 254) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
    // 255.255.255.255 (Broadcast)
    if (o1 === 255) return true;

    return false;
  }

  /**
   * SSRF Protection: Validates URL syntax and resolves hostname to a safe, public IP.
   */
  public async isSafeUrl(rawUrl: string): Promise<{ safe: boolean; reason?: string; parsedUrl?: URL; resolvedIp?: string }> {
    try {
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return { safe: false, reason: 'Empty URL.' };
      }

      const trimmed = rawUrl.trim();
      const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed);

      if (hasProtocol && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return { safe: false, reason: 'Invalid protocol: only HTTP and HTTPS are allowed.' };
      }

      const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { safe: false, reason: 'Invalid protocol: only HTTP and HTTPS are allowed.' };
      }

      const hostname = url.hostname.toLowerCase();

      // Disallow localhost and common local aliases
      if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
        return { safe: false, reason: 'Localhost and loopback addresses are blocked.' };
      }

      let resolvedIp = '';

      // Check literal IP if hostname is an IP
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
        if (this.isPrivateIp(hostname)) {
          return { safe: false, reason: 'Private and internal IP addresses are blocked.' };
        }
        resolvedIp = hostname;
      } else {
        // Resolve DNS to verify hostname does not point to internal/private IP
        try {
          const lookup = await dns.promises.lookup(hostname, { all: true });
          if (!lookup || lookup.length === 0) {
            return { safe: false, reason: 'DNS resolution returned no addresses.' };
          }
          for (const addr of lookup) {
            if (this.isPrivateIp(addr.address)) {
              return { safe: false, reason: `Host resolves to private IP (${addr.address}), which is blocked.` };
            }
          }
          resolvedIp = lookup[0].address;
        } catch (dnsErr: any) {
          return { safe: false, reason: `DNS resolution failed: ${dnsErr?.message || 'Host not found'}` };
        }
      }

      return { safe: true, parsedUrl: url, resolvedIp };
    } catch {
      return { safe: false, reason: 'Malformed URL.' };
    }
  }

  /**
   * Performs a bounded streaming HTTP request pinned to a pre-validated IP to eliminate DNS rebinding.
   */
  private fetchPinned(
    url: URL,
    pinnedIp: string
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          'Host': url.host,
          'User-Agent': 'Mozilla/5.0 (compatible; LocaloSchemaBot/1.0; +https://localo.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Connection': 'close',
        },
        timeout: 6000,
        // Pin DNS lookup to the verified safe IP to prevent DNS rebinding attacks
        lookup: (_host, _opts, callback) => {
          callback(null, pinnedIp, pinnedIp.includes(':') ? 6 : 4);
        },
      };

      const req = transport.request(options, (res) => {
        let totalBytes = 0;
        let responseData = '';
        let destroyed = false;

        res.setEncoding('utf8');

        res.on('data', (chunk: string) => {
          totalBytes += Buffer.byteLength(chunk, 'utf8');
          if (totalBytes <= SchemaCrawlerService.MAX_RESPONSE_BYTES) {
            responseData += chunk;
          } else if (!destroyed) {
            destroyed = true;
            req.destroy(); // Abort reading beyond 2MB memory cap
            resolve({
              status: res.statusCode || 200,
              headers: res.headers,
              body: responseData,
            });
          }
        });

        res.on('end', () => {
          if (!destroyed) {
            resolve({
              status: res.statusCode || 200,
              headers: res.headers,
              body: responseData,
            });
          }
        });

        res.on('error', (err) => {
          if (!destroyed) reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Crawler request timed out after 6000ms'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Fetches target URL with DNS pinning, redirect guards, and bounded memory streams.
   */
  public async verifyLocalBusinessSchema(rawUrl: string): Promise<ISchemaVerification> {
    let currentUrl = rawUrl;
    let redirectCount = 0;

    while (redirectCount <= SchemaCrawlerService.MAX_REDIRECTS) {
      const safety = await this.isSafeUrl(currentUrl);
      if (!safety.safe || !safety.parsedUrl || !safety.resolvedIp) {
        return {
          verified: false,
          verifiedAt: new Date(),
          detectedTypes: [],
          verificationMethod: 'automated_crawler',
          error: safety.reason || 'Blocked by SSRF security guard',
        };
      }

      try {
        const response = await this.fetchPinned(safety.parsedUrl, safety.resolvedIp);

        // Handle redirects securely by re-validating the redirect destination
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const locationHeader = response.headers.location;
          if (!locationHeader) {
            return {
              verified: false,
              verifiedAt: new Date(),
              detectedTypes: [],
              verificationMethod: 'automated_crawler',
              error: `HTTP ${response.status} redirect missing Location header`,
            };
          }

          currentUrl = new URL(locationHeader, safety.parsedUrl).toString();
          redirectCount++;
          if (redirectCount > SchemaCrawlerService.MAX_REDIRECTS) {
            return {
              verified: false,
              verifiedAt: new Date(),
              detectedTypes: [],
              verificationMethod: 'automated_crawler',
              error: 'Too many redirects (> 3)',
            };
          }
          continue;
        }

        if (response.status < 200 || response.status >= 300) {
          return {
            verified: false,
            verifiedAt: new Date(),
            detectedTypes: [],
            verificationMethod: 'automated_crawler',
            error: `HTTP ${response.status}: Target website returned non-2xx status`,
          };
        }

        return this.parseHtmlForSchema(response.body);
      } catch (err: any) {
        return {
          verified: false,
          verifiedAt: new Date(),
          detectedTypes: [],
          verificationMethod: 'automated_crawler',
          error: err.message || 'Network error fetching URL',
        };
      }
    }

    return {
      verified: false,
      verifiedAt: new Date(),
      detectedTypes: [],
      verificationMethod: 'automated_crawler',
      error: 'Max redirects exceeded',
    };
  }

  /**
   * Inspects raw HTML string for JSON-LD and microdata LocalBusiness schemas.
   */
  public parseHtmlForSchema(html: string): ISchemaVerification {
    const detectedTypes: Set<string> = new Set();
    let rawSnippet = '';

    const localBusinessTypes = new Set([
      'localbusiness',
      'store',
      'dentist',
      'dentalclinic',
      'bakery',
      'restaurant',
      'foodestablishment',
      'medicalbusiness',
      'healthandbeautybusiness',
      'automotivebusiness',
      'legalservice',
      'financialservice',
      'homeandconstructionservice',
      'lodgingbusiness',
      'emergencyservice',
      'professionalservice',
      'shoppingcenter',
      'childcare',
      'drycleaningorlaundry',
    ]);

    // 1. Parse JSON-LD script tags
    const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);
        this.extractTypesFromObject(parsed, detectedTypes, localBusinessTypes);
        if (detectedTypes.size > 0 && !rawSnippet) {
          rawSnippet = jsonContent.slice(0, 300);
        }
      } catch {
        // Skip malformed JSON blocks
      }
    }

    // 2. Parse Microdata itemtype
    const microdataRegex = /itemtype=["']https?:\/\/schema\.org\/([a-zA-Z0-9_-]+)["']/gi;
    while ((match = microdataRegex.exec(html)) !== null) {
      const type = match[1];
      if (localBusinessTypes.has(type.toLowerCase())) {
        detectedTypes.add(type);
      }
    }

    const verified = detectedTypes.size > 0;

    return {
      verified,
      verifiedAt: new Date(),
      detectedTypes: Array.from(detectedTypes),
      verificationMethod: 'automated_crawler',
      rawSnippet: rawSnippet || undefined,
    };
  }

  private extractTypesFromObject(obj: any, detectedTypes: Set<string>, validTypes: Set<string>): void {
    if (!obj) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractTypesFromObject(item, detectedTypes, validTypes);
      }
      return;
    }

    if (typeof obj === 'object') {
      if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        this.extractTypesFromObject(obj['@graph'], detectedTypes, validTypes);
      }

      const type = obj['@type'];
      if (typeof type === 'string') {
        const normalized = type.toLowerCase();
        if (validTypes.has(normalized)) {
          detectedTypes.add(type);
        }
      } else if (Array.isArray(type)) {
        for (const t of type) {
          if (typeof t === 'string' && validTypes.has(t.toLowerCase())) {
            detectedTypes.add(t);
          }
        }
      }

      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
          this.extractTypesFromObject(obj[key], detectedTypes, validTypes);
        }
      }
    }
  }
}

export const schemaCrawlerService = new SchemaCrawlerService();
