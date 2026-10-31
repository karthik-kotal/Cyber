import { useState, useEffect, useCallback } from 'react';
import {
  getAdminDisputes,
  getAdminReports,
  decideDispute,
  getDisputeAuditLog,
  getLicenseStatus,
} from '../services/api';
import type {
  AdminDisputeItem,
  AdminReportItem,
  DisputeAuditLogItem,
  LicenseResponse,
  UserPOV,
} from '../types/api';

export function AdminDashboardPage({ pov }: { pov: UserPOV }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'disputes' | 'audit' | 'reports' | 'license'>('disputes');

  // Data states
  const [disputes, setDisputes] = useState<AdminDisputeItem[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [auditLog, setAuditLog] = useState<DisputeAuditLogItem[]>([]);
  const [license, setLicense] = useState<LicenseResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adjudication modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [disputesRes, reportsRes, auditRes, licenseRes] = await Promise.all([
        getAdminDisputes().catch(() => []),
        getAdminReports().catch(() => []),
        getDisputeAuditLog().catch(() => []),
        getLicenseStatus().catch(() => null),
      ]);
      setDisputes(disputesRes);
      setReports(reportsRes);
      setAuditLog(auditRes);
      setLicense(licenseRes);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load administrator data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDecisionModal = (dispute: AdminDisputeItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedDispute(dispute);
    setDecisionAction(action);
    setDecisionReason(
      action === 'APPROVE'
        ? 'Verified authentic business credentials and authorized phone documentation.'
        : 'Insufficient evidence or contradictory call records provided.'
    );
    setDecisionError(null);
    setModalOpen(true);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    setDecisionBusy(true);
    setDecisionError(null);
    try {
      await decideDispute(selectedDispute.id, {
        action: decisionAction,
        reason: decisionReason,
      });
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setDecisionError(err.detail || err.message || 'Failed to record dispute decision');
    } finally {
      setDecisionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{pov === 'demo' ? '⏱️' : '🛡️'}</span>
            <h1 className="text-lg font-bold">
              {pov === 'demo' ? 'Demo Administrator Console' : 'Administrator Operations Dashboard'}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {pov === 'demo'
              ? 'Isolated sandbox environment • Demo dispute actions affect only demo records'
              : 'Production environment • Backed by 365-day enterprise license'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            ↻ Refresh Data
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('disputes')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'disputes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>⚖️ Dispute Adjudication</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {disputes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📜 Decision Audit Log</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {auditLog.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📋 Scam Reports</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {reports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('license')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'license'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🛡️ License Status</span>
          <span className={`h-2 w-2 rounded-full ${license?.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading administrator records...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-700">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-4">
          {/* TAB 1: Disputes */}
          {activeTab === 'disputes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Citizen Dispute Requests
                </h2>
                <span className="text-xs text-slate-500">
                  Adjudicating disputes recalculates anti-sybil trust score and updates verdicts immediately.
                </span>
              </div>

              {disputes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  No dispute requests currently registered.
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              Dispute #{d.id.slice(0, 8)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                d.status === 'under_review'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : d.status === 'resolved_approved'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {d.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Target Report ID: <span className="font-mono font-medium text-slate-700">{d.report_id}</span>
                            {' • '}Target Identifier: <span className="font-mono font-medium text-slate-700">{d.identifier}</span>
                          </p>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          {new Date(d.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500">Claimant:</span>{' '}
                          <span className="text-slate-800">{d.claimant_name || 'Anonymous citizen'}</span>
                          {d.contact_email ? ` (${d.contact_email})` : ''}
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500">Proof/Justification:</span>{' '}
                          <span className="italic text-slate-700">"{d.proof_note || 'No note attached'}"</span>
                        </div>
                      </div>

                      {/* Action buttons if under review */}
                      {d.status === 'under_review' && (
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
                          <button
                            type="button"
                            onClick={() => openDecisionModal(d, 'APPROVE')}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                          >
                            ✓ Approve Dispute (Uphold)
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecisionModal(d, 'REJECT')}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow-sm"
                          >
                            ✕ Reject Dispute (Dismiss)
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Audit Log */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Official Dispute Decision Audit Trail
                </h2>
                <span className="text-xs text-slate-500">
                  Immutable record of administrator actions with timestamps and justifications.
                </span>
              </div>

              {auditLog.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  No dispute decisions recorded in audit history yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Decision</th>
                        <th className="py-2.5 px-3">Report ID</th>
                        <th className="py-2.5 px-3">Identifier</th>
                        <th className="py-2.5 px-3">Decided By</th>
                        <th className="py-2.5 px-3">Documented Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLog.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                log.action === 'APPROVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                            {log.report_id}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                            {log.identifier}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-semibold text-[11px]">
                            {log.decided_by}
                          </td>
                          <td className="py-2 px-3 text-slate-800 italic">
                            {log.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Reports */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Scam Reports Database ({reports.length})
                </h2>
                <span className="text-xs text-slate-500">
                  Sensitive reporter phone and precise coordinates remain masked.
                </span>
              </div>

              {reports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  No reports in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3">Ref ID</th>
                        <th className="py-2.5 px-3">Identifier</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Scam Type</th>
                        <th className="py-2.5 px-3">Loss (₹)</th>
                        <th className="py-2.5 px-3">Pincode</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Disputed?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reports.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-800">
                            {r.id.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                            {r.identifier}
                          </td>
                          <td className="py-2 px-3 text-[11px] font-medium text-slate-600">
                            {r.category || r.identifier_type}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-700">
                            {r.scam_type}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                            ₹{r.amount_lost_inr?.toLocaleString() ?? 0}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {r.pincode || '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                r.status === 'ACCEPTED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {r.is_disputed ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: License */}
          {activeTab === 'license' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {pov === 'demo' ? 'Demo Sandbox License (5-Minute)' : 'Enterprise Administrator License'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Licensee: <span className="font-semibold text-slate-800">{license?.licensee || 'Demo Bank'}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      license?.active
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {license?.active ? 'ACTIVE & VALID' : 'EXPIRED'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-blue-200/60 pt-3">
                  <div>
                    <span className="text-slate-500">Expiration Timestamp:</span>
                    <p className="font-mono font-medium text-slate-800">{license?.expires_at || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Remaining Time:</span>
                    <p className="font-mono font-medium text-slate-800">
                      {license?.remaining_seconds
                        ? `${Math.floor(license.remaining_seconds / 60)}m ${license.remaining_seconds % 60}s`
                        : license?.active
                          ? '365 days'
                          : 'Expired'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold text-slate-800 mb-1">License Security Policy</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pov === 'demo'
                    ? 'The judging sandbox is strictly constrained to a 5-minute evaluation period. When expired, the system locks and can be renewed by entering the master renewal key Gandadagudi.'
                    : 'The production environment operates under a 365-day enterprise license validated cryptographically by the backend.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjudication Modal */}
      {modalOpen && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              {decisionAction === 'APPROVE' ? 'Approve Dispute Request' : 'Reject Dispute Request'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Target Report ID: <span className="font-mono font-bold text-slate-800">{selectedDispute.report_id}</span>
              {' • '}Target: <span className="font-mono font-bold text-slate-800">{selectedDispute.identifier}</span>
            </p>

            {decisionError ? (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                {decisionError}
              </div>
            ) : null}

            <form onSubmit={handleDecisionSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Documented Decision Justification (Required for Audit Trail)
                </label>
                <textarea
                  rows={3}
                  required
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionBusy}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-50 ${
                    decisionAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {decisionBusy ? 'Recording...' : `Confirm ${decisionAction}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
