import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Spec: do not show WHY automatically under every mission — keep the card light.
 * Tap WHY? to reveal the coaching line from the Mission Engine doc.
 */
export function MissionWhyDisclosure({ whyText, className = '' }) {
  const [open, setOpen] = useState(false);
  const text = typeof whyText === 'string' ? whyText.trim() : '';
  if (!text) return null;

  return (
    <div className={['rounded-xl border border-violet-500/20 bg-violet-950/40', className].join(' ')}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-violet-300">
          Why?
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-violet-400 transition ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <p className="border-t border-violet-500/15 px-3 pb-2.5 pt-2 text-sm leading-relaxed text-violet-200/90">
          {text}
        </p>
      ) : null}
    </div>
  );
}
