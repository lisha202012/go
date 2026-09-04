import { useEffect, useState } from 'react';
import { Building2, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../../../lib/api';

export function BelongingStep({ cityId, cityName, onDone, onSkip }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchOrganizations(q, cityId);
        if (!cancelled) setResults(res.organizations ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, cityId]);

  async function handleExpressInterest(orgId, orgName) {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const res = await api.expressOrganizationInterest(
        orgId ? { organizationId: orgId } : { organizationName: orgName },
      );
      setMessage(
        res.alreadyRegistered
          ? `You already registered interest (${res.interestCount} people total).`
          : `Interest recorded — ${res.interestCount} people want GOFAM at ${res.organizationName}. You are not a verified member yet.`,
      );
      setSelected(null);
      setQuery('');
      setResults([]);
    } catch (err) {
      setError(err.message || 'Could not register interest');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyMembership(org) {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const res = await api.requestOrganizationMembership({ organizationId: org.id });
      setMessage('Your request will be reviewed by the school admin.');
      setSelected(null);
      if (res?.message) {
        setMessage(res.message);
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      await api.deferBelonging();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
      onSkip();
    }
  }

  const trimmed = query.trim();
  const noResults = trimmed.length >= 2 && !searching && results.length === 0;

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <h2 className="font-display text-2xl font-semibold text-violet-900">
        Connect with your school
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
        Search your school or organization in {cityName ?? 'your city'}. Interest helps GOFAM partner
        with schools — official verification is reviewed by the school admin.
      </p>

      <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-violet-700">
        Search school name
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Don Bosco Egmore"
            className="w-full rounded-xl border border-violet-200 bg-white py-3 pl-10 pr-4 text-base text-violet-950"
          />
        </div>
      </label>

      {searching ? <p className="mt-3 text-sm text-violet-600">Searching…</p> : null}

      {results.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {results.map((org) => (
            <li
              key={org.id}
              className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-violet-950">{org.name}</p>
                  <p className="text-[11px] text-violet-600">{org.statusLabel}</p>
                  {org.interestCount > 0 && !org.isGofamVerified ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                      <Users className="h-3 w-3" />
                      {org.interestCount} interested — aggregate count only
                    </p>
                  ) : null}
                </div>
              </div>

              {org.isGofamVerified ? (
                <div className="mt-3">
                  {org.userMembershipStatus === 'verified' ? (
                    <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified member
                    </p>
                  ) : org.userMembershipStatus === 'pending' ? (
                    <p className="mt-2 text-center text-xs font-medium text-amber-700">
                      Verification pending — waiting on school admin
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleVerifyMembership(org)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white disabled:bg-emerald-300"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Request verification
                    </button>
                  )}
                </div>
              ) : org.userHasInterest ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">Interest registered ✓</p>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleExpressInterest(org.id)}
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900"
                >
                  Add my interest
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {noResults ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">
            {trimmed} — Not yet a GOFAM Verified School
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Are you part of this school? Registering interest only counts how many people want GOFAM
            here — your name is never shared with the school.
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleExpressInterest(null, trimmed)}
            className="mt-3 w-full rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white"
          >
            Add my interest
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={onDone}
        className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:bg-violet-300"
      >
        Continue to GOFAM
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={handleSkip}
        className="mt-3 w-full rounded-2xl border border-violet-200 px-5 py-3 text-sm font-semibold text-violet-700"
      >
        Add later
      </button>
    </section>
  );
}
