/**
 * Centralized API service for the Community Scam Map frontend.
 *
 * Rules enforced here:
 *  - All endpoint paths live in this file only (update once, app-wide effect).
 *  - Backend base URL comes from VITE_API_BASE_URL (empty string = same-origin).
 *  - The frontend never computes verdicts, masking, or thresholds; it renders
 *    exactly what the backend returns.
 *  - No secrets in frontend env vars; only public connection settings.
 */

import type {
  LookupResponse,
  ReportPayload,
  ReportResponse,
  MapResponse,
  AlertsResponse,
  ChallengePayload,
  ChallengeResponse,
  HealthResponse,
  LicenseResponse,
  ApiErrorBody,
} from '../types/api';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** All endpoint paths in one place. TBC = confirm exact paths with Developer A
 *  and update here only. */
export const ENDPOINTS = {
  health: '/api/health', // TBC
  lookup: (identifier: string) =>
    `/api/lookup/${encodeURIComponent(identifier)}`, // TBC
  report: '/api/report', // TBC
  map: '/api/map', // TBC
  alerts: '/api/alerts', // TBC
  challenge: (reportId: string) =>
    `/api/report/${encodeURIComponent(reportId)}/challenge`, // TBC
  licenseStatus: '/api/license/status', // TBC
  licenseActivate: '/api/license/activate', // TBC
} as const;

export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'LICENSE'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  /** Backend-provided human readable message, if any. Never invented. */
  readonly detail: string | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: { status?: number | null; detail?: string | null }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options?.status ?? null;
    this.detail = options?.detail ?? null;
  }
}

function statusToErrorCode(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 40200 && status <= 40299) return 'LICENSE';
  if (status === 401 || status === 403) return 'LICENSE'; // license gate (TBC)
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Fetch plumbing
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;

type QueryParams = Record<string, string | number | undefined | null>;

function buildUrl(path: string, params?: QueryParams): string {
  const base = apiBaseUrl();
  const url = new URL(
    path.replace(/^\//, ''),
    base === '' ? window.location.origin : base
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  params?: QueryParams;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function jsonFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit', // anonymous by design; no cookies/sent identity
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'The request timed out. Please try again.');
    }
    throw new ApiError(
      'NETWORK',
      'Cannot reach the server. Check your internet connection.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Prefer backend-provided detail text; never fabricate messages.
    let detail: string | null = null;
    let bodyError: ApiErrorBody | null = null;
    try {
      bodyError = (await response.json()) as ApiErrorBody;
      const rawDetail = bodyError?.detail ?? bodyError?.message ?? bodyError?.error;
      if (typeof rawDetail === 'string') {
        detail = rawDetail;
      } else if (rawDetail !== undefined && rawDetail !== null) {
        detail = JSON.stringify(rawDetail);
      }
    } catch {
      // no JSON body; fall through with null detail
    }
    const code = statusToErrorCode(response.status);
    const fallback =
      code === 'VALIDATION'
        ? 'The submitted details are not valid. Please check and retry.'
        : code === 'LICENSE'
          ? 'Your license is not valid for this request.'
          : code === 'NOT_FOUND'
            ? 'Not found.'
            : code === 'SERVER'
              ? 'The server had a problem. Please try again later.'
              : 'Something went wrong. Please try again.';
    throw new ApiError(code, fallback, { status: response.status, detail });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('SERVER', 'The server returned an unreadable response.', {
      status: response.status,
    });
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Health/connectivity probe used by the status banner (TBC path/shape). */
export function getHealth(options?: RequestOptions): Promise<HealthResponse> {
  return jsonFetch<HealthResponse>(ENDPOINTS.health, options);
}

/** Identifier verification. Returns the backend verdict response verbatim. */
export function lookup(identifier: string, options?: RequestOptions): Promise<LookupResponse> {
  if (!identifier.trim()) {
    return Promise.reject(new ApiError('VALIDATION', 'Enter what you want to check.'));
  }
  return jsonFetch<LookupResponse>(ENDPOINTS.lookup(identifier.trim()), options);
}

/** Anonymous scam report. Only fields supported by the PRD are sent. */
export function submitReport(payload: ReportPayload, options?: RequestOptions): Promise<ReportResponse> {
  return jsonFetch<ReportResponse>(ENDPOINTS.report, {
    ...options,
    method: 'POST',
    body: payload,
  });
}

/** Community scam map bubbles: fixed pincode centroids with counted reports. */
export function getMap(types?: string[] | undefined, options?: RequestOptions): Promise<MapResponse> {
  const t = types && types.length > 0 ? types.join(',') : undefined; // TBC parameter name with Developer A
  return jsonFetch<MapResponse>(ENDPOINTS.map, { ...options, params: { type: t } });
}

/** Alerts feed (SPIKE / NEW_TYPE). Backend decides thresholds. */
export function getAlerts(options?: RequestOptions): Promise<AlertsResponse> {
  return jsonFetch<AlertsResponse>(ENDPOINTS.alerts, options);
}

/** Dispute an individual report by its reference ID. Frontend never changes the verdict itself. */
export function challengeReport(
  reportId: string,
  payload: ChallengePayload,
  options?: RequestOptions
): Promise<ChallengeResponse> {
  return jsonFetch<ChallengeResponse>('/api/disputes', {
    ...options,
    method: 'POST',
    body: {
      reference_id: reportId,
      report_id: reportId,
      ...payload,
    },
  });
}

/** License status of this deployment (display only; enforcement is backend-side). */
export function getLicenseStatus(options?: RequestOptions): Promise<LicenseResponse> {
  return jsonFetch<LicenseResponse>(ENDPOINTS.licenseStatus, options);
}

/** License activation/renewal. No cryptographic work happens in the frontend. */
export function activateLicense(
  licenseKey: string,
  options?: RequestOptions
): Promise<LicenseResponse> {
  return jsonFetch<LicenseResponse>(ENDPOINTS.licenseActivate, {
    ...options,
    method: 'POST',
    body: { license_key: licenseKey },
  });
}
