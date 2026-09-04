import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { derivedCategoryLabel } from '../lib/deriveAgeFromDob';

function RankLine({ icon, label, rank }) {
  if (!rank) return null;
  return (
    <p className="flex items-center justify-between text-sm text-violet-800">
      <span>
        {icon} {label}
      </span>
      <span className="font-semibold tabular-nums text-violet-950">
        #{rank.rank}
        <span className="font-normal text-violet-500"> / {rank.total}</span>
      </span>
    </p>
  );
}

export function FlowLeadershipCard({ score: scoreProp, compact = false }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getFlowLeadership();
        if (!cancelled) setOverview(data);
      } catch {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const score = overview?.score ?? scoreProp ?? 0;
  const categoryCode = overview?.who?.value ?? overview?.who ?? null;
  const categoryLabel = derivedCategoryLabel(categoryCode) ?? 'My Category';

  if (loading && scoreProp == null) {
    return (
      <section className="gofam-game-card animate-pulse px-4 py-5">
        <div className="h-16 rounded-xl bg-violet-900/30" />
      </section>
    );
  }

  return (
    <section className={`gofam-game-card ${compact ? 'px-3 py-3' : 'px-4 py-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-400/90">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            FLOW Leadership
          </p>
          <p className="font-display text-4xl font-bold tabular-nums leading-none text-violet-50">
            {score}
          </p>
        </div>
        <div className="text-right text-xs text-violet-400">
          <p>WHO ▾ {categoryLabel}</p>
          {overview?.where?.city ? (
            <p className="mt-0.5">WHERE ▾ {overview.where.city}</p>
          ) : (
            <p className="mt-0.5">WHERE ▾ World</p>
          )}
        </div>
      </div>

      {!compact && overview?.ranks ? (
        <div className="mt-4 space-y-1.5 rounded-xl border border-violet-800/40 bg-violet-950/30 px-3 py-3">
          <RankLine icon="🏷️" label="My Category" rank={overview.ranks.category} />
          {overview.ranks.organization && overview.verifiedOrganization ? (
            <RankLine
              icon="🏫"
              label={overview.verifiedOrganization.name}
              rank={overview.ranks.organization}
            />
          ) : null}
          <RankLine icon="🏙️" label={overview.where.city ?? 'City'} rank={overview.ranks.city} />
          <RankLine icon="📍" label={overview.where.state ?? 'State'} rank={overview.ranks.state} />
          <RankLine icon="🇮🇳" label={overview.where.country ?? 'Country'} rank={overview.ranks.country} />
          <RankLine icon="🌍" label="World" rank={overview.ranks.world} />
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-snug text-violet-500/90">
        Reflects your FLOW, lifetime growth, and progress across all 7 Hills.
      </p>
    </section>
  );
}
