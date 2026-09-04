import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GapHillBeginTransition } from '../../../components/GapHillBeginTransition';
import { GapHillJourneyMap } from '../../../components/GapHillJourneyMap';
import { GapHillJourneyView } from '../../../components/GapHillJourneyView';
import { api } from '../../../lib/api';
import { GAP_ANSWER_OPTIONS } from '../../../lib/gapAnswers';
import {
  buildHillProgress,
  enrichQuestionsWithHills,
  GAP_HILL_JOURNEY_ORDER,
  GAP_TOTAL_QUESTIONS,
} from '../../../lib/gapHillJourney';
import { HILL_LUCIDE } from '../../../lib/hillIcons';
import { HILL_RING_COLORS } from '../../../lib/hillRingColors';
import { useOnboardingStore } from '../../../store/useOnboardingStore';

const HILL_JOURNEY_SEEN_KEY = 'gofam-gap-hill-journey-seen';

function GapFlowLoader({ title, subtitle }) {
  return (
    <section
      className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 pb-10 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600"
          aria-hidden="true"
        />
        <span className="text-4xl" aria-hidden="true">
          🌊
        </span>
      </div>
      <h2 className="mt-8 font-display text-2xl font-semibold text-violet-900">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-violet-700/75">{subtitle}</p>
      <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full w-full animate-pulse rounded-full bg-violet-500" />
      </div>
    </section>
  );
}

