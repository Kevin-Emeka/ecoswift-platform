/** Standard success envelope returned by every REST endpoint across the platform. */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/** Standard error envelope returned by every REST endpoint across the platform. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
