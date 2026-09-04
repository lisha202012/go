// Wraps the mobile-first app so desktop browsers see an intentional
// "phone" presentation instead of a tiny column floating in empty space.
// On actual phones (viewport < 768px) this renders as a plain full-bleed
// passthrough — zero visual change from what's already built.

export default function DesktopShell({ children }) {
  const appUrl = typeof window !== 'undefined' ? window.location.href : '';
  const qrSrc = appUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
        appUrl,
      )}`
    : null;

  return (
    <div
      className="
        min-h-dvh w-full bg-white
        md:flex md:items-center md:justify-center md:p-8
        md:bg-gradient-to-br md:from-purple-100 md:via-fuchsia-50 md:to-amber-50
      "
    >
      {/* Desktop-only side panel */}
      <div className="hidden md:flex md:flex-col md:items-center md:mr-14 md:max-w-xs text-center">
        <p className="font-serif text-2xl font-bold text-purple-900 mb-3">
          GOFAM GROW is best on your phone
        </p>
        <p className="text-sm text-purple-600/80 mb-6">
          Scan this with your phone's camera to open it full-screen, or keep
          exploring right here in the preview.
        </p>
        {qrSrc && (
          <img
            src={qrSrc}
            alt="Scan to open GOFAM GROW on your phone"
            width={160}
            height={160}
            className="rounded-xl border border-purple-100 bg-white p-2 shadow-md"
          />
        )}
      </div>

      {/* The real app — untouched on phones, framed on desktop */}
      <div
        className="
          relative w-full min-h-dvh bg-white
          md:h-[844px] md:w-[390px] md:min-h-0
          md:overflow-hidden md:rounded-[2.5rem]
          md:border-8 md:border-neutral-900 md:shadow-2xl
        "
      >
        {/* Notch — desktop only */}
        <div
          className="
            hidden md:block md:absolute md:left-1/2 md:top-0
            md:z-20 md:h-6 md:w-32 md:-translate-x-1/2
            md:rounded-b-2xl md:bg-neutral-900
          "
        />
        <div className="h-full w-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
