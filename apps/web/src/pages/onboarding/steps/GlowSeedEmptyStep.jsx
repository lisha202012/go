import { useState } from 'react';
import { api } from '../../../lib/api';

export function GlowSeedEmptyStep({ bloomedVirtue, onNext, onSeedPlanted }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  async function handleRefreshInvite() {
    setChecking(true);
    setMessage('');
    try {
      const pending = await api.getPendingGlowSeed();
      if (pending.seed) {
        onSeedPlanted(pending.seed);
      } else {
        setMessage('No invite yet. Ask family to send one, or tap Continue to skip.');
      }
    } catch (err) {
      const friendly =
        err.status === 503 || err.message?.includes('Database is offline')
          ? 'Could not reach server — tap Continue to skip this step.'
          : err.message || 'Could not refresh. Tap Continue to skip.';
      setMessage(friendly);
    } finally {
      setChecking(false);
    }
  }

  if (bloomedVirtue) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
        <h2 className="font-display text-2xl font-semibold text-violet-900">GLOW invite received</h2>
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-5 text-white shadow-xl shadow-violet-600/30">
          <p className="text-sm text-violet-100">You already accepted a GLOW invite.</p>
          <p className="mt-2 font-display text-2xl font-semibold">{bloomedVirtue}</p>
          <p className="mt-2 text-sm text-violet-100/90">Your first virtue is active.</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
        >
          Continue
        </button>
      </section>
    );
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
      <h2 className="font-display text-2xl font-semibold text-violet-900">Receive GLOW Seed?</h2>

      <p className="mt-3 text-sm leading-relaxed text-violet-800/80">
        A GLOW invite from family unlocks bonus coins and a shared virtue.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-violet-800/80">
        You don&apos;t have one yet — that&apos;s normal for a new account. Tap Continue to skip, or
        Refresh if family just sent an invite.
      </p>

      <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <p className="text-2xl" aria-hidden="true">
          📭
        </p>
        <p className="mt-2 font-semibold text-violet-900">No invite waiting</p>
        <p className="mt-2 text-sm leading-relaxed text-violet-700/75">
          When family sends a GLOW invite to your account, an <span className="font-semibold">Accept</span>{' '}
          button will appear here automatically.
        </p>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
        >
          Continue
        </button>
        <button
          type="button"
          disabled={checking}
          onClick={handleRefreshInvite}
          className="w-full rounded-2xl border border-violet-200 bg-white px-5 py-3.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
        >
          {checking ? 'Refreshing…' : 'Refresh invite'}
        </button>
      </div>
    </section>
  );
}
