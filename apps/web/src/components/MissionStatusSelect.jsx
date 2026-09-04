import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

/**
 * Custom mission picker — native <option> cannot color ✓/✗.
 */
export function MissionStatusSelect({
  label = 'Choose a mission',
  placeholder = 'Choose a mission…',
  missions = [],
  value = '',
  onChange,
  getOptionMeta,
  primaryOffset = 0,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  const selected = missions.find((m) => m.id === value) ?? null;

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">{label}</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
      >
        {selected ? (
          <>
            <StatusMark done={(getOptionMeta?.(selected)?.done ?? selected.completionCount ?? 0) > 0} />
            <span className="min-w-0 flex-1 truncate">
              {getOptionMeta?.(selected)?.title ?? selected.title}
            </span>
            {getOptionMeta?.(selected)?.coinReward != null ? (
              <span className="shrink-0 text-xs font-bold text-amber-700">
                +{getOptionMeta(selected).coinReward}
              </span>
            ) : null}
          </>
        ) : (
          <span className="flex-1 text-violet-400">{placeholder}</span>
        )}
        <ChevronDown
          className={['h-4 w-4 shrink-0 text-violet-400 transition', open ? 'rotate-180' : ''].join(
            ' ',
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="relative z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-violet-200 bg-white py-1 shadow-lg"
        >
          {missions.map((mission, index) => {
            const meta = getOptionMeta?.(mission) ?? {
              done: (mission.completionCount ?? (mission.completed ? 1 : 0)) > 0,
              title: mission.title,
              coinReward: mission.coinReward,
            };
            const active = mission.id === value;
            return (
              <li key={mission.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(mission.id);
                    setOpen(false);
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition',
                    active ? 'bg-violet-50 font-semibold text-violet-950' : 'text-violet-900 hover:bg-violet-50',
                  ].join(' ')}
                >
                  <StatusMark done={Boolean(meta.done)} />
                  <span className="min-w-0 flex-1 truncate">
                    {index + primaryOffset + 1}. {meta.title}
                  </span>
                  {meta.coinReward != null ? (
                    <span className="shrink-0 text-xs font-bold text-amber-700">
                      +{meta.coinReward}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function StatusMark({ done }) {
  return done ? (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
      aria-label="Completed"
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  ) : (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
      aria-label="Not completed"
    >
      <X className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}
