export interface HttpFetchOptions {
  headers?: Record<string, string>;
  dispatcher?: any;
  proxyUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  decompress?: boolean;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  rawWireBuffer: Buffer;
  wireBytes: number;
  rawText: string;
  decodedBytes: number;
  contentEncoding: string;
}

export interface HttpFetcher {
  readonly name: string;
  fetch(url: string, options?: HttpFetchOptions): Promise<HttpResponse>;
}
