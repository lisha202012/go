import { TreeGrowthGuide } from './TreeGrowthGuide';
import { getTreeStage } from '../lib/treeStages';
import { describeTreeProgress } from '../lib/treeGrowth';

export function MyJourneySection({ journey, loading, focusHill }) {
  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-violet-950">My Journey</h2>
        <div className="h-28 animate-pulse rounded-2xl bg-violet-100/60" />
      </section>
    );
  }

  if (!journey) return null;

  const progress = describeTreeProgress(journey);
  const stageArt = getTreeStage(journey.treeLevel ?? 1);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-violet-950">My Journey</h2>
        <p className="text-xs text-violet-600">Your tree and how to level it up</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-emerald-200 shadow-sm">
        <div className="relative h-32 w-full overflow-hidden">
          <img
            src={stageArt.bg}
            alt=""
            className="h-full w-full object-cover object-[center_40%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-xs font-medium text-emerald-100">Your tree today</p>
            <p className="font-display text-lg font-semibold text-white">
              Level {progress.level} · {progress.stage}
            </p>
          </div>
        </div>
      </div>

      <TreeGrowthGuide journey={journey} focusHill={focusHill} />
    </section>
  );
}
