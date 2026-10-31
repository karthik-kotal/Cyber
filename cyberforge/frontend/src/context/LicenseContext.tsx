import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { activateLicense, ApiError, getLicenseStatus } from '../services/api';
import type { LicenseResponse } from '../types/api';

// ---------------------------------------------------------------------------
// License state machine (frontend display only).
// Enforcement is backend-side; the frontend never validates licenses
// cryptographically and never stores the license key.
// ---------------------------------------------------------------------------

export type LicenseUiState =
  | 'checking'      // initial status fetch in flight
  | 'valid'         // backend says valid -> app usable
  | 'expired'       // show renewal screen
  | 'not_activated' // show activation screen
  | 'invalid'       // backend rejected the license -> show renewal screen
  | 'degraded';     // could not determine (network/server error) -> warn, do not block

export interface LicenseContextValue {
  state: LicenseUiState;
  info: LicenseResponse | null;
  /** Try to activate/renew a license key. Resolves to null on success, or an
   *  ApiError the caller can display. No app restart required. */
  renew: (licenseKey: string) => Promise<ApiError | null>;
  /** Re-check with the backend. */
  recheck: () => void;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [info, setInfo] = useState<LicenseResponse | null>(null);
  const [state, setState] = useState<LicenseUiState>('checking');
  const [probe, setProbe] = useState(0); // recheck trigger

  useEffect(() => {
    const controller = new AbortController();
    setState('checking');
    getLicenseStatus({ signal: controller.signal, timeoutMs: 10_000 })
      .then((response) => {
        setInfo(response);
        setState(toUiState(response?.status));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 401 || err.status === 403) {
            // Backend says license not valid for this app.
            setState('invalid');
          } else {
            // Cannot determine -> warn but do not lock the UI.
            setState('degraded');
          }
        } else {
          setState('degraded');
        }
      });
    return () => controller.abort();
  }, [probe]);

  const renew = useCallback(async (licenseKey: string): Promise<ApiError | null> => {
    if (!licenseKey.trim()) {
      return new ApiError('VALIDATION', 'Enter your license key.');
    }
    try {
      const response = await activateLicense(licenseKey.trim(), { timeoutMs: 10_000 });
      setInfo(response);
      setState(toUiState(response?.status));
      return null;
    } catch (err) {
      if (err instanceof ApiError) return err;
      return new ApiError('UNKNOWN', 'License activation failed. Please try again.');
    }
  }, []);

  const recheck = useCallback(() => setProbe((v) => v + 1), []);

  // Periodic re-check so an expiring license is noticed without a restart.
  useEffect(() => {
    const id = window.setInterval(() => setProbe((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<LicenseContextValue>(
    () => ({ state, info, renew, recheck }),
    [state, info, renew, recheck]
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (ctx === null) {
    throw new Error('useLicense must be used inside LicenseProvider');
  }
  return ctx;
}

function toUiState(status: LicenseResponse['status'] | undefined): LicenseUiState {
  switch (status) {
    case 'VALID':
    case 'ACTIVE':
      return 'valid';
    case 'EXPIRED':
      return 'expired';
    case 'NOT_ACTIVATED':
      return 'not_activated';
    case 'INVALID':
      return 'invalid';
    default:
      // Unknown status values are treated as valid so the UI keeps working;
      // the backend remains the enforcement point.
      return 'valid';
  }
}
