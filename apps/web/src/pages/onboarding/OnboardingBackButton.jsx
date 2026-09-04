export function OnboardingBackButton({ onClick, disabled = false }) {
  return (
    <div className="px-6 pt-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-100/80 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Go back"
      >
        <span aria-hidden="true">←</span>
        Back
      </button>
    </div>
  );
}
