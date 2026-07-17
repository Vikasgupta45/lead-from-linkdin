import React, { useState } from 'react';

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

async function adminFetch(path: string, password: string, options: RequestInit = {}): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${password}`,
      ...(options.headers ?? {}),
    },
  });
  const data: Record<string, unknown> = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

function errorText(data: Record<string, unknown>): string {
  return typeof data.error === 'string' ? data.error : 'Request failed. Please try again.';
}

export const AdminPanel: React.FC = () => {
  const [password, setPassword] = useState('');
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [ipBlocked, setIpBlocked] = useState<boolean | null>(null);
  const [targetIp, setTargetIp] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const requirePassword = (): boolean => {
    if (password.trim().length === 0) {
      setFeedback({ kind: 'err', text: 'Enter the admin password first.' });
      return false;
    }
    return true;
  };

  const checkMyIp = async () => {
    if (!requirePassword()) return;
    setBusy('whoami');
    setFeedback(null);
    try {
      const { ok, data } = await adminFetch('/api/admin/whoami', password);
      if (!ok) {
        setFeedback({ kind: 'err', text: errorText(data) });
        return;
      }
      const ip = typeof data.ip === 'string' ? data.ip : '';
      setDetectedIp(ip);
      setIpBlocked(data.ipBlocked === true);
      setTargetIp(ip);
      setFeedback({ kind: 'ok', text: 'Server-side IP detected.' });
    } catch {
      setFeedback({ kind: 'err', text: 'Could not reach the server.' });
    } finally {
      setBusy(null);
    }
  };

  const unblock = async (type: 'ip' | 'visitor', target: string) => {
    if (!requirePassword()) return;
    if (!target) {
      setFeedback({ kind: 'err', text: type === 'ip' ? 'Enter an IP address to reset.' : 'No visitor session found in this browser.' });
      return;
    }
    setBusy(type);
    setFeedback(null);
    try {
      const { ok, data } = await adminFetch('/api/admin/unblock', password, {
        method: 'POST',
        body: JSON.stringify({ type, target }),
      });
      if (!ok) {
        setFeedback({ kind: 'err', text: errorText(data) });
        return;
      }
      if (type === 'visitor') {
        try { localStorage.removeItem('sbl_visitor_id'); } catch { /* storage unavailable */ }
      }
      setFeedback({ kind: 'ok', text: type === 'ip' ? `IP ${target} has been reset.` : 'Visitor session has been reset. Refresh the main page to get a fresh search.' });
      if (type === 'ip' && target === detectedIp) setIpBlocked(false);
    } catch {
      setFeedback({ kind: 'err', text: 'Could not reach the server.' });
    } finally {
      setBusy(null);
    }
  };

  const resetMyVisitor = () => {
    let visitorId = '';
    try { visitorId = localStorage.getItem('sbl_visitor_id') ?? ''; } catch { /* storage unavailable */ }
    void unblock('visitor', visitorId);
  };

  return (
    <div className="min-h-screen bg-navy-50 text-navy-900 font-sans py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-navy-900">sbl.so</span> <span className="text-brand-600">admin</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-navy-500">Reset free-search blocks for an IP or visitor session.</p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-200 shadow-sm p-6 space-y-5">
          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold text-navy-700 mb-1.5">Admin password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoComplete="current-password"
              className="w-full px-4 py-2.5 text-sm border border-navy-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1.5 text-[11px] font-medium text-navy-400">Limited to 5 attempts per 15 minutes. The password is only kept in this tab.</p>
          </div>

          <div className="pt-4 border-t border-navy-100 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-navy-900">Your IP (as the server sees it)</h2>
                {detectedIp && (
                  <p className="text-xs font-semibold text-navy-500 truncate">
                    {detectedIp} · {ipBlocked ? <span className="text-red-600">blocked</span> : <span className="text-emerald-600">not blocked</span>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={checkMyIp}
                disabled={busy !== null}
                className="shrink-0 rounded-lg border border-navy-200 bg-white px-3 py-2 text-xs font-bold text-navy-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy === 'whoami' ? 'Checking…' : 'Check my IP'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-navy-100 space-y-2.5">
            <h2 className="text-sm font-bold text-navy-900">Reset an IP</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="e.g. 103.27.9.44 or an IPv6 address"
                className="flex-1 min-w-0 px-4 py-2.5 text-sm border border-navy-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => void unblock('ip', targetIp.trim())}
                disabled={busy !== null}
                className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy === 'ip' ? 'Resetting…' : 'Reset IP'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-navy-100 space-y-2.5">
            <h2 className="text-sm font-bold text-navy-900">Reset this browser&apos;s visitor session</h2>
            <button
              type="button"
              onClick={resetMyVisitor}
              disabled={busy !== null}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-xs font-bold text-navy-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy === 'visitor' ? 'Resetting…' : 'Reset my visitor session'}
            </button>
          </div>

          {feedback && (
            <p role="alert" className={`text-xs font-semibold ${feedback.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
              {feedback.text}
            </p>
          )}
        </div>

        <p className="text-center text-[11px] font-medium text-navy-400">
          A full reset usually needs both: the IP and the visitor session of the browser being tested.
        </p>
      </div>
    </div>
  );
};
