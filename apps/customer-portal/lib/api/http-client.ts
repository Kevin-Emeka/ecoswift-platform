import type { ApiErrorResponse, ApiResponse } from '@ecoswift/types';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  /** auth-service's cookie-based refresh needs the browser to send the httpOnly cookie along. */
  withCredentials?: boolean;
  headers?: Record<string, string>;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : undefined;
}

/**
 * Every request goes through here — auth-service's own `ApiErrorResponse`
 * envelope (`docs/api-guidelines.md`) is unwrapped into a typed
 * `ApiClientError`; the CSRF header is attached automatically whenever a
 * request relies on the ambient refresh cookie (`withCredentials`),
 * matching `auth.controller.ts`'s server-side check.
 */
export async function apiRequest<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.withCredentials) {
    const csrfToken = readCookie('ecoswift_csrf_token');
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: options.withCredentials ? 'include' : 'same-origin',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | undefined;
    throw new ApiClientError(
      errorPayload?.error?.message ?? response.statusText,
      errorPayload?.error?.code ?? String(response.status),
      response.status,
      errorPayload?.error?.details,
    );
  }

  // Services using ApiResponseInterceptor wrap in { success, data, timestamp }; auth-service (predates that convention) returns raw bodies — handle both.
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}
