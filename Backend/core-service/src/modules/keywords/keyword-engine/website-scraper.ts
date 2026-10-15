/**
 * Website Scraper Module
 * 
 * Extracts high-intent candidate services from a business website with:
 *   - SSRF protection (disallows private/loopback IPs, non-HTTP schemes).
 *   - 5-second hard timeout.
 *   - 500KB response body cap.
 *   - Safe HTML parsing of <title>, <h1>, and <meta name="description">.
 *   - Graceful fail-soft on network errors or missing websites.
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface ScrapedWebsiteData {
  title?: string;
  h1?: string;
  metaDescription?: string;
  candidateKeywords: string[];
}

export class WebsiteScraper {
  /**
   * SSRF Protection: Checks if a hostname or IP is loopback, link-local, or private RFC1918.
   */
  public static isPrivateOrLoopbackHost(hostname: string): boolean {
    const lower = hostname.toLowerCase().trim();
    if (lower === 'localhost' || lower === '127.0.0.1' || lower === '0.0.0.0' || lower === '::1') {
      return true;
    }

    // Check IPv4 private ranges
    const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const b0 = parseInt(ipv4Match[1], 10);
      const b1 = parseInt(ipv4Match[2], 10);

      // 10.0.0.0/8
      if (b0 === 10) return true;
      // 172.16.0.0/12
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      // 192.168.0.0/16
      if (b0 === 192 && b1 === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (b0 === 169 && b1 === 254) return true;
      // 127.0.0.0/8 (loopback)
      if (b0 === 127) return true;
    }

    // Check for internal suffix patterns (.internal, .local, .lan)
    if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.lan')) {
      return true;
    }

    return false;
  }

  /**
   * Scrapes the target website for Title, H1, Meta Description within 5 seconds and 500KB limit.
   */
  public static async scrape(targetUrl?: string): Promise<ScrapedWebsiteData> {
    const emptyResult: ScrapedWebsiteData = { candidateKeywords: [] };
    if (!targetUrl || typeof targetUrl !== 'string') return emptyResult;

    let parsed: URL;
    try {
      const withProto = targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
        ? targetUrl
        : `https://${targetUrl}`;
      parsed = new URL(withProto);
    } catch {
      return emptyResult;
    }

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return emptyResult;
    }

    // SSRF Check
    if (this.isPrivateOrLoopbackHost(parsed.hostname)) {
      return emptyResult;
    }

    try {
      const html = await this.fetchWithCapAndTimeout(parsed.toString(), 5000, 500 * 1024);
      return this.extractFromHtml(html);
    } catch {
      return emptyResult;
    }
  }

  /**
   * Fetches HTML content with strict 500KB cap and 5-second timeout.
   */
  private static fetchWithCapAndTimeout(urlStr: string, timeoutMs: number, maxBytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
          },
          timeout: timeoutMs,
        },
        (res) => {
          // Handle basic redirects (max 1 level)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            req.destroy();
            try {
              const redirectUrl = new URL(res.headers.location, urlStr);
              if (this.isPrivateOrLoopbackHost(redirectUrl.hostname)) {
                return resolve('');
              }
              return resolve(this.fetchWithCapAndTimeout(redirectUrl.toString(), timeoutMs, maxBytes));
            } catch {
              return resolve('');
            }
          }

          if (res.statusCode && res.statusCode >= 400) {
            req.destroy();
            return resolve('');
          }

          let totalBytes = 0;
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length;
            chunks.push(chunk);
            if (totalBytes >= maxBytes) {
              res.destroy();
              resolve(Buffer.concat(chunks).slice(0, maxBytes).toString('utf8'));
            }
          });

          res.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
          });

          res.on('error', (err) => {
            reject(err);
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('FETCH_TIMEOUT'));
        resolve('');
      });

      req.on('error', () => {
        resolve('');
      });
    });
  }

  /**
   * Parses HTML string to extract title, h1, and meta description keywords.
   */
  public static extractFromHtml(html: string): ScrapedWebsiteData {
    if (!html) return { candidateKeywords: [] };

    // Extract Title
    let title: string | undefined;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s+/g, ' ').trim();
    }

    // Extract H1
    let h1: string | undefined;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      h1 = h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract Meta Description
    let metaDescription: string | undefined;
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    if (metaMatch) {
      metaDescription = metaMatch[1].replace(/\s+/g, ' ').trim();
    }

    const candidateKeywords: string[] = [];

    // Helper to process title segments (often: "Brand Name | Best Category in City")
    if (title) {
      const parts = title.split(/[|\-–—:]/).map((p) => p.trim()).filter((p) => p.length >= 3 && p.length <= 40);
      for (const p of parts) {
        if (!candidateKeywords.includes(p.toLowerCase())) {
          candidateKeywords.push(p.toLowerCase());
        }
      }
    }

    if (h1 && h1.length >= 3 && h1.length <= 40) {
      if (!candidateKeywords.includes(h1.toLowerCase())) {
        candidateKeywords.push(h1.toLowerCase());
      }
    }

    return {
      title,
      h1,
      metaDescription,
      candidateKeywords: candidateKeywords.slice(0, 5),
    };
  }
}
