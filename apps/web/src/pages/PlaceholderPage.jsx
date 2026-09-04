export function PlaceholderPage({ title, path }) {
  return (
    <main className="flex min-h-dvh flex-col px-5 py-8">
      <p className="font-display text-sm font-semibold tracking-[0.18em] text-brand-moss uppercase">
        GOFAM GROW
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-brand-forest">{title}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-brand-forest/70">
        Placeholder route for <code className="rounded bg-brand-forest/5 px-1.5 py-0.5">{path}</code>.
        UI screens will be built in a later step.
      </p>
    </main>
  );
}
