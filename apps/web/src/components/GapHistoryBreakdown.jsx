import { CheckCircle2, Star } from 'lucide-react';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { hillDomainLabel } from '../lib/hills';
import { FLOW_RING_FOUNDATION_THRESHOLD, HILL_RING_COLORS } from '../lib/hillRingColors';

const GAP_HILL_ORDER = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];
const COMPLETE_GREEN = '#22C55E';
const NAVY = '#1e1b4b';

export function formatGapDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function rowsFromEntry(entry) {
  const byCode = new Map((entry?.hillScores ?? []).map((s) => [s.hillCode, s]));
  return GAP_HILL_ORDER.map((code) => {
    const score = Math.round(Number(byCode.get(code)?.flowPercent) || 0);
    const complete = score >= FLOW_RING_FOUNDATION_THRESHOLD;
    const ptsToGo = complete ? 0 : Math.max(0, FLOW_RING_FOUNDATION_THRESHOLD - score);
    return {
      code,
      score,
      complete,
      ptsToGo,
      color: HILL_RING_COLORS[code] ?? '#7C3AED',
      domain: hillDomainLabel(code),
    };
  });
}

function HillIcon({ code, color, size = 'md' }) {
  const Icon = HILL_LUCIDE[code];
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full text-white shadow-sm`}
      style={{ backgroundColor: color }}
    >
      {Icon ? <Icon className={glyph} strokeWidth={2.2} aria-hidden="true" /> : null}
    </span>
  );
}

function FoundationBar({ score, complete, color }) {
  const pct = complete
    ? 100
    : Math.min(100, Math.round((score / FLOW_RING_FOUNDATION_THRESHOLD) * 100));
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: complete ? COMPLETE_GREEN : color }}
      />
    </div>
  );
}

function HillFoundationRow({ row }) {
  const { code, score, complete, ptsToGo, color, domain } = row;

  return (
    <li className="flex items-start gap-3 py-3.5">
      <HillIcon code={code} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-snug" style={{ color: NAVY }}>
            <span className="font-bold tracking-wide">{code}</span>
            <span className="font-medium text-slate-400"> • {domain}</span>
          </p>
          <p
            className="shrink-0 text-2xl font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {score}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-500">
            {complete ? `${score} / ${FLOW_RING_FOUNDATION_THRESHOLD}+` : `${score} / ${FLOW_RING_FOUNDATION_THRESHOLD}`}
          </span>
          <FoundationBar score={score} complete={complete} color={color} />
          {complete ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">
              Complete
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </span>
          ) : (
            <span
              className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold"
              style={{ color }}
            >
              {ptsToGo} pts to go
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function RemainingCard({ row, isTop }) {
  const { code, ptsToGo, color, domain } = row;
  return (
    <div
      className="rounded-2xl bg-white p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
      style={{ border: `1.5px solid ${color}55` }}
    >
      <div className="flex items-start gap-3">
        <HillIcon code={code} color={color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide" style={{ color: NAVY }}>
            {code} <span className="font-medium text-slate-400">• {domain}</span>
          </p>
          <p className="mt-1 text-sm leading-snug" style={{ color: NAVY }}>
            <span className="font-bold">{ptsToGo} points</span>
            <span className="font-medium text-slate-500">
              {isTop ? ' to complete' : ' remaining'}
            </span>
          </p>
        </div>
      </div>
      {isTop ? (
        <p
          className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: color }}
        >
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
          Top priority
        </p>
      ) : null}
    </div>
  );
}

export function GapHistoryBreakdown({ entry }) {
  const rows = rowsFromEntry(entry);
  const focusCode = entry?.focusHill?.code;
  const remaining = [...rows.filter((row) => !row.complete)].sort((a, b) => {
    if (focusCode) {
      if (a.code === focusCode) return -1;
      if (b.code === focusCode) return 1;
    }
    return b.ptsToGo - a.ptsToGo;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <p className="text-sm font-semibold" style={{ color: NAVY }}>
          {entry.flowIndex}% · {entry.flowStatus}
        </p>
        <span className="text-[11px] text-slate-400">{formatGapDate(entry.completedAt)}</span>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
        <h3 className="text-base font-bold" style={{ color: NAVY }}>
          Hill Foundation Breakdown
        </h3>
        <ul className="mt-1 divide-y divide-slate-100">
          {rows.map((row) => (
            <HillFoundationRow key={row.code} row={row} />
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2.5 text-base font-bold" style={{ color: NAVY }}>
          Foundation Remaining
        </h3>
        {remaining.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            All 7 hills are at foundation ({FLOW_RING_FOUNDATION_THRESHOLD}+).
          </p>
        ) : (
          <div className="space-y-2.5">
            {remaining.map((row, index) => (
              <RemainingCard key={row.code} row={row} isTop={index === 0} />
            ))}
          </div>
        )}
      </section>

      {entry.nextRecalibrationAt ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-800">
          Next recalibration · {formatGapDate(entry.nextRecalibrationAt)}
        </p>
      ) : null}
    </div>
  );
}

export function GapHistoryPreview({ entry }) {
  if (!entry) return null;
  const rows = rowsFromEntry(entry);
  const remaining = rows.filter((row) => !row.complete).length;

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: NAVY }}>
          {entry.flowIndex}% · {entry.flowStatus}
        </p>
        <span className="text-[11px] text-slate-400">
          {remaining === 0
            ? 'Foundation complete'
            : `${remaining} hill${remaining === 1 ? '' : 's'} remaining`}
        </span>
      </div>
    </div>
  );
}
