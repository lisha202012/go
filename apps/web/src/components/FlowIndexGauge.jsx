import { useId } from 'react';

export function FlowIndexGauge({ value = 0, size = 120, label = 'FLOW Index' }) {
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const stroke = size <= 110 ? 12 : 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const valueClass = size <= 110 ? 'text-2xl' : 'text-3xl';
  const labelClass = size <= 110 ? 'text-xs' : 'text-sm';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="45%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display font-semibold text-slate-900 ${valueClass}`}>
            {clamped}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
            / 100
          </span>
        </div>
      </div>
      {label ? (
        <p className={`font-medium text-gray-600 ${labelClass}`}>{label}</p>
      ) : null}
    </div>
  );
}
