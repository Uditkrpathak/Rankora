export interface ApiError {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
  retryAfter?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    requestId?: string;
    correlationId?: string;
    timestamp?: string;
    [key: string]: any;
  };
}
