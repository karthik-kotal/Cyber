/**
 * Official API contract types for the Community Scam Map project.
 *
 * These types mirror the PRD contract and Developer A's backend schemas.
 * Fields marked `TBC` are not yet confirmed with Developer A and must be
 * verified before relying on them. Endpoint paths live only in
 * services/api.ts to be updated in one place once routes are confirmed.
 */

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export const KNOWN_SCAM = 'KNOWN_SCAM' as const;
export const SUSPICIOUS = 'SUSPICIOUS' as const;
export const NO_REPORTS = 'NO_REPORTS' as const;
export const VERIFIED_BUSINESS = 'VERIFIED_BUSINESS' as const;

export const VERDICTS = [
  KNOWN_SCAM,
  SUSPICIOUS,
  NO_REPORTS,
  VERIFIED_BUSINESS,
] as const;

export type Verdict = (typeof VERDICTS)[number];

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const SPIKE = 'SPIKE' as const;
export const NEW_TYPE = 'NEW_TYPE' as const;

export const ALERT_TYPES = [SPIKE, NEW_TYPE] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export interface Alert {
  /** Unique server id */
  id: string;
  type: AlertType;
  /** Human-readable fields as provided by the backend (TBC exact shape) */
  title: string;
  body: string;
  /** Pincode or area the alert refers to (TBC field name with Developer A) */
  pincode: string;
  scam_type: string;
  created_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Lookup fields required by the PRD (Phase B3). Exact schema to be confirmed
 *  with Developer A; do not rename these fields. */
export interface LookupResponse {
  verdict: Verdict;
  /** May be null for e.g. VERIFIED_BUSINESS / NO_REPORTS presentations (TBC) */
  report_count: number | null;
  distinct_reporters: number | null;
  /** Backend-masked display value. The frontend MUST NOT unmask this. */
  display_value: string;
  challenged: boolean;
  /** ISO-8601 timestamps, may be null (TBC) */
  first_seen: string | null;
  last_seen: string | null;
  /** Backend canonical scam/normalization type, may be null (TBC) */
  scam_type: string | null;
  /** Supporting evidence list, may be empty (TBC item shape) */
  evidence: string[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Report channels/categories supported by the backend (TBC exact list) */
export const REPORT_CHANNELS = [
  'UPI',
  'PHONE',
  'SMS',
  'WHATSAPP',
  'EMAIL',
  'WEBSITE',
  'BANK_ACCOUNT',
  'OTHER',
] as const;

export type ReportChannel = (typeof REPORT_CHANNELS)[number];

export interface ReportPayload {
  /** Channel or category selected by the reporter */
  channel: ReportChannel;
  /** Raw identifier as entered by the user; backend normalizes + masks it */
  identifier: string;
  /** Optional pincode for the map (never GPS, never free-text address) */
  pincode?: number | null;
  /** Optional scam type hint (TBC, use only backend-supported values) */
  scam_type?: string | null;
}

export interface ReportResponse {
  /** Backend-generated report id returned on 201 */
  id: string;
  status: string;
  /** Normalized/masked value as stored/displayed by the backend */
  display_value: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Challenge / dispute
// ---------------------------------------------------------------------------

export interface ChallengePayload {
  reason: string;
}

export interface ChallengeResponse {
  id: string;
  status: string;
  /** e.g. PENDING / RESOLVED (TBC with Developer A) */
  created_at: string;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

/** One map bubble: fixed pincode centroid + counted reports only. */
export interface MapPoint {
  pincode: string;
  /** Fixed centroid data owned by the backend (never computed in frontend) */
  lat: number;
  lng: number;
  count: number;
  scam_type: string;
}

export interface MapResponse {
  points: MapPoint[];
}

// ---------------------------------------------------------------------------
// Health / connectivity
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// License
// ---------------------------------------------------------------------------

export type LicenseStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'NOT_ACTIVATED'
  | 'INVALID'
  // Backend may return other states; UI renders them as returned (TBC).
  | string;

export interface LicenseResponse {
  status: LicenseStatus;
  /** ISO-8601 expiry of the current license, if any */
  expires_at: string | null;
  /** Last N chars or masked key reference only - never a full secret (TBC) */
  license_hint: string | null;
}

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

/** Generic API error shape returned by the backend (e.g. FastAPI/httpx errors).
 *  TBC exact shape with Developer A; the frontend only maps HTTP status codes
 *  and shows backend `detail`/`message` text when present. */
export interface ApiErrorBody {
  detail?: string;
  message?: string;
  error?: string;
  code?: string;
}
