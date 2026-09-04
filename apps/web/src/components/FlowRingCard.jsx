import { Sprout } from 'lucide-react';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { formatHillTitle } from '../lib/hills';
import { HILL_RING_COLORS, HILL_RING_ORDER } from '../lib/hillRingColors';

/** Spec: FLOW Ring foundation gate — every hill must be ≥ this GAP score. */
export const FLOW_RING_FOUNDATION_THRESHOLD = 40;

const BROKEN_FILL = '#D1D5DB';
const BROKEN_STROKE = '#9CA3AF';

function polar(cx, cy, r, degFromTop) {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function donutPath(cx, cy, rInner, rOuter, startDeg, endDeg) {
  const outerStart = polar(cx, cy, rOuter, startDeg);
  const outerEnd = polar(cx, cy, rOuter, endDeg);
  const innerEnd = polar(cx, cy, rInner, endDeg);
  const innerStart = polar(cx, cy, rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function SegmentedFlowRing({ hills = [], size, strokeWidth, complete }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const count = HILL_RING_ORDER.length;
  const gapDeg = 2.5;
  const segmentDeg = (360 - count * gapDeg) / count;
  const segmentArc = (segmentDeg / 360) * circumference;
  const gapArc = (gapDeg / 360) * circumference;
  const hillList = Array.isArray(hills) ? hills : [];
  const hillByCode = Object.fromEntries(hillList.map((h) => [h.code, h]));

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      {HILL_RING_ORDER.map((code, i) => {
        const hill = hillByCode[code] ?? { score: 0 };
        const atFoundation = (hill.score ?? 0) >= FLOW_RING_FOUNDATION_THRESHOLD;
        const rotation = i * (segmentDeg + gapDeg) + gapDeg / 2;

        return (
          <g key={code} transform={`rotate(${rotation} ${cx} ${cy})`}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={complete ? '#EDE9FE' : '#E5E7EB'}
              strokeWidth={strokeWidth}
              strokeDasharray={`${trackArc} ${circumference - trackArc}`}
              strokeLinecap="butt"
            />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={atFoundation ? HILL_RING_COLORS[code] : BROKEN_FILL}
              strokeWidth={strokeWidth}
              strokeDasharray={`${trackArc} ${circumference - trackArc}`}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
              opacity={atFoundation ? (complete ? 1 : 0.9) : 0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function FlowRingDetailed({ hills = [], size = 196 }) {
  const labelPad = 22;
  const box = size + labelPad * 2;
  const cx = box / 2;
  const cy = box / 2;
  const thickness = Math.round(size * 0.22);
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;
  const rIcon = (rInner + rOuter) / 2;
  const rScore = rOuter + 14;
  const count = HILL_RING_ORDER.length;
  const gapDeg = 4;
  const sweep = 360 / count - gapDeg;
  const hillByCode = Object.fromEntries((hills ?? []).map((h) => [h.code, h]));
  const iconSize = Math.max(12, Math.round(thickness * 0.42));

  return (
    <div className="relative mx-auto" style={{ width: box, height: box }}>
      <svg width={box} height={box} aria-hidden="true">
        <defs>
          <pattern id="gofam-broken-ring" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={BROKEN_FILL} />
            <path d="M0 8 L8 0" stroke={BROKEN_STROKE} strokeWidth="1.2" />
            <path d="M2 8 L8 2" stroke="#6B7280" strokeWidth="0.7" opacity="0.7" />
          </pattern>
        </defs>
        {HILL_RING_ORDER.map((code, i) => {
          const start = i * (360 / count) + gapDeg / 2;
          const end = start + sweep;
          const hill = hillByCode[code] ?? { score: 0 };
          const score = Math.round(Number(hill.score) || 0);
          const intact = score >= FLOW_RING_FOUNDATION_THRESHOLD;
          return (
            <path
              key={code}
              d={donutPath(cx, cy, rInner, rOuter, start, end)}
              fill={intact ? HILL_RING_COLORS[code] : 'url(#gofam-broken-ring)'}
              stroke={intact ? 'rgba(255,255,255,0.35)' : BROKEN_STROKE}
              strokeWidth={intact ? 0.5 : 1}
            />
          );
        })}
      </svg>

      {HILL_RING_ORDER.map((code, i) => {
        const start = i * (360 / count) + gapDeg / 2;
        const mid = start + sweep / 2;
        const hill = hillByCode[code] ?? { score: 0 };
        const score = Math.round(Number(hill.score) || 0);
        const intact = score >= FLOW_RING_FOUNDATION_THRESHOLD;
        const Icon = HILL_LUCIDE[code];
        const iconPos = polar(cx, cy, rIcon, mid);
        const scorePos = polar(cx, cy, rScore, mid);
        const title = formatHillTitle({ code, name: hill.name });

        return (
          <div key={code}>
            {intact && Icon ? (
              <span
                className="absolute flex items-center justify-center text-white"
                style={{
                  left: iconPos.x,
                  top: iconPos.y,
                  width: iconSize,
                  height: iconSize,
                  transform: 'translate(-50%, -50%)',
                }}
                title={title}
              >
                <Icon className="h-full w-full" strokeWidth={2.4} aria-hidden="true" />
              </span>
            ) : null}
            <span
              className={[
                'absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold tabular-nums',
                intact ? 'text-violet-900' : 'text-gray-400',
              ].join(' ')}
              style={{ left: scorePos.x, top: scorePos.y }}
              title={`${title}: ${score}`}
            >
              {score}
            </span>
          </div>
        );
      })}

      <div className="absolute inset-0 flex items-center justify-center">
        <Sprout
          className="h-7 w-7 text-emerald-500"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function FlowRingDetailCard({ flowRing, hills = [], compact = false }) {
  if (!flowRing) return null;

  const complete = Boolean(flowRing.complete);
  const hillsAtFoundation = flowRing.hillsAtFoundation ?? 0;
  const hillsTotal = flowRing.hillsTotal ?? 7;
  const below = (hills ?? []).filter(
    (h) => (h.score ?? 0) < FLOW_RING_FOUNDATION_THRESHOLD,
  );

  if (compact) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-violet-100 bg-white px-1.5 py-3 shadow-sm">
        <p className="px-1 text-center text-[10px] font-bold uppercase tracking-wide text-violet-500">
          Flow Ring
        </p>
        <div className="mt-1 origin-top scale-[0.92]">
          <FlowRingDetailed hills={hills} size={118} />
        </div>
        {complete ? null : (
          <p className="mt-0.5 px-1 text-center text-[9px] leading-snug text-violet-500">
            Grey = below 40
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <Sprout className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
            Flow Ring
          </p>
          <p className="font-display text-lg font-semibold leading-tight text-violet-950">
            {complete ? 'Complete' : 'Unbalanced'}
          </p>
          <p className="mt-0.5 text-[11px] text-violet-600">
            {hillsAtFoundation}/{hillsTotal} hills at {FLOW_RING_FOUNDATION_THRESHOLD}+
          </p>
        </div>
      </div>

      <FlowRingDetailed hills={hills} />

      {complete ? null : (
        <p className="mt-1 text-center text-[11px] text-violet-600">
          Grey cracked pieces are below 40
          {below.length
            ? ` · ${below.map((h) => `${formatHillTitle(h)} ${Math.round(h.score ?? 0)}`).join(' · ')}`
            : ''}
        </p>
      )}
    </section>
  );
}

export function FlowRingCard({ flowRing, hills = [], compact = false }) {
  if (!flowRing) return null;

  const complete = Boolean(flowRing.complete);
  const hillsAtFoundation = flowRing.hillsAtFoundation ?? 0;
  const hillsTotal = flowRing.hillsTotal ?? 7;
  const size = compact ? 104 : 140;
  const strokeWidth = compact ? 11 : 13;

  const ring = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <SegmentedFlowRing
        hills={hills}
        size={size}
        strokeWidth={strokeWidth}
        complete={complete}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Sprout
          className={[
            compact ? 'h-5 w-5' : 'h-6 w-6',
            complete ? 'text-emerald-500' : 'text-violet-400',
          ].join(' ')}
          aria-hidden="true"
        />
        <span
          className={[
            'font-bold',
            compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs',
            complete ? 'text-emerald-700' : 'text-violet-700',
          ].join(' ')}
        >
          {hillsAtFoundation}/{hillsTotal}
        </span>
      </div>
    </div>
  );

  const body = (
    <div className={compact ? 'mt-2 min-w-0 flex-1 text-center' : 'min-w-0 flex-1 text-center'}>
      <p
        className={[
          'font-semibold uppercase tracking-wide text-gray-500',
          compact ? 'text-[10px]' : 'text-xs',
        ].join(' ')}
      >
        Flow Ring™
      </p>
      <p
        className={[
          'font-display font-semibold text-slate-900',
          compact ? 'mt-0.5 text-sm leading-tight' : 'mt-1 text-xl',
        ].join(' ')}
      >
        {complete ? 'Complete' : 'Unbalanced'}
      </p>
    </div>
  );

  if (compact) {
    return (
      <section className="flex h-full flex-col items-center rounded-3xl border border-violet-100 bg-white px-2 py-4 shadow-sm">
        {ring}
        {body}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col items-center gap-3">
        {ring}
        {body}
      </div>
    </section>
  );
}
