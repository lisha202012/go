import { useEffect, useState } from 'react';
import { api, SessionExpiredError } from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

function CountryFlag({ country }) {
  const code = String(country?.code || country?.id || '').toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      alt={String(country?.code || country?.id || '').toUpperCase()}
      width="24"
      height="18"
      className="h-[18px] w-6 shrink-0 rounded-sm object-cover"
    />
  );
}

function sortCountries(countries = []) {
  return [...countries].sort((a, b) => {
    const aIsIndia = String(a?.code || '').toUpperCase() === 'IN';
    const bIsIndia = String(b?.code || '').toUpperCase() === 'IN';
    if (aIsIndia !== bIsIndia) return aIsIndia ? -1 : 1;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

export function LocationStep({ onSaved, onSkip }) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getGeoCountries();
        if (!cancelled) setCountries(sortCountries(result.countries ?? []));
      } catch {
        /* optional step */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId('');
      setCityId('');
      return;
    }
    let cancelled = false;
    (async () => {
      const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
      const result = await api.getGeoStates(countryName);
      if (!cancelled) {
        setStates(result.states ?? []);
        setStateId('');
        setCityId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId, countries]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId('');
      setCityQuery('');
      return;
    }
    let cancelled = false;
    (async () => {
      const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
      const stateName = states.find((state) => state.id === stateId)?.name ?? stateId;
      const result = await api.getGeoCities(countryName, stateName);
      if (!cancelled) {
        setCities(result.cities ?? []);
        setCityId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateId, countryId, countries, states]);

  async function handleSave() {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchLocation({
        countryId,
        stateId,
        cityId,
        countryName: selectedCountry?.name,
        stateName: states.find((state) => state.id === stateId)?.name,
        cityName: cities.find((city) => city.id === cityId)?.name,
      });
      onSaved(result.user);
    } catch (err) {
      if (err instanceof SessionExpiredError || err.status === 401) {
        useAuthStore.getState().clearAuth();
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Could not save location');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      await api.deferLocation();
      onSkip();
    } catch {
      onSkip();
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCountry = countries.find((country) => country.id === countryId);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <h2 className="font-display text-2xl font-semibold text-violet-900">
        Where do you currently live?
      </h2>
      <p className="mt-2 text-sm text-violet-800/70">
        This helps GOFAM show meaningful local rankings. You can update when you move.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-violet-600">Loading locations…</p>
      ) : (
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
            Country
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setCountryOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-white px-4 py-3 text-left text-base text-violet-950"
                aria-haspopup="listbox"
                aria-expanded={countryOpen}
              >
                <span className="flex items-center gap-2">
                  {selectedCountry ? <CountryFlag country={selectedCountry} /> : null}
                  {selectedCountry?.name || 'Select country'}
                </span>
                <span aria-hidden="true">{countryOpen ? '▴' : '▾'}</span>
              </button>
              {countryOpen ? (
                <div
                  role="listbox"
                  aria-label="Country"
                  className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-violet-200 bg-white py-1 shadow-lg"
                >
                  {sortCountries(countries).map((country) => (
                    <button
                      key={country.id}
                      type="button"
                      role="option"
                      aria-selected={country.id === countryId}
                      onClick={() => {
                        setCountryId(country.id);
                        setStateId('');
                        setCityId('');
                        setCountryOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-base text-violet-950 hover:bg-violet-50"
                    >
                      <CountryFlag country={country} />
                      {country.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
            State
            <select
              value={stateId}
              disabled={!countryId}
              onChange={(e) => {
                setStateId(e.target.value);
                setCityId('');
              }}
              className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base text-violet-950 disabled:bg-violet-50 disabled:text-violet-400"
            >
              <option value="">{countryId ? 'Select state' : 'Select a country first'}</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
            City
            <select
              value={cityId}
              disabled={!stateId}
              onChange={(e) => setCityId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base text-violet-950 disabled:bg-violet-50 disabled:text-violet-400"
            >
              <option value="">{stateId ? 'Select city' : 'Select a state first'}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={!cityId || submitting}
        onClick={handleSave}
        className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:bg-violet-300"
      >
        {submitting ? 'Saving…' : 'Save location'}
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