export const GapAssessmentStep = forwardRef(function GapAssessmentStep({ onComplete }, ref) {
  const gapResponses = useOnboardingStore((s) => s.gapResponses);
  const upsertGapResponse = useOnboardingStore((s) => s.upsertGapResponse);

  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [hillsByCode, setHillsByCode] = useState({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [celebrateHillCode, setCelebrateHillCode] = useState(null);
  const [hillPopTokens, setHillPopTokens] = useState({});

  useImperativeHandle(
    ref,
    () => ({
      tryBack() {
        if (phase === 'questions' && index > 0) {
          setIndex((i) => i - 1);
          return true;
        }
        if (phase === 'questions' && index === 0) {
          setPhase('hill-journey');
          return true;
        }
        if (phase === 'begin-animation') {
          setPhase('hill-journey');
          return true;
        }
        return false;
      },
    }),
    [phase, index],
  );

  useEffect(() => {
    let cancelled = false;
    // Clear legacy intro flag from older builds.
    try {
      sessionStorage.removeItem('gofam-gap-intro-seen');
    } catch {
      /* ignore */
    }
    (async () => {
      setError('');
      try {
        const [{ questions: loaded }, { hills }] = await Promise.all([
          api.getGapQuestions(),
          api.getHills(),
        ]);
        if (cancelled) return;

        const enriched = enrichQuestionsWithHills(loaded ?? [], hills ?? []);
        setQuestions(enriched);

        const codeMap = {};
        for (const h of hills ?? []) {
          if (h.code) codeMap[h.code] = h;
        }
        setHillsByCode(codeMap);

        const stored = useOnboardingStore.getState().gapResponses;
        const firstUnanswered = enriched.findIndex(
          (q) => !stored.some((r) => r.questionId === q.id),
        );

        if (firstUnanswered > 0) {
          setIndex(firstUnanswered);
          setPhase('questions');
        } else if (sessionStorage.getItem(HILL_JOURNEY_SEEN_KEY)) {
          setPhase('questions');
        } else {
          setPhase('hill-journey');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load GAP questions');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const question = questions[index];
  const hillProgress = useMemo(
    () => buildHillProgress(questions, gapResponses),
    [questions, gapResponses],
  );
  const currentHillCode = question?.hill?.code ?? null;
  const currentAnswer = question
    ? gapResponses.find((r) => r.questionId === question.id)?.rawAnswer ?? null
    : null;
  const progressPct = questions.length ? ((index + 1) / questions.length) * 100 : 0;

  const finishBeginAnimation = useCallback(() => {
    sessionStorage.setItem(HILL_JOURNEY_SEEN_KEY, '1');
    setPhase('questions');
  }, []);

  function beginQuestions() {
    setPhase('begin-animation');
  }

  async function submitAll(finalResponses) {
    if (submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await api.submitGapAssessment(finalResponses);
      sessionStorage.removeItem(HILL_JOURNEY_SEEN_KEY);
      setCompleted(true);
      setTimeout(() => {
        onComplete(result);
      }, 1400);
    } catch (err) {
      setError(err.message || 'Could not submit assessment');
    } finally {
      setSubmitting(false);
    }
  }

  async function selectAnswer(rawAnswer) {
    if (!question || submitting || advancing) return;

    const progressBefore = buildHillProgress(questions, gapResponses);
    const hillCode = question.hill?.code;

    upsertGapResponse(question.id, rawAnswer);
    setAdvancing(true);

    await new Promise((resolve) => setTimeout(resolve, 320));

    const storedResponses = useOnboardingStore.getState().gapResponses;
    const progressAfter = buildHillProgress(questions, storedResponses);

    if (
      hillCode &&
      !progressBefore[hillCode]?.complete &&
      progressAfter[hillCode]?.complete
    ) {
      setHillPopTokens((prev) => ({
        ...prev,
        [hillCode]: (prev[hillCode] ?? 0) + 1,
      }));
      setCelebrateHillCode(hillCode);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setCelebrateHillCode(null);
    }

    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
      setAdvancing(false);
      return;
    }

    setAdvancing(false);

    if (storedResponses.length === GAP_TOTAL_QUESTIONS) {
      await submitAll(storedResponses);
    }
  }

  if (phase === 'loading') {
    return (
      <GapFlowLoader
        title="Preparing your GAP…"
        subtitle="Loading your assessment questions."
      />
    );
  }

  if (phase === 'error') {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <p className="text-sm text-rose-600">{error || 'Something went wrong'}</p>
      </section>
    );
  }

  if (phase === 'begin-animation') {
    return (
      <GapHillBeginTransition
        hillsByCode={hillsByCode}
        hillCode={GAP_HILL_JOURNEY_ORDER[0]}
        onComplete={finishBeginAnimation}
      />
    );
  }

  if (phase === 'hill-journey') {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
        <div className="mb-5 text-center">
          <h2 className="font-display text-2xl font-semibold text-violet-900">
            Tree of Life · 7 Hills
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-violet-800/80">
            5 questions from each hill, {GAP_TOTAL_QUESTIONS} in total. Answer honestly — there&apos;s no perfect
            score.
          </p>
        </div>

        <GapHillJourneyView
          hillsByCode={hillsByCode}
          startHillCode={GAP_HILL_JOURNEY_ORDER[0]}
        />

        <button
          type="button"
          onClick={beginQuestions}
          className="mt-6 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
        >
          Begin Step 1 · {GAP_HILL_JOURNEY_ORDER[0]}
        </button>
      </section>
    );
  }

  if (submitting) {
    return (
      <GapFlowLoader
        title="Calculating your FLOW…"
        subtitle="Scoring your answers across all 7 hills. This usually takes a few seconds."
      />
    );
  }

  if (completed) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 pb-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
          ✓
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold text-violet-900">
          GAP Assessment complete
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-violet-700/75">
          All {GAP_TOTAL_QUESTIONS} questions answered. Next: your Growth Report, strongest hill, focus
          hill, and first missions.
        </p>
        <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-violet-100">
          <div className="h-full w-full animate-pulse rounded-full bg-violet-500" />
        </div>
      </section>
    );
  }

  if (!question) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <p className="text-sm text-rose-600">{error || 'No questions available'}</p>
      </section>
    );
  }

  const HillIcon = currentHillCode ? HILL_LUCIDE[currentHillCode] : null;
  const hillAccent =
    question.hill?.colorTheme ??
    HILL_RING_COLORS[currentHillCode] ??
    '#7C3AED';

  return (
    <motion.section
      className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-2"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-semibold text-violet-600">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3">
          <GapHillJourneyMap
            variant="compact"
            hillsByCode={hillsByCode}
            progress={hillProgress}
            currentHillCode={currentHillCode}
            celebrateHillCode={celebrateHillCode}
            hillPopTokens={hillPopTokens}
          />
        </div>
      </div>

      <motion.div
        className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/60"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
      >
        {currentHillCode && HillIcon ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide text-white"
            style={{ backgroundColor: hillAccent }}
          >
            <HillIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {currentHillCode}
          </span>
        ) : null}
        <p className="mt-3 text-xs font-semibold tracking-wide text-violet-500 uppercase">
          Past 30 days
        </p>
        <p className="mt-2 font-display text-lg font-semibold leading-snug text-violet-900">
          {question.text}
        </p>
      </motion.div>

      <motion.div
        className="mt-5 space-y-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4, ease: 'easeOut' }}
      >
        {GAP_ANSWER_OPTIONS.map((option, optionIndex) => {
          const selected = currentAnswer === option.value;
          return (
            <motion.button
              key={option.value}
              type="button"
              disabled={submitting || advancing}
              onClick={() => selectAnswer(option.value)}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 + optionIndex * 0.05, duration: 0.35 }}
              className={[
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition',
                selected
                  ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-200/50 ring-2 ring-violet-300/60'
                  : 'border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/40',
                submitting || advancing ? 'cursor-not-allowed opacity-70' : '',
              ].join(' ')}
            >
              <span className="text-sm font-semibold text-violet-900">{option.label}</span>
              <span
                className={[
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                  selected
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-white text-transparent',
                ].join(' ')}
                aria-hidden="true"
              >
                ✓
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </motion.section>
  );
});
