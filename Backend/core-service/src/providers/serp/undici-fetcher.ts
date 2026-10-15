import { request as undiciRequest } from 'undici';
import zlib from 'zlib';
import { HttpFetcher, HttpFetchOptions, HttpResponse } from './http-fetcher.interface';
import { GoogleMapsParseError } from './google-maps-field-mapping';

export class UndiciFetcher implements HttpFetcher {
  public readonly name = 'UNDICI_FETCHER';

  public async fetch(url: string, options: HttpFetchOptions = {}): Promise<HttpResponse> {
    const timeoutMs = options.timeoutMs || 15000;
    const signal = options.signal || AbortSignal.timeout(timeoutMs);

    try {
      const response = await undiciRequest(url, {
        method: 'GET',
        headers: options.headers || {},
        dispatcher: options.dispatcher,
        signal,
      });

      const contentEncoding = (response.headers['content-encoding'] as string) || 'identity';

      // Read raw wire stream chunks to measure exact wire size
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) {
        chunks.push(chunk as Buffer);
      }
      const rawWireBuffer = Buffer.concat(chunks);
      const wireBytes = rawWireBuffer.length;

      let rawText: string;

      if (options.decompress !== false) {
        if (contentEncoding === 'br') {
          try {
            rawText = zlib.brotliDecompressSync(rawWireBuffer).toString('utf-8');
          } catch (e: any) {
            throw new GoogleMapsParseError(`SCRAPER_PARSE_ERROR: Brotli decompression failed: ${e.message}`, 'SCRAPER_PARSE_ERROR');
          }
        } else if (contentEncoding === 'gzip') {
          try {
            rawText = zlib.gunzipSync(rawWireBuffer).toString('utf-8');
          } catch (e: any) {
            throw new GoogleMapsParseError(`SCRAPER_PARSE_ERROR: Gzip decompression failed: ${e.message}`, 'SCRAPER_PARSE_ERROR');
          }
        } else if (contentEncoding === 'deflate') {
          try {
            rawText = zlib.inflateSync(rawWireBuffer).toString('utf-8');
          } catch (e: any) {
            throw new GoogleMapsParseError(`SCRAPER_PARSE_ERROR: Deflate decompression failed: ${e.message}`, 'SCRAPER_PARSE_ERROR');
          }
        } else {
          rawText = rawWireBuffer.toString('utf-8');
        }
      } else {
        rawText = rawWireBuffer.toString('utf-8');
      }

      const decodedBytes = Buffer.byteLength(rawText, 'utf-8');

      return {
        statusCode: response.statusCode,
        headers: response.headers as Record<string, string | string[] | undefined>,
        rawWireBuffer,
        wireBytes,
        rawText,
        decodedBytes,
        contentEncoding,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 'ABORT_ERR' || err.name === 'AbortError') {
        const timeoutErr: any = new Error(`SCRAPER_TIMEOUT: HTTP request timed out after ${timeoutMs}ms`);
        timeoutErr.code = 'SCRAPER_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }
}
