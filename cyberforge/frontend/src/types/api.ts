/**
 * Official API contract types for the Community Scam Map project.
 *
 * These types mirror Developer A's and Developer B's backend schemas in
 * backend/app/schemas.py and the API contract in backend/API_CONTRACT.md.
 * Endpoint paths live only in services/api.ts.
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
  /** Unique server id (optional; backend may omit for computed alerts) */
  id?: string | null;
  type: AlertType;
  /** Pincode or area the alert refers to */
  pincode?: string | null;
  window?: string | null;
  count?: number | null;
  baseline_per_day?: number | null;
  scam_type?: string | null;
  description?: string | null;
  severity?: string | null;
  title?: string | null;
  body?: string | null;
  created_at?: string | null;
}

export interface AlertsResponse {
  alerts: Alert[];
  count?: number;
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** One evidence item returned by the backend (PRD: only occurred_at,
 *  channel, scam_type, pincode — never reporter identity, IP, or notes). */
export interface EvidenceItem {
  occurred_at: string;
  channel?: string | null;
  scam_type?: string | null;
  pincode?: string | null;
}

/** Evidence summary object returned for non-verified, non-empty lookups. */
export interface EvidenceSummary {
  total_reported_loss_inr?: number;
  sample_occurred_at?: string | null;
  reports_analyzed?: number;
  duplicate_evidence_count?: number;
  matching_tx_refs_count?: number;
  visual_similarity_detected?: boolean;
  verified?: boolean;
  business_name?: string | null;
  category?: string | null;
  reports?: EvidenceItem[];
}

/** Lookup response mirroring backend/app/schemas.py:LookupResponse. */
export interface LookupResponse {
  verdict: Verdict;
  report_count: number;
  distinct_reporters: number;
  first_seen: string | null;
  last_seen: string | null;
  scam_type: string | null;
  display_value: string;
  challenged: boolean;
  evidence: EvidenceSummary | string[] | null;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Report channels/categories supported by the backend. */
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

/** Report payload mirroring backend ReportCreate (backward-compatible aliases). */
export interface ReportPayload {
  channel?: ReportChannel | string | null;
  identifier?: string | null;
  identifier_value?: string | null;
  identifier_type?: string | null;
  pincode?: string | null;
  locality?: string | null;
  city?: string | null;
  note?: string | null;
  scam_type?: string | null;
  occurred_at?: string | null;
  reported_at?: string | null;
  reporter_id?: string | null;
  amount_lost_inr?: number | null;
  loss_amount?: number | null;
  has_screenshot?: boolean | null;
  evidence_url?: string | null;
  evidence_base64?: string | null;
  evidence_filename?: string | null;
  transaction_ref?: string | null;
}

/** Report response mirroring backend ReportResponse. */
export interface ReportResponse {
  report_id: string;
  id?: string | null;
  case_id: string;
  merged: boolean;
  status?: string | null;
  case_status?: string | null;
  distinct_reporters?: number | null;
  display_value?: string | null;
  message?: string | null;
  evidence_duplicate_detected?: boolean;
  tx_ref_duplicate_detected?: boolean;
  similarity_risk_signals?: Record<string, unknown> | null;
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// Challenge / dispute
// ---------------------------------------------------------------------------

/** Challenge payload mirroring backend ChallengeCreate. */
export interface ChallengePayload {
  report_id?: string | null;
  identifier_type?: string | null;
  identifier_value?: string | null;
  identifier?: string | null;
  claimant_name?: string | null;
  challenger_name?: string | null;
  contact_email?: string | null;
  proof_note?: string | null;
  reason?: string | null;
  proof_url?: string | null;
}

/** Challenge response mirroring backend ChallengeResponse. */
export interface ChallengeResponse {
  challenge_id: string;
  id?: string | null;
  status: string;
  identifier?: string | null;
  message?: string | null;
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

/** One map cluster/pin returned by the backend. */
export interface MapPoint {
  pincode: string;
  locality?: string | null;
  city?: string | null;
  count: number;
  scam_type?: string | null;
  top_scam_type?: string | null;
  severity?: string | null;
  lat: number;
  lng: number;
}

export interface MapDiagnostic {
  total_reports: number;
  reports_with_valid_pincodes: number;
  reports_with_recognized_areas: number;
  reports_with_coordinates: number;
  reports_in_clusters: number;
  unmapped_reports_count: number;
  unmapped_pincodes: string[];
  exclusion_reasons: Record<string, number>;
}

export interface UnmappedAreaInfo {
  pincode: string;
  count: number;
  locality?: string | null;
  city?: string | null;
  reason: string;
}

export interface MapResponse {
  clusters: MapPoint[];
  points?: MapPoint[] | null;
  diagnostics?: MapDiagnostic | null;
  unmapped?: UnmappedAreaInfo[] | null;
}

// ---------------------------------------------------------------------------
// Health / connectivity
// ---------------------------------------------------------------------------

export interface HealthResponse {
  ok?: boolean;
  status: string;
  service?: string;
  environment?: string;
}

// ---------------------------------------------------------------------------
// License
// ---------------------------------------------------------------------------

export type LicenseStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'ACTIVE'
  | 'NOT_ACTIVATED'
  | 'INVALID'
  | string;

export interface LicenseResponse {
  status: LicenseStatus;
  active?: boolean;
  licensee?: string | null;
  expires_at: string | null;
  license_hint?: string | null;
}

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

/** Generic API error shape returned by the backend. */
export interface ApiErrorBody {
  detail?: string | unknown;
  message?: string | unknown;
  error?: string | unknown;
  code?: string | unknown;
}
