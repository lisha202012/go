import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { accessToken, refreshToken, user, setAuth, clearAuth } = useAuthStore();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const finishLogin = useCallback(
    (result) => {
      setAuth({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionId: result.sessionId,
        adminProfile: result.admin,
      });
      navigate('/admin', { replace: true });
    },
    [navigate, setAuth],
  );

  useEffect(() => {
    if (!accessToken || !refreshToken || user?.role !== 'admin') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.adminMe();
        if (cancelled) return;
        if (me.admin?.modules?.length) {
          useAuthStore.getState().setAdminProfile(me.admin);
          navigate('/admin', { replace: true });
        }
      } catch {
        // stale session — stay on login
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, user, navigate]);

  async function handleCredentials(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await api.adminLogin({ email, password });
      if (result.step === 'password_reset') {
        setResetToken(result.resetToken);
        setStep('password_reset');
        return;
      }
      if (result.step === 'complete') {
        finishLogin(result);
      }
    } catch (err) {
      setError(err.message || 'Invalid staff credentials');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.adminPasswordReset({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setNewPassword('');
      setConfirmPassword('');
      if (result.step === 'complete') {
        finishLogin(result);
      }
    } catch (err) {
      setError(err.message || 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-slate-950 px-4 py-10 font-body text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(245,158,11,0.12),transparent_50%)]" />

      <section className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-7">
          {step === 'credentials' ? (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">Staff sign in</h2>
                <p className="mt-0.5 text-sm text-slate-400">Email and password only — no Google sign-in</p>
              </div>
              {user && user.role !== 'admin' ? (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Member session active.{' '}
                  <button type="button" onClick={() => clearAuth()} className="underline">
                    Log out
                  </button>
                </div>
              ) : null}
              <form onSubmit={handleCredentials} className="space-y-4">
                <label className="block text-xs font-medium text-slate-400">
                  Staff email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                    placeholder="admn@gmail.com"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-400">
                  Password
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pr-16 pl-3 text-sm text-white outline-none focus:border-amber-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>
                {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : null}

          {step === 'password_reset' ? (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">Set new password</h2>
                <p className="mt-1 text-sm text-slate-400">Minimum 12 characters.</p>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <label className="block text-xs font-medium text-slate-400">
                  New password
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-400">
                  Confirm password
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                  />
                </label>
                {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950"
                >
                  {submitting ? 'Updating…' : 'Save & sign in'}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
