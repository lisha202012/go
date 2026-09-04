import { useEffect, useRef, useState } from 'react';
import { GlowSeedJourneyList, GLOW_SEED_JOURNEY } from '../../../components/GlowSeedJourneyList';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

const STEP_DELAY_MS = 550;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GlowSeedStep({ seedId, seedPreview, bloomedVirtue, onBloomed, onNext, updateUser, onProcessingChange }) {
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(bloomedVirtue ? 'done' : 'prompt');
  const [completedStepIds, setCompletedStepIds] = useState(
    bloomedVirtue ? GLOW_SEED_JOURNEY.map((s) => s.id) : [],
  );
  const [virtue, setVirtue] = useState(bloomedVirtue);
  const [hill, setHill] = useState(null);
  const [welcomeBonusAmount, setWelcomeBonusAmount] = useState(0);
  const [senderName, setSenderName] = useState(
    seedPreview?.sender?.username ? `@${seedPreview.sender.username}` : 'Coach Bala',
  );
  const autoAdvanceRef = useRef(null);

  useEffect(() => {
    if (seedPreview?.sender?.username) {
      setSenderName(`@${seedPreview.sender.username}`);
    }
  }, [seedPreview]);

  useEffect(() => {
    onProcessingChange?.(phase === 'processing');
  }, [phase, onProcessingChange]);

  useEffect(() => {
    return () => onProcessingChange?.(false);
  }, [onProcessingChange]);

  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  async function markStepsInBackground() {
    for (const step of GLOW_SEED_JOURNEY) {
      await delay(STEP_DELAY_MS);
      setCompletedStepIds((prev) => (prev.includes(step.id) ? prev : [...prev, step.id]));
    }
  }

  async function handleAccept() {
    setError('');
    setPhase('processing');
    setCompletedStepIds([]);

    try {
      const result = await api.acceptGlowSeed(seedId);
      setVirtue(result.virtue);
      setHill(result.hill ?? null);
      setWelcomeBonusAmount(result.welcomeBonusGranted ? result.welcomeBonusAmount : 0);
      onBloomed(result.virtue);

      if (result.user && updateUser) {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          updateUser({ ...currentUser, ...result.user });
        }
      }

      await markStepsInBackground();
      setPhase('done');

      autoAdvanceRef.current = setTimeout(() => {
        onNext();
      }, 1200);
    } catch (err) {
      setPhase('prompt');
      setCompletedStepIds([]);
      setError(err.message || 'Could not accept seed');
    }
  }

  function handleSkipAutoAdvance() {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    onNext();
  }

  const activeStepId =
    phase === 'processing'
      ? GLOW_SEED_JOURNEY.find((step) => !completedStepIds.includes(step.id))?.id ?? null
      : null;

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
      <h2 className="font-display text-2xl font-semibold text-violet-900">Receive GLOW Seed?</h2>
      <p className="mt-2 text-sm text-violet-800/70">
        Someone planted growth in your garden — accept it to begin together.
      </p>

      <div className="mt-6 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-600/30">
        {phase === 'prompt' ? (
          <>
            <p className="text-sm font-medium text-violet-100">Invitation waiting</p>
            <p className="mt-2 font-display text-2xl font-semibold leading-snug">
              {senderName} planted a GLOW Seed for you
            </p>
            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={handleAccept}
                className="w-full rounded-2xl bg-white px-5 py-3.5 text-base font-semibold text-violet-700 transition hover:bg-violet-50"
              >
                Yes, accept seed
              </button>
              <button
                type="button"
                onClick={onNext}
                className="w-full rounded-2xl border border-white/40 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Not now
              </button>
            </div>
          </>
        ) : null}

        {phase === 'processing' || phase === 'done' ? (
          <div className="py-2">
            <p className="text-sm font-medium text-violet-100">
              {phase === 'processing' ? 'Working in the background…' : 'All set!'}
            </p>
            <p className="mt-2 font-display text-xl font-semibold leading-snug">
              {phase === 'processing'
                ? `Activating ${senderName}'s GLOW Seed`
                : `${virtue} is now active`}
            </p>

            <div className="mt-6">
              <GlowSeedJourneyList
                variant="done"
                completedIds={completedStepIds}
                activeId={activeStepId}
              />
            </div>

            {phase === 'done' && virtue ? (
              <div className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm text-violet-50">
                <p>
                  <span className="font-semibold">{virtue}</span> bloomed
                  {welcomeBonusAmount > 0 ? ` · +${welcomeBonusAmount} Growth Coins` : ''}
                </p>
                {hill ? (
                  <p className="mt-1 text-violet-100/90">
                    {hill.name} glows for you and {senderName} until month-end.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {phase === 'prompt' ? (
        <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-violet-500 uppercase">
            What happens when you accept
          </p>
          <div className="mt-3">
            <GlowSeedJourneyList variant="preview" />
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {phase === 'done' ? (
        <button
          type="button"
          onClick={handleSkipAutoAdvance}
          className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
        >
          Continue now
        </button>
      ) : (
        <p className="mt-auto text-center text-xs text-violet-700/60">
          {phase === 'processing' ? 'Please wait — do not close this screen.' : null}
        </p>
      )}
    </section>
  );
}
