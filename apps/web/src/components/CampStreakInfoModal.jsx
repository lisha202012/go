import { useEffect, useState } from 'react';
import { Flame, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TokenRow({ token }) {
  const earnedLabel = formatWhen(token.earnedAt);
  const isAvailable = token.status === 'available';

  return (
    <li className="rounded-2xl border border-violet-100 bg-violet-50/40 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-950">
            {token.campName}
            <span className="ml-1.5 text-xs font-medium text-violet-600">
              (Step {token.stepThreshold})
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-violet-800/80">
            Earned {earnedLabel || 'on your climb'} — you reached this camp checkpoint on your Hill
            journey.
          </p>
          {!isAvailable && token.usedFor ? (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-900/85">
              Used {formatWhen(token.usedAt) || 'recently'} to forgive missed{' '}
              <span className="font-semibold">
                {formatHillTitle(token.usedFor.hill)}
              </span>{' '}
              on {formatWhen(token.usedFor.calendarDate)}.
            </p>
          ) : null}
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            isAvailable
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-200 text-slate-600',
          ].join(' ')}
        >
          {isAvailable ? 'Available' : 'Used'}
        </span>
      </div>
    </li>
  );
}

export function CampStreakInfoModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [campStreak, setCampStreak] = useState(null);
  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getFlowWeekStreak()
      .then((payload) => {
        if (cancelled) return;
        setCampStreak(payload?.campStreak ?? null);
        setTokens(payload?.tokens ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load streak history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const available = campStreak?.tokensAvailable ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camp-streak-title"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
                <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
              </span>
              <h2 id="camp-streak-title" className="font-display text-xl font-semibold text-violet-900">
                Free streaks
              </h2>
            </div>
            <p className="mt-2 text-sm font-semibold text-amber-900">
              {available} available · {campStreak?.tokensUsed ?? 0} used ·{' '}
              {campStreak?.tokensEarned ?? tokens.length} earned
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-violet-500 hover:bg-violet-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-violet-600">Loading streak history…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-violet-700/80">
              No free streaks yet. Reach your next Camp checkpoint on any Hill to earn one.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {[...tokens]
                .sort((a, b) => {
                  if (a.status !== b.status) return a.status === 'available' ? -1 : 1;
                  return new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime();
                })
                .map((token) => (
                  <TokenRow key={token.id} token={token} />
                ))}
            </ul>
          )}
        </div>

        <div className="border-t border-violet-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function CampStreakBadge({ count, className = '', onClick }) {
  if (!count || count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100/90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${count} free streak${count === 1 ? '' : 's'} available — tap for details`}
    >
      <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
      free streak{count === 1 ? '' : 's'} available
    </button>
  );
}
