import { useState } from 'react';
import { api } from '../../../lib/api';

const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

function weekdayLabel(day) {
  return WEEKDAYS.find((d) => d.value === day)?.label ?? 'Wednesday';
}

export function GofamWeekStartStep({
  selectedDay,
  existingWeekStartDay,
  onSelect,
  onNext,
  focusHill,
  strongestHill,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const alreadySet = existingWeekStartDay != null;
  const effectiveDay = alreadySet ? existingWeekStartDay : selectedDay;

  async function handleContinue() {
    if (alreadySet) {
      onNext(null);
      return;
    }

    if (selectedDay == null) {
      setError('Choose the day your GOFAM week begins');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchGofamWeekStart(selectedDay);
      onNext(result.user);
    } catch (err) {
      if (err.status === 409 || /permanent and cannot be changed/i.test(err.message ?? '')) {
        onNext(null);
        return;
      }
      setError(err.message || 'Could not save your week start day');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
      <h2 className="font-display text-2xl font-semibold text-violet-900">
        {alreadySet ? 'Your GOFAM week is set' : 'When does your GOFAM week start?'}
      </h2>
      {alreadySet ? (
        <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
          Your week always runs{' '}
          <span className="font-semibold">
            {weekdayLabel(existingWeekStartDay)} → {weekdayLabel((existingWeekStartDay + 6) % 7)}
          </span>
          . This was saved during your first setup and stays the same.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
          Pick the weekday that begins your personal 7-day cycle. If you choose Wednesday, your week
          is always <span className="font-semibold">Wednesday → Tuesday</span> — permanently.
        </p>
      )}
      <p className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-800/80">
        {focusHill?.name ? (
          <>
            Based on your GAP results, <span className="font-semibold">{focusHill.name}</span> is
            your Day 1 focus
            {strongestHill?.name ? (
              <>
                {' '}
                and <span className="font-semibold">{strongestHill.name}</span> is your Day 7
              </>
            ) : null}
            . Each week starts with your lowest-scoring Hill and ends with your strongest.
            {!alreadySet ? ' This choice cannot be changed later.' : null}
          </>
        ) : (
          <>
            Day 1 of each week is your lowest-scoring Hill from GAP. Day 7 is your strongest.
            {!alreadySet ? ' This choice cannot be changed later.' : null}
          </>
        )}
      </p>

      {!alreadySet ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEEKDAYS.map((day) => {
            const active = selectedDay === day.value;
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => onSelect(day.value)}
                className={[
                  'rounded-2xl border px-4 py-4 text-left transition',
                  active
                    ? 'border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                    : 'border-violet-200 bg-white text-violet-900 hover:border-violet-300',
                ].join(' ')}
              >
                <span className="text-lg font-semibold">{day.short}</span>
                <span className={`mt-0.5 block text-xs ${active ? 'text-violet-100' : 'text-violet-600'}`}>
                  {day.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-violet-200 bg-white px-5 py-4 text-center">
          <p className="text-2xl font-semibold text-violet-900">{weekdayLabel(existingWeekStartDay)}</p>
          <p className="mt-1 text-sm text-violet-600">Week start day</p>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={submitting || (!alreadySet && effectiveDay == null)}
        onClick={handleContinue}
        className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        {submitting ? 'Saving…' : alreadySet ? 'Continue to Growth Report' : 'Continue to Growth Report'}
      </button>
    </section>
  );
}
