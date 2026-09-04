export function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            'h-2 rounded-full transition-all duration-300',
            i === current ? 'w-6 bg-violet-600' : i < current ? 'w-2 bg-violet-400' : 'w-2 bg-violet-200',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
