const TABS = [
  { id: 'chakras', label: 'Chakras' },
  { id: 'climb', label: 'Climb' },
  { id: 'pulse', label: 'Pulse' },
];

export function JourneyTabRow({ activeTab, onChange, pulseIncomplete = false }) {
  return (
    <div className="flex gap-1 rounded-xl bg-violet-950/80 p-1 ring-1 ring-violet-500/20">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const highlight = tab.id === 'pulse' && pulseIncomplete;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'relative flex-1 rounded-lg px-2 py-2.5 text-xs font-semibold transition',
              active
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40'
                : 'text-violet-300 hover:text-violet-100',
            ].join(' ')}
          >
            {tab.label}
            {highlight && !active ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
