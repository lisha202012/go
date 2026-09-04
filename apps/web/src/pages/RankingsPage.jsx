import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const STANDARD_OPTIONS = ['Any', 'Pre-K', '1–12', 'UG', 'PG'];

function sortCountries(countries = []) {
  return [...countries].sort((a, b) => {
    const aIsIndia = String(a?.code || a?.id || '').toUpperCase() === 'IN';
    const bIsIndia = String(b?.code || b?.id || '').toUpperCase() === 'IN';
    if (aIsIndia !== bIsIndia) return aIsIndia ? -1 : 1;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

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

function buildWhereScope({ countryId, stateId, cityId, organizationId }) {
  if (organizationId) return 'organization';
  if (cityId) return 'city';
  if (stateId) return 'state';
  if (countryId) return 'country';
  return 'world';
}

export default function RankingsPage() {
  const [overview, setOverview] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [nearbyLeaderboard, setNearbyLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [schoolResults, setSchoolResults] = useState([]);
  const [schoolStandard, setSchoolStandard] = useState('Any');
  const [schoolSection, setSchoolSection] = useState('');
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showAddCityInput, setShowAddCityInput] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [who, setWho] = useState('all');
  const [filterPanel, setFilterPanel] = useState('who');
  const [ageGroup, setAgeGroup] = useState('');
  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  const requestParams = useMemo(() => {
    const selectedCountry = countries.find((country) => country.id === countryId);
    const selectedState = states.find((state) => state.id === stateId);
    const selectedCity = cities.find((city) => city.id === cityId);
    const params = {
      who,
      where: buildWhereScope({ countryId, stateId, cityId, organizationId }),
      ...(who === 'specificCategory' && ageGroup ? { ageGroup } : {}),
      ...(countryId ? { countryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(selectedCountry ? { countryName: selectedCountry.name } : {}),
      ...(selectedState ? { stateName: selectedState.name } : {}),
      ...(selectedCity ? { cityName: selectedCity.name } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(schoolStandard && schoolStandard !== 'Any' ? { schoolStandard } : {}),
      ...(schoolSection ? { schoolSection } : {}),
    };
    return params;
  }, [who, ageGroup, countryId, stateId, cityId, organizationId, schoolStandard, countries, states, cities]);

  async function load() {
    setLoading(true);
    try {
      const [overviewData, leaderboardData] = await Promise.all([
        api.getFlowLeadership(requestParams),
        api.getLeadershipLeaderboard(requestParams),
      ]);
      setOverview(overviewData);
      setLeaderboard(leaderboardData.entries ?? []);
      setNearbyLeaderboard(leaderboardData.nearbyEntries ?? []);
    } catch (err) {
      console.error(err);
      setLeaderboard([]);
      setNearbyLeaderboard([]);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }

  async function applyFilters() {
    setApplyingFilters(true);
    try {
      await load();
    } finally {
      setApplyingFilters(false);
    }
  }

  useEffect(() => {
    void load();
  }, [requestParams]);

  useEffect(() => {
    api.getGeoCountries().then((res) => setCountries(sortCountries(res.countries ?? []))).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId('');
      setCities([]);
      setCityId('');
      return;
    }
    const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
    api.getGeoStates(countryName)
      .then((res) => setStates(res.states ?? []))
      .catch(() => setStates([]));
  }, [countryId, countries]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId('');
      return;
    }
    const countryName = countries.find((country) => country.id === countryId)?.name ?? countryId;
    const stateName = states.find((state) => state.id === stateId)?.name ?? stateId;
    api.getGeoCities(countryName, stateName)
      .then((res) => setCities(res.cities ?? []))
      .catch(() => setCities([]));
  }, [stateId, countryId, countries, states]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const countryName = countries.find((country) => country.id === countryId)?.name;
        const stateName = states.find((state) => state.id === stateId)?.name;
        const cityName = cities.find((city) => city.id === cityId)?.name;
        const res = await api.getSchoolOptions({ countryName, stateName, cityName });
        if (!cancelled) setSchoolOptions(res.options ?? []);
      } catch {
        if (!cancelled) setSchoolOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countries, states, cities, countryId, stateId, cityId]);

  const handleSchoolSelect = (org) => {
    setSelectedSchool(org);
    setOrganizationId(org.id);
    setSchoolStandard(org.standard || 'Any');
    setSchoolSection(org.section || '');
  };

  const clearSchool = () => {
    setSelectedSchool(null);
    setOrganizationId('');
    setSchoolStandard('Any');
    setSchoolSection('');
  };

  const handleFilterPanelChange = (panel) => {
    if (panel === 'who') {
      setCountryId('');
      setStateId('');
      setCityId('');
      setCountryOpen(false);
      clearSchool();
    }
    setFilterPanel(panel);
  };

  const handleAddCity = async () => {
    if (!stateId || !cityDraft.trim()) return;
    setSavingCity(true);
    try {
      const res = await api.addCity(stateId, cityDraft.trim());
      const createdCity = res.city;
      if (createdCity) {
        setCityId(createdCity.id);
        setCities((prev) => [...prev.filter((c) => c.id !== createdCity.id), createdCity].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowAddCityInput(false);
      setCityDraft('');
    } catch (err) {
      window.alert(err.message || 'Could not add city');
    } finally {
      setSavingCity(false);
    }
  };

  if (initialLoading && !overview) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-2xl bg-violet-900/30" />
        <div className="h-36 rounded-2xl bg-violet-900/20" />
      </div>
    );
  }

  const score = overview?.score ?? 0;
  const selectedCountry = countries.find((country) => country.id === countryId);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-500">🏆 FLOW LEADERSHIP</p>
            <p className="mt-1 text-4xl font-display font-bold tabular-nums">{score}</p>
            <p className="mt-2 text-sm text-violet-600">{overview?.publicMessage}</p>
          </div>
          <div className="text-right">
            <Link to="/profile" className="text-sm font-semibold text-violet-700">Back to profile</Link>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 rounded-xl border border-violet-200 bg-violet-50 p-1">
            {[
              ['who', 'Who'],
              ['where', 'Where'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleFilterPanelChange(value)}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-semibold transition',
                  filterPanel === value
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-violet-700 hover:bg-white',
                ].join(' ')}
                aria-pressed={filterPanel === value}
              >
                {label}
              </button>
            ))}
          </div>

          {filterPanel === 'who' ? <div>
            <p className="text-[10px] font-semibold uppercase text-violet-500">WHO</p>
            <select
              value={who}
              onChange={(e) => {
                const value = e.target.value;
                setWho(value);
                setAgeGroup('');
              }}
              className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
            >
              <option value="category">My Category ({overview?.who?.label || 'My Category'})</option>
              <option value="all">All GOFAM</option>
            </select>
          </div> : null}

          {filterPanel === 'where' ? <>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <p className="text-[10px] font-semibold uppercase text-violet-500">Country</p>
              <div className="relative mt-1">
                <button type="button" onClick={() => setCountryOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-sm text-slate-900" aria-haspopup="listbox" aria-expanded={countryOpen}>
                  <span className="flex items-center gap-2">{selectedCountry ? <CountryFlag country={selectedCountry} /> : null}{selectedCountry?.name || 'Any'}</span>
                  <span aria-hidden="true">{countryOpen ? '▴' : '▾'}</span>
                </button>
                {countryOpen ? (
                  <div role="listbox" aria-label="Country" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-violet-200 bg-white py-1 shadow-lg">
                    <button type="button" role="option" aria-selected={!countryId} onClick={() => { setCountryId(''); setStateId(''); setCityId(''); setCountryOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-violet-50">Any</button>
                    {countries.map((country) => (
                      <button key={country.id} type="button" role="option" aria-selected={country.id === countryId} onClick={() => { setCountryId(country.id); setStateId(''); setCityId(''); setCountryOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 hover:bg-violet-50">
                        <CountryFlag country={country} />{country.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>

            <label className="block">
              <p className="text-[10px] font-semibold uppercase text-violet-500">State</p>
              <select
                value={stateId}
                onChange={(e) => {
                  setStateId(e.target.value);
                  setCityId('');
                }}
                disabled={!countryId}
                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-violet-50"
              >
                <option value="">Any</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>{state.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <p className="text-[10px] font-semibold uppercase text-violet-500">City</p>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                disabled={!stateId}
                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-violet-50"
              >
                <option value="">Any</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
                {stateId ? <option value="__add__">── Not in the list? ──</option> : null}
              </select>
              {stateId && cityId === '__add__' ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value)}
                    placeholder="Type your city"
                    className="w-full rounded-xl border border-violet-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddCity}
                    disabled={savingCity || !cityDraft.trim()}
                    className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </label>
          </div>

          <div>
            <label className="block">
              <p className="text-[10px] font-semibold uppercase text-violet-500">School</p>
              <select
                value={selectedSchool ? `${selectedSchool.id}|${selectedSchool.standard || ''}|${selectedSchool.section || ''}` : ''}
                onChange={(e) => {
                  const option = schoolOptions.find((item) => `${item.id}|${item.standard || ''}|${item.section || ''}` === e.target.value);
                  if (option) handleSchoolSelect(option);
                  else clearSchool();
                }}
                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Any school</option>
                {schoolOptions.map((option) => (
                  <option key={`${option.id}|${option.standard}|${option.section}`} value={`${option.id}|${option.standard || ''}|${option.section || ''}`}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </> : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void applyFilters()}
              disabled={applyingFilters || loading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {applyingFilters ? 'Applying…' : 'Apply filters'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-violet-800">Your Ranks</h3>
        <p className="mt-2 text-xs text-violet-600">Where you rank among similar users.</p>
        <p className="mt-4 text-sm text-violet-500">No result</p>
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-violet-800">Leaderboard</h3>
          <span className="text-xs text-violet-500">{leaderboard.length} shown</span>
        </div>
        {leaderboard.length > 0 ? (
          <div className="mt-3 space-y-2">
            {leaderboard.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-sm">
                <span className="font-semibold text-violet-800">#{entry.rank} {entry.displayName || entry.username}</span>
                <span className="font-bold tabular-nums text-violet-700">{entry.flowLeadershipScore}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-violet-500">No result</p>}
        {nearbyLeaderboard.length > 0 ? (
          <>
            <h4 className="mt-5 text-sm font-semibold text-violet-800">Near your score ({score - 5}-{score + 5})</h4>
            <div className="mt-2 space-y-2">
              {nearbyLeaderboard.map((entry) => (
                <div key={`nearby-${entry.userId}`} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-violet-800">{entry.displayName || entry.username}</span>
                  <span className="font-bold tabular-nums text-violet-700">{entry.flowLeadershipScore}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
