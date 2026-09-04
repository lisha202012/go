import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in'));
    document.body.appendChild(script);
  });
}

export function GoogleSignInButton({ onSuccess, onError, disabled }) {
  const overlayRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !overlayRef.current) return undefined;

    let cancelled = false;

    async function init() {
      try {
        await loadGoogleScript();
        if (cancelled || !overlayRef.current) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setLoading(true);
            try {
              const result = await api.googleAuth({ credential: response.credential });
              onSuccess(result);
            } catch (err) {
              onError(err.message || 'Google sign-in failed');
            } finally {
              setLoading(false);
            }
          },
        });

        overlayRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(overlayRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: overlayRef.current.parentElement?.offsetWidth || 360,
        });

        setReady(true);
      } catch (err) {
        onError(err.message || 'Could not load Google sign-in');
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [onError, onSuccess]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        onClick={() =>
          onError(
            'Google sign-in needs setup. Add VITE_GOOGLE_CLIENT_ID to apps/web/.env.',
          )
        }
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-violet-200 bg-white px-5 py-3.5 font-body text-base font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    );
  }

  return (
    <div className="relative w-full">
      <div
        className={[
          'flex w-full items-center justify-center gap-3 rounded-2xl border border-violet-200 bg-white px-5 py-3.5 font-body text-base font-semibold tracking-normal text-violet-900 shadow-sm',
          disabled || loading ? 'opacity-60' : '',
        ].join(' ')}
        aria-hidden="true"
      >
        <GoogleIcon />
        {loading ? 'Signing in…' : 'Continue with Google'}
      </div>
      <div
        ref={overlayRef}
        className={[
          'absolute inset-0 z-10 overflow-hidden opacity-[0.01]',
          disabled || loading || !ready ? 'pointer-events-none' : '',
        ].join(' ')}
        title="Continue with Google"
      />
      {!ready ? (
        <p className="mt-2 text-center text-xs text-violet-500">Loading Google sign-in…</p>
      ) : null}
    </div>
  );
}
