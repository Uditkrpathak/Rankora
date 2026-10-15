import cp from 'child_process';
import zlib from 'zlib';
import { HttpFetcher, HttpFetchOptions, HttpResponse } from './http-fetcher.interface';

export class CurlImpersonateFetcher implements HttpFetcher {
  public readonly name = 'CURL_IMPERSONATE_FETCHER';

  constructor(private readonly binPath?: string) {}

  /**
   * Resolves whether to execute native binary or containerized BoringSSL Chrome binary.
   */
  private resolveExecutionCommand(): { command: string; baseArgs: string[] } {
    if (this.binPath) {
      return { command: this.binPath, baseArgs: [] };
    }
    if (process.env.CURL_IMPERSONATE_BIN) {
      return { command: process.env.CURL_IMPERSONATE_BIN, baseArgs: [] };
    }
    if (process.platform !== 'win32') {
      return { command: 'curl_chrome116', baseArgs: [] };
    }
    // On Windows development without native .exe, delegate to containerized BoringSSL Chrome
    return {
      command: 'docker',
      baseArgs: ['run', '--rm', 'lwthiker/curl-impersonate:0.6.1-chrome', 'curl_chrome116'],
    };
  }

  /**
   * Checks if a curl-impersonate binary or Docker container is available.
   */
  public async isAvailable(): Promise<boolean> {
    const { command, baseArgs } = this.resolveExecutionCommand();
    return new Promise((resolve) => {
      try {
        const proc = cp.spawn(command, [...baseArgs, '--version']);
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }

  public async fetch(url: string, options: HttpFetchOptions = {}): Promise<HttpResponse> {
    const { command, baseArgs } = this.resolveExecutionCommand();
    const timeoutMs = options.timeoutMs || 12000;

    const args: string[] = [...baseArgs, '-s', '-i', '--raw'];

    // Timeout in seconds (curl -m)
    args.push('-m', (timeoutMs / 1000).toFixed(1));

    // Headers
    if (options.headers) {
      for (const [key, val] of Object.entries(options.headers)) {
        args.push('-H', `${key}: ${val}`);
      }
    }

    // Proxy support (HTTP CONNECT)
    if (options.dispatcher && (options.dispatcher as any).proxyUri) {
      args.push('-x', (options.dispatcher as any).proxyUri);
    } else if (process.env.SCRAPER_PROXY_URL) {
      args.push('-x', process.env.SCRAPER_PROXY_URL);
    }

    args.push(url);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let errData = '';

      let timer: NodeJS.Timeout | null = setTimeout(() => {
        timer = null;
        try {
          proc.kill();
        } catch {}
        const timeoutErr: any = new Error(`CURL_IMPERSONATE_TIMEOUT: Request timed out after ${timeoutMs}ms`);
        timeoutErr.code = 'SCRAPER_TIMEOUT';
        reject(timeoutErr);
      }, timeoutMs);

      const proc = cp.spawn(command, args);

      proc.stdout.on('data', (data: Buffer) => chunks.push(data));
      proc.stderr.on('data', (data: Buffer) => (errData += data.toString()));

      proc.on('error', (err: any) => {
        if (timer) clearTimeout(timer);
        reject(new Error(`CURL_IMPERSONATE_EXEC_FAILED: Failed to execute binary '${command}': ${err.message}`));
      });

      proc.on('close', (code: number) => {
        if (timer) clearTimeout(timer);

        if (code !== 0 && chunks.length === 0) {
          reject(new Error(`CURL_IMPERSONATE_EXIT_${code}: ${errData || `Process exited with code ${code}`}`));
          return;
        }

        const rawBuffer = Buffer.concat(chunks);
        const wireBytes = rawBuffer.length;

        // Parse HTTP raw response (handling HTTP/2 headers and potential multi-block headers)
        let bodyBuffer = rawBuffer;
        let headerEnd = -1;
        let searchPos = 0;

        while (searchPos < rawBuffer.length) {
          const rnrn = rawBuffer.indexOf(Buffer.from('\r\n\r\n'), searchPos);
          const nn = rawBuffer.indexOf(Buffer.from('\n\n'), searchPos);
          let idx = -1;
          let sep = 4;
          if (rnrn !== -1 && (nn === -1 || rnrn <= nn)) {
            idx = rnrn;
            sep = 4;
          } else if (nn !== -1) {
            idx = nn;
            sep = 2;
          }

          if (idx === -1) break;
          const block = rawBuffer.subarray(searchPos, idx).toString('utf-8');
          if (block.includes('HTTP/')) {
            headerEnd = idx + sep;
            searchPos = headerEnd;
          } else {
            break;
          }
        }

        let statusCode = 200;
        const headers: Record<string, string> = {};

        if (headerEnd !== -1) {
          const allHeadersText = rawBuffer.subarray(0, headerEnd).toString('utf-8');
          bodyBuffer = rawBuffer.subarray(headerEnd);

          const lines = allHeadersText.split(/\r?\n/);
          for (const line of lines) {
            const match = line.match(/^HTTP\/[0-9.]+\s+(\d+)/i);
            if (match) {
              statusCode = parseInt(match[1], 10);
            }
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1) {
              const hKey = line.substring(0, colonIdx).trim().toLowerCase();
              const hVal = line.substring(colonIdx + 1).trim();
              headers[hKey] = hVal;
            }
          }
        }

        const contentEncoding = (headers['content-encoding'] || 'identity').toLowerCase();
        let rawText: string;
        try {
          if (contentEncoding === 'br') {
            rawText = zlib.brotliDecompressSync(bodyBuffer).toString('utf-8');
          } else if (contentEncoding === 'gzip') {
            rawText = zlib.gunzipSync(bodyBuffer).toString('utf-8');
          } else if (contentEncoding === 'deflate') {
            rawText = zlib.inflateSync(bodyBuffer).toString('utf-8');
          } else {
            rawText = bodyBuffer.toString('utf-8');
          }
        } catch {
          rawText = bodyBuffer.toString('utf-8');
        }

        resolve({
          statusCode,
          headers,
          rawWireBuffer: rawBuffer,
          wireBytes,
          rawText,
          decodedBytes: Buffer.byteLength(rawText, 'utf-8'),
          contentEncoding,
        });
      });
    });
  }
}
