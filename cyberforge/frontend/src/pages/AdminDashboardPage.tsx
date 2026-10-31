import { useState, useEffect, useCallback } from 'react';
import {
  getAdminDisputes,
  getAdminReports,
  decideDispute,
  getDisputeAuditLog,
  getLicenseStatus,
  compareHashes,
} from '../services/api';
import type {
  AdminDisputeItem,
  AdminReportItem,
  DisputeAuditLogItem,
  LicenseResponse,
  UserPOV,
  HashComparisonResponse,
} from '../types/api';

export function AdminDashboardPage({ pov }: { pov: UserPOV }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'disputes' | 'audit' | 'reports' | 'license' | 'hash-compare'>('disputes');

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

  // Report & Evidence inspection modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReportItem | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Hash comparison tool state
  const [hashInputA, setHashInputA] = useState('');
  const [hashInputB, setHashInputB] = useState('');
  const [hashComparisonResult, setHashComparisonResult] = useState<HashComparisonResponse | null>(null);
  const [hashCompareBusy, setHashCompareBusy] = useState(false);
  const [hashCompareError, setHashCompareError] = useState<string | null>(null);

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

  const openReportModal = (report: AdminReportItem) => {
    setSelectedReport(report);
    setDescExpanded(false);
    setCopiedHash(false);
    setReportModalOpen(true);
  };

  const handleCopyHash = (hash: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    });
  };

  const handleCompareHashesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashInputA.trim() || !hashInputB.trim()) {
      setHashCompareError('Please enter both SHA-256 hashes.');
      return;
    }
    setHashCompareBusy(true);
    setHashCompareError(null);
    setHashComparisonResult(null);
    try {
      const res = await compareHashes(hashInputA.trim(), hashInputB.trim());
      setHashComparisonResult(res);
    } catch (err: any) {
      setHashCompareError(err.detail || err.message || 'Failed to compare hashes');
    } finally {
      setHashCompareBusy(false);
    }
  };

  const startHashComparisonWith = (hash: string) => {
    setHashInputA(hash);
    setHashInputB('');
    setHashComparisonResult(null);
    setReportModalOpen(false);
    setActiveTab('hash-compare');
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
              ? 'Isolated sandbox environment • Demo actions affect only demo database and storage'
              : 'Production environment • Backed by 365-day enterprise license'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
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
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
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
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
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
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📋 Scam Reports & Evidence</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {reports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hash-compare')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'hash-compare'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>⚡ Hash Comparison Tool</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('license')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'license'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🛡️ License Status</span>
          <span className={`h-2 w-2 rounded-full ${license?.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading operations console...</div>
        ) : error ? (
          <div className="rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-700">{error}</div>
        ) : (
          <>
            {/* TAB 1: Disputes */}
            {activeTab === 'disputes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">
                    Pending Dispute Requests ({disputes.length})
                  </h2>
                  <span className="text-xs text-slate-500">
                    Adjudicating disputes recalculates anti-sybil trust score and updates verdicts immediately.
                  </span>
                </div>

                {disputes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    No active dispute requests pending administrator review.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {d.identifier}
                              </span>
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {d.identifier_type || 'Target'}
                              </span>
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                {d.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              Claimant: <span className="font-semibold text-slate-800">{d.claimant_name || 'Anonymous'}</span>{' '}
                              ({d.contact_email || 'No email provided'})
                            </p>
                            {d.report_id ? (
                              <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                                Disputed Report ID: {d.report_id}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openDecisionModal(d, 'APPROVE')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-sm"
                            >
                              ✓ Approve Dispute
                            </button>
                            <button
                              type="button"
                              onClick={() => openDecisionModal(d, 'REJECT')}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer shadow-sm"
                            >
                              ✕ Reject Dispute
                            </button>
                          </div>
                        </div>

                        {d.proof_note ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">Claimant Statement:</span> {d.proof_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Decision Audit Log */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">
                    Dispute Adjudication Audit Log ({auditLog.length})
                  </h2>
                  <span className="text-xs text-slate-500">
                    Immutable history of all dispute decisions made by administrators.
                  </span>
                </div>

                {auditLog.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    No adjudication decisions recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Decision</th>
                          <th className="py-2.5 px-3">Target Identifier</th>
                          <th className="py-2.5 px-3">Admin</th>
                          <th className="py-2.5 px-3">Official Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLog.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  log.action === 'APPROVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {log.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-800">
                              {log.identifier}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {log.decided_by}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
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

            {/* TAB 3: Reports & Evidence Review */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">
                    Scam Reports Database ({reports.length})
                  </h2>
                  <span className="text-xs text-slate-500">
                    Click any row to inspect report details, scam description, and evidence integrity analysis.
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
                          <th className="py-2.5 px-3">Evidence</th>
                          <th className="py-2.5 px-3">Loss (₹)</th>
                          <th className="py-2.5 px-3">Pincode</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.map((r) => (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50/80 cursor-pointer"
                            onClick={() => openReportModal(r)}
                          >
                            <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-800">
                              {r.id.slice(0, 8)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                              {r.identifier}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-medium text-slate-600">
                              {r.category || r.identifier_type}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-medium text-slate-800">
                              {r.scam_type}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.has_screenshot || r.evidence_metadata ? (
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                  📷 Image
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                              ₹{r.amount_lost_inr?.toLocaleString() ?? 0}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {r.pincode || '—'}
                            </td>
                            <td className="py-2.5 px-3">
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
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReportModal(r);
                                }}
                                className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Hash Comparison Tool */}
            {activeTab === 'hash-compare' && (
              <div className="space-y-5 max-w-2xl">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Cryptographic Hash Comparison Tool</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Compare two evidence SHA-256 digests to verify bit-exact cryptographic identity.
                  </p>
                </div>

                <form onSubmit={handleCompareHashesSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="hash-input-a" className="block text-xs font-bold text-slate-700 mb-1">
                      Evidence Hash A (SHA-256)
                    </label>
                    <input
                      id="hash-input-a"
                      type="text"
                      spellCheck={false}
                      value={hashInputA}
                      onChange={(e) => setHashInputA(e.target.value)}
                      placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                      className="w-full font-mono text-xs rounded-lg border border-slate-300 p-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="hash-input-b" className="block text-xs font-bold text-slate-700 mb-1">
                      Comparison Hash B (SHA-256)
                    </label>
                    <input
                      id="hash-input-b"
                      type="text"
                      spellCheck={false}
                      value={hashInputB}
                      onChange={(e) => setHashInputB(e.target.value)}
                      placeholder="e.g. 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
                      className="w-full font-mono text-xs rounded-lg border border-slate-300 p-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                    />
                  </div>

                  {hashCompareError ? (
                    <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                      {hashCompareError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={hashCompareBusy}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {hashCompareBusy ? 'Verifying Hashes...' : 'Compare SHA-256 Hashes'}
                  </button>
                </form>

                {hashComparisonResult && (
                  <div
                    className={`rounded-xl border p-4 text-xs space-y-2 ${
                      hashComparisonResult.match
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                        : 'border-amber-300 bg-amber-50 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{hashComparisonResult.match ? '✅' : '⚠️'}</span>
                      <h3 className="font-bold text-sm">{hashComparisonResult.summary}</h3>
                    </div>
                    {hashComparisonResult.explanation ? (
                      <p className="mt-1 leading-relaxed opacity-90">{hashComparisonResult.explanation}</p>
                    ) : null}
                    <div className="pt-2 font-mono text-[11px] opacity-80 space-y-1">
                      <div><b>Hash A:</b> {hashComparisonResult.hash_a}</div>
                      <div><b>Hash B:</b> {hashComparisonResult.hash_b}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: License */}
            {activeTab === 'license' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {pov === 'demo' ? '5-Minute Demonstration License' : '365-Day Enterprise License'}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {license?.active ? 'Your license is currently active and fully verified.' : 'License is inactive or expired.'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        license?.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {license?.active ? 'Active' : 'Expired'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Licensee / Organization</span>
                    <p className="font-bold text-slate-900 text-sm">{license?.licensee || 'Demo Bank'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 space-y-1">
                    <span className="text-slate-500 font-medium">Expiration Timestamp</span>
                    <p className="font-mono font-semibold text-slate-800">
                      {license?.expires_at ? new Date(license.expires_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Adjudication Modal */}
      {modalOpen && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {decisionAction === 'APPROVE' ? 'Approve Dispute' : 'Reject Dispute'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-500">Target Identifier:</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedDispute.identifier}</p>
              </div>

              <div>
                <label htmlFor="adjudication-reason" className="block font-bold text-slate-800 mb-1">
                  Official Reason & Audit Justification
                </label>
                <textarea
                  id="adjudication-reason"
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                  required
                />
              </div>

              {decisionError ? (
                <div className="rounded bg-rose-50 p-2 text-rose-700 font-medium">{decisionError}</div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionBusy}
                  className={`rounded-lg px-4 py-1.5 font-bold text-white cursor-pointer ${
                    decisionAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {decisionBusy ? 'Recording...' : `Confirm ${decisionAction}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report & Evidence Inspection Modal */}
      {reportModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Report Inspection</span>
                <h3 className="text-base font-bold text-slate-900">
                  Reference: <span className="font-mono">{selectedReport.id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Identifier</span>
                <p className="font-mono font-bold text-slate-900">{selectedReport.identifier}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Category</span>
                <p className="font-medium text-slate-800">{selectedReport.category || 'OTHER'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Scam Type</span>
                <p className="font-bold text-slate-800">{selectedReport.scam_type}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Loss Amount</span>
                <p className="font-mono font-bold text-slate-900">₹{selectedReport.amount_lost_inr?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            {/* Feature 2: Describe the Scam */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Describe the Scam (Reporter Statement)
              </h4>
              {selectedReport.description ? (
                <div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {descExpanded
                      ? selectedReport.description
                      : selectedReport.description.length > 250
                      ? `${selectedReport.description.slice(0, 250)}...`
                      : selectedReport.description}
                  </p>
                  {selectedReport.description.length > 250 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="mt-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {descExpanded ? 'Collapse statement' : 'Expand full statement'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No description was entered by the reporter.</p>
              )}
            </div>

            {/* Feature 2 & 3: Attached Evidence & Cryptographic Verification */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Attached Evidence & Integrity Analysis
                </h4>
                {selectedReport.evidence_metadata && (
                  <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                    Evidence Attached
                  </span>
                )}
              </div>

              {selectedReport.evidence_metadata ? (
                <div className="space-y-4">
                  {/* Image Preview & File Metadata */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedReport.evidence_metadata.image_url ? (
                      <div className="relative group cursor-pointer" onClick={() => setZoomedImage(selectedReport.evidence_metadata?.image_url || null)}>
                        <img
                          src={selectedReport.evidence_metadata.image_url}
                          alt="Evidence thumbnail"
                          className="h-28 w-28 rounded-lg object-cover border border-slate-300 shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/40 text-white rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition">
                          🔍 Zoom
                        </div>
                      </div>
                    ) : null}

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold">File Name:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {selectedReport.evidence_metadata.original_filename || selectedReport.evidence_metadata.filename}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold">File Size:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {selectedReport.evidence_metadata.file_size
                            ? `${(selectedReport.evidence_metadata.file_size / 1024).toFixed(1)} KB`
                            : 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold">MIME Type:</span>{' '}
                        <span className="font-mono text-slate-800">{selectedReport.evidence_metadata.mime_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* SHA-256 Digest Card */}
                  <div className="rounded-xl bg-slate-900 p-3 text-white space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Cryptographic SHA-256 Digest
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyHash(selectedReport.evidence_metadata?.file_sha256 || '')}
                          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                          {copiedHash ? '✓ Copied!' : '📋 Copy Hash'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startHashComparisonWith(selectedReport.evidence_metadata?.file_sha256 || '')}
                          className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-500 cursor-pointer"
                        >
                          ⚡ Compare in Tool
                        </button>
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-emerald-400 break-all select-all">
                      {selectedReport.evidence_metadata.file_sha256 || 'Hash not available'}
                    </p>
                  </div>

                  {/* Feature 3: Automated Integrity Checks Panel */}
                  {selectedReport.evidence_metadata.integrity_results && (
                    <div className="space-y-3 pt-2">
                      {/* Overall Summary Card */}
                      <div
                        className={`rounded-xl border p-3.5 text-xs ${
                          selectedReport.evidence_metadata.integrity_results.overall_status === 'PASS'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                            : 'border-amber-200 bg-amber-50 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs uppercase tracking-wide">
                            Overall Automated Assessment
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              selectedReport.evidence_metadata.integrity_results.overall_status === 'PASS'
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {selectedReport.evidence_metadata.integrity_results.overall_status}
                          </span>
                        </div>
                        <p className="leading-relaxed">
                          {selectedReport.evidence_metadata.integrity_results.overall_summary}
                        </p>
                        <p className="mt-1 text-[10px] italic opacity-75">
                          {selectedReport.evidence_metadata.integrity_results.disclaimer}
                        </p>
                      </div>

                      {/* 5 Distinct Checks */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Check 1: Crop Detection */}
                        {selectedReport.evidence_metadata.integrity_results.checks?.crop && (
                          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">1. Crop Detection</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  selectedReport.evidence_metadata.integrity_results.checks.crop.is_standard
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {selectedReport.evidence_metadata.integrity_results.checks.crop.status}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              {selectedReport.evidence_metadata.integrity_results.checks.crop.explanation}
                            </p>
                            <p className="text-[9px] text-slate-400 italic pt-1">
                              * {selectedReport.evidence_metadata.integrity_results.checks.crop.disclaimer}
                            </p>
                          </div>
                        )}

                        {/* Check 2: Brightness Modification */}
                        {selectedReport.evidence_metadata.integrity_results.checks?.brightness && (
                          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">2. Brightness Analysis</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                                {selectedReport.evidence_metadata.integrity_results.checks.brightness.status}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              Mean luminance: {selectedReport.evidence_metadata.integrity_results.checks.brightness.average_luminance}/255, Std Dev: {selectedReport.evidence_metadata.integrity_results.checks.brightness.std_dev}.
                            </p>
                            <p className="text-[9px] text-slate-400 italic pt-1">
                              * {selectedReport.evidence_metadata.integrity_results.checks.brightness.disclaimer}
                            </p>
                          </div>
                        )}

                        {/* Check 3: Watermark Detection */}
                        {selectedReport.evidence_metadata.integrity_results.checks?.watermark && (
                          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">3. Watermark Check</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  selectedReport.evidence_metadata.integrity_results.checks.watermark.detected
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {selectedReport.evidence_metadata.integrity_results.checks.watermark.status}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              {selectedReport.evidence_metadata.integrity_results.checks.watermark.explanation}
                            </p>
                            <p className="text-[9px] text-slate-400 italic pt-1">
                              * {selectedReport.evidence_metadata.integrity_results.checks.watermark.disclaimer}
                            </p>
                          </div>
                        )}

                        {/* Check 4: Text Character Modification (OCR) */}
                        {selectedReport.evidence_metadata.integrity_results.checks?.text && (
                          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">4. Text / OCR Check</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                                {selectedReport.evidence_metadata.integrity_results.checks.text.status}
                              </span>
                            </div>
                            {selectedReport.evidence_metadata.integrity_results.checks.text.extracted_text ? (
                              <p className="text-slate-600 text-[11px] truncate">
                                Extracted: &quot;{selectedReport.evidence_metadata.integrity_results.checks.text.extracted_text}&quot;
                              </p>
                            ) : (
                              <p className="text-slate-500 text-[11px]">No readable text extracted.</p>
                            )}
                            <p className="text-[9px] text-slate-400 italic pt-1">
                              * {selectedReport.evidence_metadata.integrity_results.checks.text.disclaimer}
                            </p>
                          </div>
                        )}

                        {/* Check 5: Image Format & EXIF */}
                        {selectedReport.evidence_metadata.integrity_results.checks?.format && (
                          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1 sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">5. Format Conversion & EXIF Software</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  selectedReport.evidence_metadata.integrity_results.checks.format.format_matches
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {selectedReport.evidence_metadata.integrity_results.checks.format.format_status}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              Software finding: <b>{selectedReport.evidence_metadata.integrity_results.checks.format.software_tag}</b>
                            </p>
                            <p className="text-[9px] text-slate-400 italic pt-1">
                              * {selectedReport.evidence_metadata.integrity_results.checks.format.metadata_note}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center text-xs text-slate-500">
                  No image evidence was attached to this report.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh]">
            <img src={zoomedImage} alt="Full size evidence" className="rounded-xl max-h-[85vh] object-contain shadow-2xl" />
            <p className="text-center text-xs text-white/70 mt-2">Click anywhere to close full preview</p>
          </div>
        </div>
      )}
    </div>
  );
}
