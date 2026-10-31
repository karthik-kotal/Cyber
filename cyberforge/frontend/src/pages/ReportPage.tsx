import { useCallback, useState } from 'react';
import { get, type Lang } from '../i18n/strings';
import { REPORT_CHANNELS, type ReportChannel } from '../types/api';
import { submitReport, ApiError } from '../services/api';
import { ErrorState } from '../components/states/ErrorState';

export function ReportPage({ lang }: { lang: Lang }): React.JSX.Element {
  const [channel, setChannel] = useState<ReportChannel>('UPI');
  const [identifier, setIdentifier] = useState('');
  const [pincode, setPincode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitted, setSubmitted] = useState<{
    id: string;
    display_value: string;
    report_id?: string;
    case_id?: string;
  } | null>(null);

  const channelLabel = (c: ReportChannel): string => {
    const map: Record<ReportChannel, string> = {
      UPI: 'UPI ID',
      PHONE: 'Phone number',
      SMS: 'SMS',
      WHATSAPP: 'WhatsApp',
      EMAIL: 'Email',
      WEBSITE: 'Website / link',
      BANK_ACCOUNT: 'Bank account',
      OTHER: 'Other',
    };
    return map[c];
  };

  const channelPlaceholder = (c: ReportChannel): string => {
    const map: Record<ReportChannel, string> = {
      UPI: 'e.g. username@okhdfcbank or 9876543210@paytm',
      PHONE: 'e.g. 9876543210 or +91 98765 43210',
      SMS: 'e.g. VM-HDFCBK or 9876543210',
      WHATSAPP: 'e.g. 9876543210 or https://wa.me/919876543210',
      EMAIL: 'e.g. support@fraud-domain.com',
      WEBSITE: 'e.g. https://scam-verification.com/login',
      BANK_ACCOUNT: 'e.g. 1234567890 or SBIN0001234:1234567890',
      OTHER: 'e.g. Identifier value',
    };
    return map[c];
  };

  const channelHelper = (c: ReportChannel): string | null => {
    if (c === 'BANK_ACCOUNT') {
      return 'Enter 9-18 digit account number (optionally prefixed by IFSC code). Do not include +91.';
    }
    if (c === 'WHATSAPP') {
      return 'Enter WhatsApp phone number or wa.me / api.whatsapp.com link.';
    }
    if (c === 'WEBSITE') {
      return 'Tracking parameters (like utm_*) are cleaned automatically before saving.';
    }
    return null;
  };

  const channelToType: Record<ReportChannel, string> = {
    BANK_ACCOUNT: 'bank_account',
    WHATSAPP: 'whatsapp',
    UPI: 'upi',
    WEBSITE: 'url',
    EMAIL: 'email',
    SMS: 'sms',
    PHONE: 'phone',
    OTHER: 'other',
  };

  const channelToScamType: Record<ReportChannel, string> = {
    BANK_ACCOUNT: 'bank-fraud',
    WHATSAPP: 'whatsapp-scam',
    UPI: 'upi-refund-qr',
    WEBSITE: 'fake-kyc-link',
    EMAIL: 'phishing',
    SMS: 'sms-fraud',
    PHONE: 'phone-scam',
    OTHER: 'other',
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);
      setSubmitted(null);
      if (!identifier.trim()) {
        setError(new ApiError('VALIDATION', get(lang, 'reportInvalid')));
        return;
      }
      const p = pincode.trim();
      const payload = {
        channel,
        category: channel,
        identifier_type: channelToType[channel],
        scam_type: channelToScamType[channel],
        identifier: identifier.trim(),
        pincode: p.length > 0 ? p : null,
      };
      setBusy(true);
      try {
        const res = await submitReport(payload);
        // Only show submitted once the backend confirms success (201).
        const resolvedId = res.report_id || res.id || '';
        const resolvedDisplay = res.display_value || res.case_id || identifier.trim();
        setSubmitted({
          id: resolvedId,
          display_value: resolvedDisplay,
          report_id: res.report_id || res.id || '',
          case_id: res.case_id || res.display_value || '',
        });
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('UNKNOWN', 'Report could not be submitted. Please try again.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [channel, identifier, pincode, lang],
  );

  if (submitted) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <span aria-hidden="true" className="text-4xl">✅</span>
        <h2 className="mt-2 text-lg font-bold text-emerald-900">{get(lang, 'reportOk')}</h2>
        <p className="mt-1 text-sm font-semibold text-emerald-700">{submitted.display_value}</p>
        {submitted.report_id ? (
          <p className="mt-1 text-xs text-emerald-600">Reference ID: {submitted.report_id}</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setSubmitted(null);
            setIdentifier('');
            setPincode('');
            setError(null);
          }}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          {get(lang, 'tryAgain')}
        </button>
      </section>
    );
  }

  const helperText = channelHelper(channel);

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-900">{get(lang, 'chooseChannel')}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REPORT_CHANNELS.map((c) => {
            const isSelected = channel === c;
            return (
              <label
                key={c}
                className={`rounded-lg border p-2.5 text-center text-sm font-medium transition cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="channel"
                  value={c}
                  checked={isSelected}
                  onChange={(e) => setChannel(e.target.value as ReportChannel)}
                  className="sr-only"
                  aria-label={channelLabel(c)}
                />
                {channelLabel(c)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="report-identifier" className="mb-2 block text-sm font-semibold text-slate-900">
          {channelLabel(channel)} {get(lang, 'identifierLabel')}
        </label>
        <input
          id="report-identifier"
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={channelPlaceholder(channel)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          required
          aria-required="true"
        />
        {helperText ? (
          <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="report-pincode"
          name="pincode"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          className="w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          placeholder="Pincode (optional)"
        />
        <label htmlFor="report-pincode" className="text-xs text-slate-500">
          {get(lang, 'pincodeLabel')}
        </label>
      </div>
      <p className="text-xs text-slate-500">
        No GPS, no address, no name. The backend normalizes and masks the identifier.
      </p>

      {error ? (
        <ErrorState error={error} onRetry={() => setError(null)} retryLabel={get(lang, 'tryAgain')} />
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
      >
        {busy ? get(lang, 'submitting') : get(lang, 'submitReport')}
      </button>
    </form>
  );
}
