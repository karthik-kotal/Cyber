import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdminDisputes,
  getAdminReports,
  decideDispute,
  challengeReport,
  getDisputeAuditLog,
  getLicenseStatus,
} from '../services/api';
import {
  getVerifiedBusinessDetails,
  isVerifiedEntity,
} from '../constants/verifiedBusinesses';
import type {
  AdminDisputeItem,
  AdminReportItem,
  DisputeAuditLogItem,
  LicenseResponse,
  UserPOV,
} from '../types/api';

export function AdminDashboardPage({ pov }: { pov: UserPOV }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'disputes' | 'audit' | 'reports' | 'investigation' | 'license'>('disputes');

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
  const [decisionSuccessMsg, setDecisionSuccessMsg] = useState<string | null>(null);
  const [disputeFilter, setDisputeFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // File test dispute state
  const [createDisputeModalOpen, setCreateDisputeModalOpen] = useState(false);
  const [testDisputeReportId, setTestDisputeReportId] = useState('');
  const [testDisputeClaimant, setTestDisputeClaimant] = useState('Subscriber Legal Appeal');
  const [testDisputeReason, setTestDisputeReason] = useState('I am the legitimate holder of this line and disputing this defamatory report.');
  const [createDisputeBusy, setCreateDisputeBusy] = useState(false);
  const [createDisputeError, setCreateDisputeError] = useState<string | null>(null);

  // Report & Evidence inspection modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReportItem | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

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

  const pendingDisputes = useMemo(
    () => disputes.filter((d) => d.status === 'under_review' || d.status === 'ACTIVE' || d.status === 'pending'),
    [disputes]
  );
  const resolvedDisputes = useMemo(
    () => disputes.filter((d) => d.status.startsWith('resolved_') || d.status === 'REJECTED' || d.status === 'APPROVED'),
    [disputes]
  );
  const displayedDisputes = useMemo(() => {
    if (disputeFilter === 'pending') return pendingDisputes;
    if (disputeFilter === 'resolved') return resolvedDisputes;
    return disputes;
  }, [disputeFilter, pendingDisputes, resolvedDisputes, disputes]);

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    setDecisionBusy(true);
    setDecisionError(null);
    try {
      const res = await decideDispute(selectedDispute.id, {
        action: decisionAction,
        reason: decisionReason,
      });
      setModalOpen(false);
      setDecisionSuccessMsg(
        `Dispute for ${selectedDispute.identifier} was successfully ${decisionAction === 'APPROVE' ? 'APPROVED (Upheld)' : 'REJECTED (Dismissed)'}. Target report status is now ${res.new_report_status} and case trust was recalculated.`
      );
      await loadData();
    } catch (err: any) {
      setDecisionError(err.detail || err.message || 'Failed to record dispute decision');
    } finally {
      setDecisionBusy(false);
    }
  };

  const handleCreateTestDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDisputeReportId.trim()) return;
    setCreateDisputeBusy(true);
    setCreateDisputeError(null);
    try {
      await challengeReport(testDisputeReportId.trim(), {
        claimant_name: testDisputeClaimant.trim() || 'Anonymous Claimant',
        proof_note: testDisputeReason.trim() || 'Disputing inaccurate report',
        contact_email: 'claimant@example.com',
      });
      setCreateDisputeModalOpen(false);
      setDecisionSuccessMsg(`New dispute successfully registered for report ${testDisputeReportId.slice(0, 8)}. Ready for review.`);
      setDisputeFilter('pending');
      await loadData();
    } catch (err: any) {
      setCreateDisputeError(err.detail || err.message || 'Failed to file dispute');
    } finally {
      setCreateDisputeBusy(false);
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

  const entityInvestigations = useMemo(() => {
    const groups: Record<string, AdminReportItem[]> = {};
    for (const r of reports) {
      const key = r.identifier.trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    return Object.entries(groups).map(([ident, repList]) => {
      const totalReports = repList.length;
      const verifiedInfo = getVerifiedBusinessDetails(ident);
      const isVerified = Boolean(verifiedInfo);
      const sortedByTime = [...repList].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
      const firstSeen = sortedByTime[0]?.occurred_at || '—';
      const lastSeen = sortedByTime[sortedByTime.length - 1]?.occurred_at || '—';

      const noteCounts: Record<string, number> = {};
      let repeatDescCount = 0;
      for (const r of repList) {
        const text = (r.description || r.note || '').trim().toLowerCase();
        if (text) {
          noteCounts[text] = (noteCounts[text] || 0) + 1;
          if (noteCounts[text] > 1) repeatDescCount++;
        }
      }

      const shaCounts: Record<string, number> = {};
      let dupImagesCount = 0;
      for (const r of repList) {
        const sha = r.file_sha256 || r.evidence_metadata?.file_sha256;
        if (sha) {
          shaCounts[sha] = (shaCounts[sha] || 0) + 1;
          if (shaCounts[sha] > 1) dupImagesCount++;
        }
      }

      const firstMs = new Date(firstSeen).getTime();
      const lastMs = new Date(lastSeen).getTime();
      const timeSpanSec = !isNaN(firstMs) && !isNaN(lastMs) ? Math.max(0, (lastMs - firstMs) / 1000) : 0;
      const burstDetected = totalReports >= 5 && timeSpanSec <= 300;

      const evidencePoints: string[] = [];
      if (isVerified) {
        evidencePoints.push(`Official Appendix C verified entity: ${verifiedInfo?.belongs_to} (${verifiedInfo?.category}).`);
        evidencePoints.push('100% immune to crowdsourced defamatory flagging, review-bombing, or extortion.');
        if (totalReports > 0) {
          evidencePoints.push(`${totalReports} crowd report(s) targeting this verified entity — all safely quarantined without degrading trust standing.`);
        }
        if (repeatDescCount > 0) {
          evidencePoints.push(`Coordinated reporting detected: ${repeatDescCount} reports share duplicate descriptions (attempted brigading quarantined).`);
        }
        if (burstDetected) {
          evidencePoints.push(`Unusual submission burst: ${totalReports} reports within ${Math.round(timeSpanSec)}s window (quarantined).`);
        }
      } else {
        if (repeatDescCount > 0) {
          evidencePoints.push(`${repeatDescCount} reports share duplicate or copy-pasted scam description text.`);
        }
        if (dupImagesCount > 0) {
          evidencePoints.push(`${dupImagesCount} reports present duplicate screenshot SHA-256 evidence.`);
        }
        if (burstDetected) {
          evidencePoints.push(`Unusual burst rate: ${totalReports} reports submitted within ${Math.round(timeSpanSec)}s window.`);
        }
      }

      let coordinationRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (isVerified) {
        // Verified entities have ZERO fraud risk. Any crowd mass-reporting is an attempted defamatory sybil wave.
        coordinationRisk = 'LOW';
      } else if (repeatDescCount >= 3 || dupImagesCount >= 2 || burstDetected) {
        coordinationRisk = 'HIGH';
      } else if (repeatDescCount > 0 || dupImagesCount > 0 || totalReports >= 10) {
        coordinationRisk = 'MEDIUM';
      }

      let distinctReporters = totalReports;
      if (isVerified) {
        distinctReporters = 0; // Immune to community crowd count
      } else if (repeatDescCount > 0 || dupImagesCount > 0 || burstDetected) {
        distinctReporters = Math.max(1, Math.round(totalReports / (repeatDescCount + 2)));
      }

      let verdict: 'VERIFIED_BUSINESS' | 'KNOWN_SCAM' | 'SUSPICIOUS' = 'SUSPICIOUS';
      if (isVerified) {
        verdict = 'VERIFIED_BUSINESS';
      } else if (distinctReporters >= 3) {
        verdict = 'KNOWN_SCAM';
      } else {
        verdict = 'SUSPICIOUS';
      }

      return {
        identifier: ident,
        isVerified,
        verifiedInfo,
        businessName: verifiedInfo ? verifiedInfo.belongs_to : null,
        category: verifiedInfo ? verifiedInfo.category : (repList[0]?.category || repList[0]?.identifier_type || 'PHONE'),
        totalReports,
        distinctReporters,
        firstSeen,
        lastSeen,
        timeSpanSec: Math.round(timeSpanSec),
        repeatDescCount,
        dupImagesCount,
        burstDetected,
        coordinationRisk,
        verdict,
        confidence: isVerified ? 'Certified High (Official Appendix C Registry)' : distinctReporters >= 3 ? 'High (>3 independent clusters)' : 'Moderate (<3 independent clusters)',
        limitations: isVerified
          ? 'Verified businesses are immune to crowdsourced scam status, protecting legitimate commerce against coordinated defamation.'
          : 'Shared networks or duplicate phrases indicate high coordination risk, but do not definitively prove common operator control. Human dispute appeal preserved.',
        evidencePoints,
        sampleReports: repList.slice(0, 5),
      };
    });
  }, [reports]);

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
          onClick={() => setActiveTab('investigation')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'investigation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🔍 Sybil & Mass Report Investigation</span>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            {entityInvestigations.length}
          </span>
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Dispute Adjudication Console ({disputes.length})
                    </h2>
                    <span className="text-xs text-slate-500">
                      Adjudicating disputes updates report status, recalculates trust score, and records an immutable audit log.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTestDisputeReportId(reports[0]?.id || '');
                        setCreateDisputeModalOpen(true);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-sm transition"
                    >
                      + File Test Dispute
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-500">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setDisputeFilter('all')}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      disputeFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({disputes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisputeFilter('pending')}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      disputeFilter === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Pending Review ({pendingDisputes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisputeFilter('resolved')}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      disputeFilter === 'resolved'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Resolved ({resolvedDisputes.length})
                  </button>
                </div>

                {/* Success feedback alert */}
                {decisionSuccessMsg && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 text-xs text-emerald-950 flex items-start justify-between gap-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-base text-emerald-700 font-bold">✓</span>
                      <span className="leading-relaxed font-medium">{decisionSuccessMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDecisionSuccessMsg(null)}
                      className="text-emerald-700 hover:text-emerald-950 font-bold text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {displayedDisputes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    No disputes match current filter &quot;{disputeFilter}&quot;.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedDisputes.map((d) => {
                      const isPending = d.status === 'under_review' || d.status === 'ACTIVE' || d.status === 'pending';
                      const isApproved = d.status === 'resolved_approved' || d.status === 'APPROVED';
                      // isRejected d.status === 'resolved_rejected' || d.status === 'REJECTED';
                      const verified = isVerifiedEntity(d.identifier);

                      return (
                        <div
                          key={d.id}
                          className={`rounded-xl border p-4 transition ${
                            isPending
                              ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                              : isApproved
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="space-y-1 min-w-[260px] flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-900 break-words [overflow-wrap:anywhere]">
                                  {d.identifier}
                                </span>
                                {verified && (
                                  <span className="rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 whitespace-nowrap">
                                    🏢 Verified Entity
                                  </span>
                                )}
                                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                                  {d.identifier_type || 'Target'}
                                </span>
                                {isPending ? (
                                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                    ⏳ Action Required (Under Review)
                                  </span>
                                ) : isApproved ? (
                                  <span className="rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                                    ✓ Upheld & Approved
                                  </span>
                                ) : (
                                  <span className="rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                                    ✕ Dismissed & Rejected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600">
                                Claimant: <span className="font-semibold text-slate-800">{d.claimant_name || 'Anonymous'}</span>{' '}
                                ({d.contact_email || 'No email provided'})
                              </p>
                              {d.report_id ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[11px] text-slate-500">
                                    Disputed Report ID: {d.report_id}
                                  </span>
                                  {reports.some((r) => r.id === d.report_id) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rep = reports.find((r) => r.id === d.report_id);
                                        if (rep) openReportModal(rep);
                                      }}
                                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                    >
                                      Inspect Report
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openDecisionModal(d, 'APPROVE')}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-sm transition"
                                  >
                                    ✓ Approve Dispute
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDecisionModal(d, 'REJECT')}
                                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer shadow-sm transition"
                                  >
                                    ✕ Reject Dispute
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-slate-500">Adjudicated</span>
                                  <button
                                    type="button"
                                    onClick={() => openDecisionModal(d, isApproved ? 'REJECT' : 'APPROVE')}
                                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition shadow-2xs"
                                  >
                                    Re-adjudicate
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {d.proof_note ? (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                              <span className="font-semibold text-slate-900">Claimant Statement:</span> {d.proof_note}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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
                        {reports.map((r) => {
                          const verified = isVerifiedEntity(r.identifier);
                          return (
                            <tr
                              key={r.id}
                              className="hover:bg-slate-50/80 cursor-pointer"
                              onClick={() => openReportModal(r)}
                            >
                              <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-800">
                                {r.id.slice(0, 8)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="break-all">{r.identifier}</span>
                                  {verified && (
                                    <span className="rounded bg-emerald-100 border border-emerald-300 px-1 py-0.2 text-[9px] font-bold text-emerald-800">
                                      🏢 Verified
                                    </span>
                                  )}
                                </div>
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
                                      : r.status === 'RESOLVED_DISPUTED'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTestDisputeReportId(r.id);
                                      setCreateDisputeModalOpen(true);
                                    }}
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    title="File dispute for this report"
                                  >
                                    ⚖️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Investigation & Anti-Sybil Panel */}
            {activeTab === 'investigation' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Multi-Signal Sybil Clustering & Forensic Investigation ({entityInvestigations.length} Entities)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Analyzes coordinated mob reporting, identical descriptions, duplicate image hashes, burst timing, and verified business protections.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Reports Analyzed: {reports.length}
                    </span>
                  </div>
                </div>

                {entityInvestigations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    No reported entities available for cluster analysis.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {entityInvestigations.map((entity) => (
                      <div
                        key={entity.identifier}
                        className={`rounded-xl border bg-white p-5 shadow-sm space-y-4 transition ${
                          entity.isVerified ? 'border-emerald-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Entity Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="space-y-1 min-w-[260px] flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-slate-900 break-words [overflow-wrap:anywhere]">
                                {entity.identifier}
                              </span>
                              {entity.businessName && (
                                <span className="rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-xs font-bold text-emerald-800 whitespace-nowrap">
                                  🏢 {entity.businessName}
                                </span>
                              )}
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                                {entity.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Timeline: {entity.firstSeen} → {entity.lastSeen} ({entity.timeSpanSec}s window)
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                entity.isVerified || entity.verdict === 'VERIFIED_BUSINESS'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : entity.verdict === 'KNOWN_SCAM'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              Verdict: {entity.verdict}
                            </span>

                            {entity.isVerified ? (
                              <span className="rounded-full bg-blue-100 border border-blue-300 px-2.5 py-1 text-xs font-bold text-blue-900">
                                Fraud Risk: ZERO (Protected Registry)
                              </span>
                            ) : (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  entity.coordinationRisk === 'HIGH'
                                    ? 'bg-rose-600 text-white'
                                    : entity.coordinationRisk === 'MEDIUM'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                Risk: {entity.coordinationRisk}
                              </span>
                            )}

                            {entity.isVerified && (entity.repeatDescCount > 0 || entity.burstDetected) && (
                              <span className="rounded-full bg-purple-100 border border-purple-300 px-2.5 py-1 text-xs font-bold text-purple-900">
                                🛡️ Defamatory Sybil Quarantined
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Verified Business Non-Repudiation Protection Card */}
                        {entity.isVerified && (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                              <span className="text-base">🛡️</span>
                              <span>Official Verified Business Protection Active (Appendix C Certified)</span>
                            </div>
                            <p className="text-xs text-emerald-800 leading-relaxed">
                              <b>{entity.verifiedInfo?.belongs_to || entity.businessName}</b> is certified in the official anti-sybil registry. In accordance with trust-engine non-repudiation guarantees, crowdsourced reporting volume against certified businesses is automatically isolated and does not trigger scam flags, ensuring legitimate merchants and public helplines cannot be sabotaged by coordinated defamation waves or extortion.
                            </p>
                          </div>
                        )}

                        {/* Metric Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Reports</span>
                            <p className="text-base font-bold text-slate-900 mt-0.5">{entity.totalReports}</p>
                          </div>
                          <div className="rounded-lg bg-indigo-50 p-2.5 border border-indigo-100">
                            <span className="text-[10px] font-semibold text-indigo-600 uppercase">Independent Sources</span>
                            <p className="text-base font-bold text-indigo-950 mt-0.5">{entity.distinctReporters}</p>
                            <span className="text-[9px] text-indigo-500">
                              {entity.isVerified ? '(Immune to mob reports)' : '(Post-Sybil Collapse)'}
                            </span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Duplicate Descriptions</span>
                            <p className="text-base font-bold text-slate-900 mt-0.5">{entity.repeatDescCount}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Duplicate Images</span>
                            <p className="text-base font-bold text-slate-900 mt-0.5">{entity.dupImagesCount}</p>
                          </div>
                        </div>

                        {/* Evidence Findings */}
                        {entity.evidencePoints.length > 0 && (
                          <div
                            className={`rounded-lg border p-3 space-y-1 ${
                              entity.isVerified
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-amber-50/70 border-amber-200'
                            }`}
                          >
                            <h4
                              className={`text-[11px] font-bold ${
                                entity.isVerified ? 'text-blue-900' : 'text-amber-900'
                              }`}
                            >
                              {entity.isVerified
                                ? '🛡️ Verified Entity Protection & Sybil Isolation Findings:'
                                : '⚠️ Coordination & Sybil Indicators:'}
                            </h4>
                            <ul
                              className={`list-disc list-inside text-xs space-y-0.5 ${
                                entity.isVerified ? 'text-blue-800' : 'text-amber-800'
                              }`}
                            >
                              {entity.evidencePoints.map((point, idx) => (
                                <li key={idx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Context & Limitations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700">Algorithm Confidence:</span>
                            <p className="text-slate-600 mt-0.5">{entity.confidence}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Honest Limitations & Fair Process:</span>
                            <p className="text-slate-600 mt-0.5">{entity.limitations}</p>
                          </div>
                        </div>

                        {/* Sample Reports Table */}
                        <div className="space-y-1">
                          <h4 className="text-[11px] font-bold text-slate-700">Sample Reports Associated:</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold text-slate-500">
                                  <th className="py-1.5 px-2">Ref ID</th>
                                  <th className="py-1.5 px-2">Occurred At</th>
                                  <th className="py-1.5 px-2">Scam Type</th>
                                  <th className="py-1.5 px-2">Description Snippet</th>
                                  <th className="py-1.5 px-2">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                {entity.sampleReports.map((r) => (
                                  <tr key={r.id} className="hover:bg-slate-50/60">
                                    <td className="py-1.5 px-2 font-mono font-bold text-slate-800">{r.id.slice(0, 8)}</td>
                                    <td className="py-1.5 px-2 text-slate-600">{r.occurred_at}</td>
                                    <td className="py-1.5 px-2 font-medium text-slate-800">{r.scam_type}</td>
                                    <td className="py-1.5 px-2 text-slate-600 truncate max-w-xs">{r.description || r.note || '—'}</td>
                                    <td className="py-1.5 px-2">
                                      <button
                                        type="button"
                                        onClick={() => openReportModal(r)}
                                        className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                      >
                                        Inspect
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}</div>
                )}
              </div>
            )}

            {/* License Tab */}
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
                <p className="font-mono font-bold text-slate-900 mt-0.5 break-all">{selectedDispute.identifier}</p>
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

            {/* Verified Business Protection Banner */}
            {isVerifiedEntity(selectedReport.identifier) && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 flex items-start gap-2.5 text-xs text-emerald-950">
                <span className="text-xl">🛡️</span>
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    <span>Official Appendix C Verified Entity Protected:</span>
                    <span className="rounded bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                      {getVerifiedBusinessDetails(selectedReport.identifier)?.belongs_to}
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                      {getVerifiedBusinessDetails(selectedReport.identifier)?.category}
                    </span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    This report targets an officially registered entity. Under anti-sybil non-repudiation rules, crowdsourced reports against verified organizations are quarantined and do not affect business trust score or create scam flags.
                  </p>
                </div>
              </div>
            )}

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

      {/* File Test Dispute Modal */}
      {createDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                File Dispute Appeal (Admin / Merchant POV)
              </h3>
              <button
                type="button"
                onClick={() => setCreateDisputeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Submit a formal dispute challenge against an existing report. Once submitted, the dispute will appear in the Pending queue for administrator adjudication.
            </p>

            <form onSubmit={handleCreateTestDispute} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="test-dispute-report" className="block font-bold text-slate-800 mb-1">
                  Target Report ID
                </label>
                <select
                  id="test-dispute-report"
                  value={testDisputeReportId}
                  onChange={(e) => setTestDisputeReportId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                  required
                >
                  <option value="">-- Select a report to dispute --</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id.slice(0, 8)}... — {r.identifier} ({r.scam_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="test-dispute-claimant" className="block font-bold text-slate-800 mb-1">
                  Claimant Name / Organization
                </label>
                <input
                  id="test-dispute-claimant"
                  type="text"
                  value={testDisputeClaimant}
                  onChange={(e) => setTestDisputeClaimant(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                  placeholder="e.g. Registered Subscriber / Business Owner"
                  required
                />
              </div>

              <div>
                <label htmlFor="test-dispute-reason" className="block font-bold text-slate-800 mb-1">
                  Claimant Statement & Grounds for Appeal
                </label>
                <textarea
                  id="test-dispute-reason"
                  rows={3}
                  value={testDisputeReason}
                  onChange={(e) => setTestDisputeReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
                  placeholder="Explain why this report is inaccurate, malicious, or defamatory..."
                  required
                />
              </div>

              {createDisputeError ? (
                <div className="rounded bg-rose-50 p-2 text-rose-700 font-medium">{createDisputeError}</div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateDisputeModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDisputeBusy || !testDisputeReportId}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-1.5 font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  {createDisputeBusy ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
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
