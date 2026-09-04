import { useState } from 'react';
import { api, SessionExpiredError } from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

export function SproutGuardianStep({ onSaved, onNeedProfile }) {
  const user = useAuthStore((s) => s.user);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDefer, setShowDefer] = useState(false);

  async function saveChoice(guardianSupported) {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchSproutGuardian({ guardianSupported });
      onSaved(result.user);
    } catch (err) {
      if (err instanceof SessionExpiredError || err.status === 401) {
        useAuthStore.getState().clearAuth();
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Could not save your answer');
    } finally {
      setSubmitting(false);
    }
  }

  if (showDefer) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
        <h2 className="font-display text-2xl font-semibold text-violet-900">
          Parent or guardian setup needed
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-violet-800/80">
          Sprout profiles are meant to be set up together with a parent or guardian. You can continue
          for now, but a guardian will need to link before full GOFAM access is available.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => saveChoice(false)}
          className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:bg-violet-300"
        >
          {submitting ? 'Saving…' : 'Continue — I’ll add a guardian later'}
        </button>
        <button
          type="button"
          onClick={() => setShowDefer(false)}
          className="mt-3 w-full rounded-2xl border border-violet-200 px-5 py-3 text-sm font-semibold text-violet-700"
        >
          Go back
        </button>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <p className="text-2xl" aria-hidden="true">
        🌱
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-violet-900">One little check…</h2>
      <p className="mt-3 text-sm leading-relaxed text-violet-800/80">
        Are you setting this up together with a parent or guardian?
      </p>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => saveChoice(true)}
        className="mt-10 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:bg-emerald-300"
      >
        Yes — we&apos;re setting up together
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => setShowDefer(true)}
        className="mt-3 w-full rounded-2xl border border-violet-200 bg-white px-5 py-3.5 text-base font-semibold text-violet-800"
      >
        No
      </button>

      {!user?.dateOfBirth ? (
        <button
          type="button"
          onClick={onNeedProfile}
          className="mt-6 text-center text-xs font-medium text-violet-600 underline"
        >
          Back to profile
        </button>
      ) : null}
    </section>
  );
}
