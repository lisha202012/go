import { useEffect, useState } from 'react';
import { Building2, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { BringGofamToSchoolCard } from './BringGofamToSchoolCard';

export function BelongingSection({ user }) {
  const [overview, setOverview] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [interestSuccess, setInterestSuccess] = useState(null);
  const [standard, setStandard] = useState(user?.standard ?? '');
  const [savingStandard, setSavingStandard] = useState(false);

  async function load() {
    try {
      const data = await api.getBelongingOverview();
      setOverview(data);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setStandard(user?.standard ?? '');
  }, [user?.standard]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !overview?.location?.cityId) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchOrganizations(q, overview.location.cityId);
        if (!cancelled) setResults(res.organizations ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, overview?.location?.cityId]);

  async function handleStandardSave(value) {
    const nextValue = value.trim();
    if (!nextValue && user?.standard == null) return;
    setSavingStandard(true);
    try {
      await api.patchMe({ standard: nextValue || undefined });
      setStandard(nextValue);
    } catch (err) {
      window.alert(err.message || 'Could not update standard');
      setStandard(user?.standard ?? '');
    } finally {
      setSavingStandard(false);
    }
  }

  async function handleExpressInterest(organizationId, organizationName) {
    setBusy(true);
    setFeedback('');
    setInterestSuccess(null);
    try {
      const res = await api.expressOrganizationInterest(
        organizationId ? { organizationId } : { organizationName },
      );
      setFeedback(res.message);
      setInterestSuccess({
        organizationName: res.organizationName,
        interestCount: res.interestCount,
      });
      setQuery('');
      setResults([]);
      await load();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!overview?.location?.cityId) {
    return (
      <section id="belonging" className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-violet-600" />
          <h2 className="font-display text-base font-semibold text-violet-950">Verified Belonging</h2>
        </div>
        <p className="mt-2 text-sm text-violet-600">
          Add your{' '}
          <a href="#location" className="font-semibold text-violet-800 underline">
            personal location
          </a>{' '}
          first to search schools and register interest.
        </p>
      </section>
    );
  }

  const activeMembership = overview.memberships?.find((m) => m.isActive && m.status === 'verified');
  const trimmedQuery = query.trim();
  const noResults = trimmedQuery.length >= 2 && results.length === 0;

  return (
    <section id="belonging" className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-violet-600" />
        <h2 className="font-display text-base font-semibold text-violet-950">Verified Belonging</h2>
      </div>
      <p className="mt-1 text-xs text-violet-600">
        {overview.location.city}, {overview.location.state} — only verified members appear on school
        leaderboards.
      </p>

      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
            Standard / Class
          </span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              onBlur={(e) => void handleStandardSave(e.target.value)}
              placeholder="e.g. 8, UG, Pre-K"
              maxLength={20}
              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-violet-900"
            />
            <button
              type="button"
              disabled={savingStandard}
              onClick={() => void handleStandardSave(standard)}
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingStandard ? 'Saving…' : 'Save'}
            </button>
          </div>
        </label>
      </div>

      {activeMembership ? (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <ShieldCheck className="mb-1 inline h-4 w-4" /> Verified at{' '}
          <span className="font-semibold">{activeMembership.organizationName}</span>
        </div>
      ) : null}

      {overview.interests?.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-violet-700">
          {overview.interests.slice(0, 3).map((i) => (
            <li key={i.id} className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Interest: {i.organizationName}
              {i.interestCount != null ? ` (${i.interestCount} total)` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {interestSuccess ? (
        <BringGofamToSchoolCard
          organizationName={interestSuccess.organizationName}
          interestCount={interestSuccess.interestCount}
          onDismiss={() => setInterestSuccess(null)}
        />
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search school to verify or register interest"
        className="mt-4 w-full rounded-xl border border-violet-200 px-3 py-2 text-sm"
      />

      {noResults ? (
        <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm">
          <p className="font-semibold text-violet-900">{trimmedQuery}</p>
          <p className="text-[11px] text-violet-500">Not yet a GOFAM Verified School.</p>
          <p className="mt-1 text-xs text-violet-700">Are you part of this school?</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExpressInterest(null, trimmedQuery)}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Add my interest
          </button>
        </div>
      ) : null}

      {results.slice(0, 5).map((org) => (
        <div key={org.id} className="mt-2 rounded-lg border border-violet-100 p-2 text-sm">
          <p className="font-semibold text-violet-900">{org.name}</p>
          <p className="text-[11px] text-violet-500">{org.statusLabel}</p>
          {org.interestCount > 0 ? (
            <p className="text-[10px] text-violet-400">{org.interestCount} interested (aggregate)</p>
          ) : null}
          {org.isGofamVerified ? (
            org.userMembershipStatus === 'verified' ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Verified member</p>
            ) : org.userMembershipStatus === 'pending' ? (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Verification pending — waiting on school admin
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setFeedback('');
                  try {
                    const res = await api.requestOrganizationMembership({ organizationId: org.id });
                    setFeedback(
                      `Verification pending for ${org.name} — the school admin will review your request.`,
                    );
                    await load();
                  } catch (err) {
                    setFeedback(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-1 text-xs font-semibold text-violet-700"
              >
                Request verification
              </button>
            )
          ) : org.canExpressInterest ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleExpressInterest(org.id)}
              className="mt-1 text-xs font-semibold text-amber-800"
            >
              Add my interest
            </button>
          ) : org.userHasInterest ? (
            <p className="mt-1 text-xs text-violet-500">You registered interest</p>
          ) : null}
        </div>
      ))}

      {feedback && !interestSuccess ? (
        <p className="mt-2 text-xs text-violet-700">{feedback}</p>
      ) : null}
    </section>
  );
}
