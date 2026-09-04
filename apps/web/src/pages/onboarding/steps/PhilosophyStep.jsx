export function PhilosophyStep({ onNext }) {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      {/* Lottie can replace this fade-in garden illustration later */}
      <div className="mx-auto mt-6 flex h-48 w-48 animate-fade-up items-center justify-center rounded-full bg-gradient-to-br from-violet-200 via-fuchsia-100 to-amber-100 shadow-inner">
        <div className="h-28 w-28 rounded-full bg-gradient-to-t from-violet-600 to-violet-400 opacity-90 shadow-lg" />
      </div>

      <h2 className="mt-10 animate-fade-up font-display text-3xl font-semibold leading-snug text-violet-900 delay-100">
        Every Family Is a Garden.
        <br />
        Plant a Seed. Grow Greatness.
      </h2>
      <p className="mt-4 animate-fade-up text-sm leading-relaxed text-violet-800/70 delay-200">
        Grow through seven hills of virtue. Share GLOW Seeds with people you love. Watch your Tree of
        Life flourish.
      </p>

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
