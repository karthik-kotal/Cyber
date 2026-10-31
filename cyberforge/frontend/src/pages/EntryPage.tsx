import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, resetDemoLicense } from '../services/api';
import type { UserPOV } from '../types/api';

export interface EntryPageProps {
  onSelectPOV: (pov: UserPOV) => void;
}

export function EntryPage({ onSelectPOV }: EntryPageProps): React.JSX.Element {
  const navigate = useNavigate();

  // Admin login dialog state
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('CyberForgeAdmin2026!');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError(null);
    try {
      const res = await adminLogin({
        username: adminUsername,
        password: adminPassword,
      });
      localStorage.setItem('cyberforge_admin_token', res.token);
      onSelectPOV('admin');
      navigate('/admin');
    } catch (err: any) {
      setAdminError(err.detail || err.message || 'Invalid administrator ID or password');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSelectNormal = () => {
    onSelectPOV('normal');
    navigate('/report');
  };

  const handleSelectDemo = async () => {
    try {
      await resetDemoLicense();
    } catch {
      // Continue even if server reset had transient error
    }
    onSelectPOV('demo');
    navigate('/report');
  };

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
            <span>🛡️</span> CyberForge v1.0 • Community Scam Map
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Choose Your Experience
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Select an operational Point of View (POV) to explore the platform architecture.
          </p>
        </div>

        {/* 3 POV Cards */}
        <div className="mt-8 space-y-4 sm:space-y-5">
          {/* 1. Administrator POV */}
          <div className="relative rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-lg transition hover:border-blue-500/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-xl text-blue-400">
                  🛡️
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Administrator</h2>
                  <span className="inline-block rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                    365-Day Enterprise License
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Backend-authenticated operational portal. Review real-time scam reports, adjudicate
              dispute requests with documented reasoning, maintain audit history, manage verified
              businesses, and monitor 365-day license health.
            </p>

            <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="text-blue-400">✓</span> Backend-enforced credential security (ID & password)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-blue-400">✓</span> Approve or reject report disputes with recorded audit trail
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-blue-400">✓</span> Persistent 365-day license without reset-on-login
              </li>
            </ul>

            <div className="mt-4">
              {!showAdminLogin ? (
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(true)}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                >
                  Authenticate as Administrator →
                </button>
              ) : (
                <form onSubmit={handleAdminSubmit} className="mt-2 rounded-xl bg-slate-900/90 p-4 border border-blue-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-300">Administrator Sign In</span>
                    <button
                      type="button"
                      onClick={() => setShowAdminLogin(false)}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  {adminError ? (
                    <div className="mb-3 rounded-lg bg-rose-950/80 p-2 text-xs text-rose-300 border border-rose-800">
                      {adminError}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">Admin ID</label>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">Password</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] text-slate-400">
                    Hackathon Credentials: <span className="font-mono text-slate-300">admin</span> / <span className="font-mono text-slate-300">CyberForgeAdmin2026!</span>
                  </p>

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition disabled:opacity-50"
                  >
                    {adminLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* 2. Normal User POV */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-lg transition hover:border-emerald-500/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-xl text-emerald-400">
                  👤
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Normal User</h2>
                  <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Direct Public Access (Zero License Friction)
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Immediate, frictionless citizen interface. Search suspected phone numbers, bank accounts,
              and UPI IDs; file anonymous scam reports; view localized cluster maps; and submit report disputes.
            </p>

            <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> No license key or registration barriers
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Immune to demo license expiration
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Anonymized reporting with anti-sybil trust clustering
              </li>
            </ul>

            <button
              type="button"
              onClick={handleSelectNormal}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              Enter as Normal User →
            </button>
          </div>

          {/* 3. Demo User POV */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-lg transition hover:border-amber-500/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-xl text-amber-400">
                  ⏱️
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Demo User</h2>
                  <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    Judging Sandbox • 5-Minute License
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Isolated judging test sandbox. Complete with 5-minute license timer, demo console,
              and simulated expiration. Test report creation, dispute resolution, and instant renewal
              using the master renewal key <strong className="text-amber-300">Gandadagudi</strong>.
            </p>

            <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="text-amber-400">✓</span> 100% data isolation (demo actions do not affect real data)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-amber-400">✓</span> Live 5-minute license countdown and expiration lock
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-amber-400">✓</span> Zero server restarts for renewal with 'Gandadagudi'
              </li>
            </ul>

            <button
              type="button"
              onClick={handleSelectDemo}
              className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-amber-500 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              Launch Demo Sandbox (5-Min License) →
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          CyberForge Multi-POV Architecture • Switch roles at any time from the top navigation.
        </p>
      </div>
    </div>
  );
}
