import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { api, SessionExpiredError } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useOnboardingStore } from '../store/useOnboardingStore';

export default function LoginPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { accessToken, refreshToken, setAuth, updateUser, clearAuth } = useAuthStore();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const seedQuery = params.get('seedId');
  const glowQuery = params.get('glow');
  const schoolLinkQuery = params.get('schoolLink');
  const nextPath = params.get('next');
  const onboardingPath = seedQuery
    ? `/onboarding?seedId=${encodeURIComponent(seedQuery)}`
    : glowQuery
      ? `/onboarding?glow=${encodeURIComponent(glowQuery)}`
      : schoolLinkQuery
        ? `/onboarding?schoolLink=${encodeURIComponent(schoolLinkQuery)}`
        : '/onboarding';

  const redirectAfterAuth = useCallback(
    (authUser) => {
      const safeNext =
        nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : null;
      if (safeNext?.startsWith('/admin') && authUser.role === 'admin') {
        navigate(safeNext, { replace: true });
        return;
      }
      if (authUser.onboardingCompleted) {
        useOnboardingStore.getState().reset();
        navigate('/home', { replace: true });
      } else {
        navigate(onboardingPath, { replace: true });
      }
    },
    [navigate, nextPath, onboardingPath],
  );

  useEffect(() => {
    if (schoolLinkQuery) {
      try {
        sessionStorage.setItem('gofam_school_link_token', schoolLinkQuery);
      } catch {
        /* ignore */
      }
    }
  }, [schoolLinkQuery]);

  useEffect(() => {
    if (!accessToken && !refreshToken) return;

    let cancelled = false;

    (async () => {
      try {
        const { user: freshUser } = await api.me();
        if (cancelled) return;
        updateUser(freshUser);
        redirectAfterAuth(freshUser);
      } catch (err) {
        if (!cancelled && (err instanceof SessionExpiredError || err.status === 401)) {
          clearAuth();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, updateUser, clearAuth, redirectAfterAuth]);

  const handleGoogleSuccess = useCallback(
    async (result) => {
      setError('');
      setAuth(result);
      if (schoolLinkQuery) {
        try {
          await api.claimSchoolRegistrationLink(schoolLinkQuery);
        } catch {
          /* link may already be claimed or inactive */
        }
      }
      try {
        const { user: freshUser } = await api.me();
        updateUser(freshUser);
        redirectAfterAuth(freshUser);
      } catch {
        redirectAfterAuth(result.user);
      }
    },
    [redirectAfterAuth, setAuth, updateUser],
  );

  const handleGoogleError = useCallback((message) => {
    setError(message);
  }, []);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      let glowToken = glowQuery;
      if (!glowToken) {
        try {
          glowToken = sessionStorage.getItem('gofam_glow_token');
        } catch {
          glowToken = null;
        }
      }

      let schoolLinkToken = schoolLinkQuery;
      if (!schoolLinkToken) {
        try {
          schoolLinkToken = sessionStorage.getItem('gofam_school_link_token');
        } catch {
          schoolLinkToken = null;
        }
      }

      const result =
        mode === 'signup'
          ? await api.register({
              email,
              password,
              ...(glowToken ? { glowToken } : {}),
              ...(schoolLinkToken ? { schoolLinkToken } : {}),
            })
          : await api.login({ email, password });
      setAuth(result);
      if (schoolLinkToken) {
        try {
          await api.claimSchoolRegistrationLink(schoolLinkToken);
        } catch {
          /* link may already be claimed or inactive */
        }
      }
      if (mode === 'login' && glowToken) {
        try {
          await api.claimGlowInvite(glowToken);
        } catch {
          /* invite may already be claimed */
        }
      }
      if (glowToken) {
        try {
          sessionStorage.removeItem('gofam_glow_token');
        } catch {
          /* ignore */
        }
      }
      if (schoolLinkToken) {
        try {
          sessionStorage.removeItem('gofam_school_link_token');
        } catch {
          /* ignore */
        }
      }
      const { user: freshUser } = await api.me();
      updateUser(freshUser);
      redirectAfterAuth(freshUser);
    } catch (err) {
      if (mode === 'signup' && err.status === 409) {
        setMode('login');
        setError('This email is already registered. Log in to continue your journey.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gofam-app relative min-h-dvh overflow-x-hidden bg-[#07070d]">
      {/* Hero backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42dvh] min-h-[280px] bg-gradient-to-br from-violet-900 via-violet-800 to-fuchsia-900" />
      <div className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-32 -left-12 h-40 w-40 rounded-full bg-fuchsia-300/25 blur-2xl" />

      <div className="relative mx-auto flex min-h-dvh max-w-app flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        {/* Top hero */}
        <header className="animate-fade-up shrink-0 pt-2 text-center text-white">
          <p className="font-display text-xs font-semibold tracking-[0.28em] uppercase opacity-90">
            GOFAM GROW
          </p>
          <h1 className="mt-3 font-display text-[1.65rem] font-semibold leading-tight sm:text-3xl">
            Master the Flow.
            <br />
            Share the Glow.
          </h1>
          <p className="mx-auto mt-3 max-w-[17rem] text-sm leading-relaxed text-violet-100/95">
            {mode === 'signup'
              ? 'Plant virtues, climb hills, and grow together as a family.'
              : 'Welcome back, grower — continue your journey.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
              🌱 7 Hills
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
              ✨ GLOW Seeds
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
              🪙 Coins
            </span>
          </div>
        </header>

        {/* Form card — overlaps hero */}
        <div className="animate-fade-up delay-100 mt-8 flex flex-1 flex-col">
          <div className="rounded-3xl border border-violet-500/30 bg-[#14141f]/95 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_24px_rgba(124,58,237,0.15)] backdrop-blur-sm sm:p-6">
            <div className="mb-5 text-center">
              <h2 className="font-display text-xl font-semibold text-violet-900">
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="mt-1.5 text-sm text-violet-700/65">
                {mode === 'signup' ? 'Join your family garden' : 'Pick up where you left off'}
              </p>
            </div>

            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              disabled={submitting}
            />

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-violet-100" />
              <span className="text-[11px] font-semibold tracking-wider text-violet-400 uppercase">
                or email
              </span>
              <div className="h-px flex-1 bg-violet-100" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <label className="block text-[11px] font-semibold tracking-wide text-violet-600 uppercase">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  className="mt-1.5 w-full rounded-xl border border-violet-200/90 bg-violet-50/30 px-4 py-3 text-base text-violet-950 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200"
                  placeholder="you@family.com"
                  autoComplete="email"
                />
              </label>

              <label className="block text-[11px] font-semibold tracking-wide text-violet-600 uppercase">
                Password
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-violet-200/90 bg-violet-50/30 py-3 pr-12 pl-4 text-base text-violet-950 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200"
                    placeholder="At least 8 characters"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-violet-500 transition hover:bg-violet-100 hover:text-violet-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {mode === 'signup' ? (
                <label className="block text-[11px] font-semibold tracking-wide text-violet-600 uppercase">
                  Confirm password
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-violet-200/90 bg-violet-50/30 py-3 pr-12 pl-4 text-base text-violet-950 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200"
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-violet-500 transition hover:bg-violet-100 hover:text-violet-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
              ) : null}

              {error ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/35 transition hover:from-violet-700 hover:to-fuchsia-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? mode === 'signup'
                    ? 'Creating account…'
                    : 'Logging in…'
                  : mode === 'signup'
                    ? 'Start growing →'
                    : 'Continue journey →'}
              </button>
            </form>
          </div>

          {/* Footer — always has bottom breathing room */}
          <div className="mt-6 shrink-0 pb-2 text-center">
            <p className="text-sm text-violet-800/70">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    className="font-semibold text-violet-700 underline-offset-2 hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                    }}
                    className="font-semibold text-violet-700 underline-offset-2 hover:underline"
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>

            {seedQuery ? (
              <p className="mt-3 rounded-xl bg-violet-100/80 px-3 py-2 text-xs text-violet-700">
                🌱 You have a GLOW seed invitation — sign up or log in to accept it.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
