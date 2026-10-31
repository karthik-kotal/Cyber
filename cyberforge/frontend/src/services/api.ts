/**
 * Centralized API service for the Community Scam Map frontend.
 *
 * Rules enforced here:
 *  - All endpoint paths live in this file only.
 *  - Backend base URL comes from VITE_API_BASE_URL (empty string = same-origin).
 *  - Automatically transmits the active POV (admin, normal, demo) and authorization tokens.
 *  - The frontend never computes verdicts, masking, or thresholds; it renders
 *    exactly what the backend returns.
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
  AdminLoginRequest,
  AdminLoginResponse,
  AdminReportItem,
  AdminDisputeItem,
  DisputeDecisionRequest,
  DisputeDecisionResponse,
  DisputeAuditLogItem,
  ScamCategoryItem,
  HashComparisonResponse,
} from '../types/api';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ENDPOINTS = {
  health: '/api/health',
  lookup: (identifier: string) =>
    '/api/lookup/' + encodeURIComponent(identifier),
  report: '/api/report',
  map: '/api/map',
  alerts: '/api/alerts',
  challenge: (reportId: string) =>
    '/api/report/' + encodeURIComponent(reportId) + '/challenge',
  licenseStatus: '/api/license/status',
  licenseActivate: '/api/license/activate',
  adminLogin: '/api/admin/login',
  adminReports: '/api/admin/reports',
  adminDisputes: '/api/admin/disputes',
  adminDisputeDecision: (id: string) =>
    '/api/admin/disputes/' + encodeURIComponent(id) + '/decision',
  adminAuditLog: '/api/admin/disputes/audit-log',
  demoLicenseStatus: '/api/demo/license/status',
  demoLicenseReset: '/api/demo/license/reset',
  demoLicenseActivate: '/api/demo/license/activate',
  scamCategories: '/api/scam-categories',
  adminEvidence: (id: string) => '/api/admin/reports/' + encodeURIComponent(id) + '/evidence',
  compareHashes: '/api/admin/evidence/compare-hashes',
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
  if (status === 401 || status === 403) return 'LICENSE';
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

  // POV context and administrator authorization
  const currentPov = localStorage.getItem('cyberforge_pov') || 'normal';
  const adminToken = localStorage.getItem('cyberforge_admin_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-CyberForge-POV': currentPov,
  };

  if (adminToken && (currentPov === 'admin' || path.startsWith('/api/admin'))) {
    headers['Authorization'] = 'Bearer ' + adminToken;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
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
      // no JSON body
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
// Public & Core API Calls
// ---------------------------------------------------------------------------

/** Health/connectivity probe. */
export function getHealth(options?: RequestOptions): Promise<HealthResponse> {
  return jsonFetch<HealthResponse>(ENDPOINTS.health, options);
}

/** Identifier verification. */
export function lookup(identifier: string, options?: RequestOptions): Promise<LookupResponse> {
  if (!identifier.trim()) {
    return Promise.reject(new ApiError('VALIDATION', 'Enter what you want to check.'));
  }
  return jsonFetch<LookupResponse>(ENDPOINTS.lookup(identifier.trim()), options);
}

/** Anonymous scam report. */
export function submitReport(payload: ReportPayload, options?: RequestOptions): Promise<ReportResponse> {
  return jsonFetch<ReportResponse>(ENDPOINTS.report, {
    ...options,
    method: 'POST',
    body: payload,
  });
}

/** Community scam map centroids. */
export function getMap(types?: string[] | undefined, options?: RequestOptions): Promise<MapResponse> {
  const t = types && types.length > 0 ? types.join(',') : undefined;
  return jsonFetch<MapResponse>(ENDPOINTS.map, { ...options, params: { type: t } });
}

/** Alerts feed. */
export function getAlerts(options?: RequestOptions): Promise<AlertsResponse> {
  return jsonFetch<AlertsResponse>(ENDPOINTS.alerts, options);
}

/** Dispute an individual report by its reference ID. */
export function challengeReport(
  reportId: string,
  payload: ChallengePayload,
  options?: RequestOptions
): Promise<ChallengeResponse> {
  return jsonFetch<ChallengeResponse>('/api/disputes', {
    ...options,
    method: 'POST',
    body: {
      ...payload,
      reference_id: reportId,
      report_id: reportId,
    },
  });
}

/** License status for active POV. */
export function getLicenseStatus(options?: RequestOptions): Promise<LicenseResponse> {
  return jsonFetch<LicenseResponse>(ENDPOINTS.licenseStatus, options);
}

/** License activation/renewal. */
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

// ---------------------------------------------------------------------------
// Administrator API Calls
// ---------------------------------------------------------------------------

export function adminLogin(payload: AdminLoginRequest, options?: RequestOptions): Promise<AdminLoginResponse> {
  return jsonFetch<AdminLoginResponse>(ENDPOINTS.adminLogin, {
    ...options,
    method: 'POST',
    body: payload,
  });
}

export function getAdminReports(options?: RequestOptions): Promise<AdminReportItem[]> {
  return jsonFetch<AdminReportItem[]>(ENDPOINTS.adminReports, options);
}

export function getAdminDisputes(options?: RequestOptions): Promise<AdminDisputeItem[]> {
  return jsonFetch<AdminDisputeItem[]>(ENDPOINTS.adminDisputes, options);
}

export function decideDispute(
  challengeId: string,
  payload: DisputeDecisionRequest,
  options?: RequestOptions
): Promise<DisputeDecisionResponse> {
  return jsonFetch<DisputeDecisionResponse>(ENDPOINTS.adminDisputeDecision(challengeId), {
    ...options,
    method: 'POST',
    body: payload,
  });
}

export function getDisputeAuditLog(options?: RequestOptions): Promise<DisputeAuditLogItem[]> {
  return jsonFetch<DisputeAuditLogItem[]>(ENDPOINTS.adminAuditLog, options);
}

// ---------------------------------------------------------------------------
// Demo User API Calls
// ---------------------------------------------------------------------------

export function getDemoLicenseStatus(options?: RequestOptions): Promise<LicenseResponse> {
  return jsonFetch<LicenseResponse>(ENDPOINTS.demoLicenseStatus, options);
}

export function resetDemoLicense(options?: RequestOptions): Promise<LicenseResponse> {
  return jsonFetch<LicenseResponse>(ENDPOINTS.demoLicenseReset, {
    ...options,
    method: 'POST',
  });
}


export function getScamCategories(options?: RequestOptions): Promise<ScamCategoryItem[]> {
  return jsonFetch<ScamCategoryItem[]>(ENDPOINTS.scamCategories, options);
}

export function getAdminReportEvidence(reportId: string, options?: RequestOptions): Promise<any> {
  return jsonFetch<any>(ENDPOINTS.adminEvidence(reportId), options);
}

export function compareHashes(hashA: string, hashB: string, options?: RequestOptions): Promise<HashComparisonResponse> {
  return jsonFetch<HashComparisonResponse>(ENDPOINTS.compareHashes, {
    ...options,
    method: 'POST',
    body: { hash_a: hashA, hash_b: hashB },
  });
}
