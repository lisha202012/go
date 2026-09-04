import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useOnboardingStore } from '../store/useOnboardingStore';

/**
 * External GLOW invite landing — opens signup/onboarding with glow token.
 * First-timers do not need a seed inventory to claim/accept.
 */
export default function GlowInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setSeedId = useOnboardingStore((s) => s.setSeedId);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.previewGlowInvite(token);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Invite not found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token) {
      try {
        sessionStorage.setItem('gofam_glow_token', token);
      } catch {
        /* ignore */
      }
    }
  }, [token]);

  async function handleContinue() {
    if (!token) return;
    if (!accessToken) {
      navigate(`/login?glow=${encodeURIComponent(token)}`);
      return;
    }
    setClaiming(true);
    setError('');
    try {
      const claimed = await api.claimGlowInvite(token);
      if (claimed?.seed?.id) setSeedId(claimed.seed.id);
      if (user && !user.onboardingCompleted) {
        navigate('/onboarding');
      } else {
        navigate('/glow');
      }
    } catch (err) {
      setError(err.message || 'Could not claim invite');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col justify-center bg-gradient-to-b from-emerald-50 to-violet-50 px-5 py-10">
      <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
        <Sprout className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          GLOW Invite
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-violet-950">
          Someone planted a seed for you
        </h1>
        {preview ? (
          <p className="mt-2 text-sm text-violet-700">
            <span className="font-semibold">@{preview.sender.username}</span> invited you to grow
            with GOFAM. Create your account, complete GAP as usual, then open the seed — you
            don&apos;t need a Glow Seed yet.
          </p>
        ) : error ? (
          <p className="mt-2 text-sm text-rose-600">{error}</p>
        ) : (
          <p className="mt-2 text-sm text-violet-500">Loading invite…</p>
        )}

        {preview && !error ? (
          <button
            type="button"
            disabled={claiming}
            onClick={handleContinue}
            className="mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {claiming
              ? 'Claiming…'
              : accessToken
                ? 'Continue'
                : 'Create account / Sign in'}
          </button>
        ) : null}

        <Link to="/login" className="mt-3 block text-center text-xs font-semibold text-violet-600">
          Back to login
        </Link>
      </div>
    </div>
  );
}
