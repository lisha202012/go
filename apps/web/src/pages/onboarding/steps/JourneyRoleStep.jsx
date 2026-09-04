import { useState } from 'react';
import { api, SessionExpiredError } from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

const OPTIONS = [
  {
    id: 'self_growth',
    emoji: '🌱',
    title: 'Growing Myself',
    description: 'Focus on my own LIFE and growth.',
  },
  {
    id: 'next_generation_guidance',
    emoji: '🧭',
    title: 'Guiding the Next Generation',
    description: 'For parents, grandparents and guardians.',
  },
  {
    id: 'both',
    emoji: '✨',
    title: 'Both',
    description: 'Grow yourself while guiding others.',
  },
];

export function JourneyRoleStep({ onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function choose(journeyRole) {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchJourneyRole({ journeyRole });
      onSaved(result.user);
    } catch (err) {
      if (err instanceof SessionExpiredError || err.status === 401) {
        useAuthStore.getState().clearAuth();
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Could not save your journey choice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <h2 className="font-display text-2xl font-semibold text-violet-900">
        Which GOFAM journey fits you best right now?
      </h2>
      <p className="mt-2 text-sm text-violet-800/70">You can change this anytime.</p>

      <div className="mt-6 space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={submitting}
            onClick={() => choose(opt.id)}
            className="w-full rounded-2xl border border-violet-100 bg-white px-4 py-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md disabled:opacity-60"
          >
            <p className="text-lg font-semibold text-violet-950">
              <span aria-hidden="true">{opt.emoji} </span>
              {opt.title}
            </p>
            <p className="mt-1 text-sm text-violet-700/80">{opt.description}</p>
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}
