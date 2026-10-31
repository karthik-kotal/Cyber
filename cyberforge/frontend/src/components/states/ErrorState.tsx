import { ApiError, type ApiErrorCode } from '../../services/api';

const FRIENDLY: Record<ApiErrorCode, string> = {
  NETWORK: 'Cannot reach the server. Check your internet connection.',
  VALIDATION: 'The details are not valid. Please check and retry.',
  LICENSE: 'Your license is not valid for this request.',
  NOT_FOUND: 'We could not find that.',
  SERVER: 'The server had a problem. Please try again later.',
  TIMEOUT: 'The request timed out. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

/**
 * Error presentation. If the backend sent a human-readable detail, show it;
 * otherwise show a fixed generic message per error class. We never invent
 * scam-related meaning here.
 */
export function ErrorState({
  error,
  onRetry,
  retryLabel,
  className = '',
}: {
  error: ApiError | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}): React.JSX.Element {
  const message = error?.code ? (FRIENDLY[error.code] ?? FRIENDLY.UNKNOWN) : FRIENDLY.UNKNOWN;
  const detail = error?.detail ?? null;

  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center ${className}`}
    >
      <span aria-hidden="true" className="text-3xl">⚠️</span>
      <p className="text-sm font-medium text-rose-900">{message}</p>
      {detail ? <p className="text-xs text-rose-700">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600"
        >
          {retryLabel ?? 'Try again'}
        </button>
      ) : null}
    </div>
  );
}
