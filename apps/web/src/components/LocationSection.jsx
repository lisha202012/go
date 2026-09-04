import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api, SessionExpiredError } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

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

export function LocationSection({ user, onSaved }) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const [editing, setEditing] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countriesRes, belonging] = await Promise.all([
          api.getGeoCountries(),
          user?.cityId ? api.getBelongingOverview().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCountries(sortCountries(countriesRes.countries ?? []));
        const loc = belonging?.location;
        if (loc?.city) {
          setLocationLabel([loc.city, loc.state, loc.country].filter(Boolean).join(', '));
        }
      } finally {
        if (!cancelled) setLoadingGeo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.cityId]);

  useEffect(() => {
    if (!editing) return;
    // Only initialize on first edit, don't reset when geo arrays change
    setCountryId(user?.countryId ?? '');
    setStateId(user?.stateId ?? '');
    setCityId(user?.cityId ?? '');
  }, [editing, user?.countryId, user?.stateId, user?.cityId]);

  useEffect(() => {
    if (!editing || !countryId) {
      if (!editing) return;
      setStates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
      const result = await api.getGeoStates(countryName);
      if (!cancelled) setStates(result.states ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, countryId, countries]);

  useEffect(() => {
    if (!editing || !stateId) {
      if (!editing) return;
      setCities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
      const stateName = states.find((state) => state.id === stateId)?.name ?? stateId;
      const result = await api.getGeoCities(countryName, stateName);
      if (!cancelled) setCities(result.cities ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, countryId, stateId, countries, states]);

  function handleCountryChange(nextCountryId) {
    setCountryId(nextCountryId);
    setStateId('');
    setCityId('');
  }

  function handleStateChange(nextStateId) {
    setStateId(nextStateId);
    setCityId('');
  }

  function handleCityChange(nextCityId) {
    setCityId(nextCityId);
  }

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
      updateUser(result.user);
      const belonging = await api.getBelongingOverview().catch(() => null);
      const loc = belonging?.location;
      if (loc?.city) {
        setLocationLabel([loc.city, loc.state, loc.country].filter(Boolean).join(', '));
      }
      setEditing(false);
      onSaved?.(result.user);
      window.dispatchEvent(new CustomEvent('gofam_location_updated'));
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

  const hasLocation = Boolean(user?.cityId && locationLabel);
  const selectedCountry = countries.find((country) => country.id === countryId);

  return (
    <section id="location" className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-violet-600" />
          <h2 className="font-display text-base font-semibold text-violet-950">Personal location</h2>
        </div>
        {!editing && !loadingGeo ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-violet-700"
          >
            {hasLocation ? 'Update' : 'Add'}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-violet-600">
        Used for local FLOW Leadership rankings. Update when you move.
      </p>

      {loadingGeo ? (
        <p className="mt-3 text-sm text-violet-500">Loading…</p>
      ) : editing ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
            Country
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setCountryOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-sm text-violet-950"
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
                        handleCountryChange(country.id);
                        setCountryOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-violet-950 hover:bg-violet-50"
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
              onChange={(e) => handleStateChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-violet-950 disabled:bg-violet-50 disabled:text-violet-400"
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
              onChange={(e) => handleCityChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-violet-950 disabled:bg-violet-50 disabled:text-violet-400"
            >
              <option value="">{stateId ? 'Select city' : 'Select a state first'}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!cityId || submitting}
              onClick={handleSave}
              className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white disabled:bg-violet-300"
            >
              {submitting ? 'Saving…' : 'Save location'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setEditing(false);
                setError('');
              }}
              className="rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasLocation ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{locationLabel}</p>
      ) : (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-600">
          No location saved yet. Add your city to unlock local FLOW ranking and org checks.
        </p>
      )}
    </section>
  );
}
