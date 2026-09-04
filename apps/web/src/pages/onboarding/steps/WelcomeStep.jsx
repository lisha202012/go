export function WelcomeStep({ onNext }) {
  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-10 pt-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500" />
      <div className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 left-0 h-48 w-48 rounded-full bg-fuchsia-300/20 blur-2xl" />

      <div className="relative z-10 animate-fade-up text-white">
        <p className="font-display text-sm font-semibold tracking-[0.22em] uppercase opacity-90">
          GOFAM GROW
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">
          Master the Flow.
          <br />
          Share the Glow.
        </h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-violet-100">
          A personal growth journey for families — plant virtues, climb hills, and bloom together.
        </p>
        <button
          type="button"
          onClick={onNext}
          className="mt-10 w-full rounded-2xl bg-white px-5 py-3.5 text-base font-semibold text-violet-700 shadow-lg shadow-violet-950/20 transition hover:bg-violet-50 active:scale-[0.99]"
        >
          Get Started
        </button>
      </div>
    </section>
  );
}
