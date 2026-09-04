import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { readAdminListParams } from '../../lib/adminPageNav';
import { useAuthStore } from '../../store/useAuthStore';
import {
  AdminBadge,
  AdminError,
  AdminExportButton,
  AdminFilterForm,
  AdminFilterInput,
  AdminFilterSelect,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminStatGrid,
  AdminTable,
  AdminTrendPanel,
  AdminQuickLinks,
} from '../../components/admin/AdminUi';
import { AdminDeleteUserModal } from '../../components/admin/AdminDeleteUserModal';

const MISSION_BASE = '/admin/mission-engine';
const JOURNEY_BASE = '/admin/journey';
const GLOW_BASE = '/admin/glow';
const USERS_BASE = '/admin/users';
const ORGS_BASE = '/admin/organizations';
const AUDIT_BASE = '/admin/audit';
const AVATAR_ASSETS_BASE = '/admin/avatar-assets';

function getFlagEmoji(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🌍';
  return String.fromCodePoint(
    ...normalized.split('').map((char) => 127397 + char.charCodeAt(0)),
  );
}

function sortCountries(countries = []) {
  return [...countries].sort((a, b) => {
    const aIsIndia = String(a?.code || a?.id || '').toUpperCase() === 'IN';
    const bIsIndia = String(b?.code || b?.id || '').toUpperCase() === 'IN';
    if (aIsIndia !== bIsIndia) return aIsIndia ? -1 : 1;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function cleanListParams(params) {
  const out = { page: params.page, pageSize: params.pageSize };
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || key === 'pageSize') continue;
    if (value !== '' && value != null && value !== false) out[key] = value;
  }
  if (params.flaggedOnly) out.flaggedOnly = '1';
  return out;
}

export function AvatarAssetsAdminPage() {
  const [searchParams] = useSearchParams();
  const avatarPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const avatarPageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 25));
  const avatarSearch = searchParams.get('search') || '';
  const avatarStatus = searchParams.get('status') || '';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', imageUrl: '', isActive: true });
  const [pendingUploads, setPendingUploads] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [pagination, setPagination] = useState(null);

  function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const maxFileSize = 5 * 1024 * 1024;
    const oversized = files.find((file) => file.size > maxFileSize);
    if (oversized) {
      setError('Each image must be 5 MB or smaller');
      event.target.value = '';
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 15 * 1024 * 1024) {
      setError('Selected images must be 15 MB or smaller in total');
      event.target.value = '';
      return;
    }

    setError('');
    Promise.all(files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!imageUrl) reject(new Error('Could not read selected image'));
        else resolve({ name: file.name.replace(/\.[^/.]+$/, '') || 'uploaded-avatar', imageUrl });
      };
      reader.onerror = () => reject(new Error('Could not read selected image'));
      reader.readAsDataURL(file);
    })))
      .then((uploads) => {
        setPendingUploads((current) => [...current, ...uploads]);
        setForm((current) => ({ ...current, ...uploads[0] }));
      })
      .catch((err) => setError(err.message));
    event.target.value = '';
  }

  async function refreshAssets() {
    setLoading(true);
    setError('');
    try {
      const data = await api.admin.listAvatarAssets({
        page: avatarPage,
        pageSize: avatarPageSize,
        search: avatarSearch,
        status: avatarStatus,
      });
      setItems(data.items ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err.message || 'Failed to load avatar assets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAssets();
  }, [avatarPage, avatarPageSize, avatarSearch, avatarStatus]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pendingUploads.length) {
      setError('Please upload an image first');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await Promise.all(pendingUploads.map((upload) => api.admin.createAvatarAsset({
        name: upload.name,
        imageUrl: upload.imageUrl,
        isActive: form.isActive,
        sortOrder: 0,
      })));
      setForm({ name: '', imageUrl: '', isActive: true });
      setPendingUploads([]);
      await refreshAssets();
    } catch (err) {
      setError(err.message || 'Failed to save avatar asset');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this avatar option?')) return;
    try {
      await api.admin.deleteAvatarAsset(id);
      await refreshAssets();
    } catch (err) {
      setError(err.message || 'Failed to delete avatar asset');
    }
  }

  async function handleStatusChange(asset, isActive) {
    try {
      await api.admin.updateAvatarAsset(asset.id, { isActive });
      setItems((current) => current.map((item) => (
        item.id === asset.id ? { ...item, isActive } : item
      )));
    } catch (err) {
      setError(err.message || 'Failed to update avatar status');
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Avatar library"
        description="Upload and manage the avatar choices available to new members and profile editing."
      />

      {error ? (
        <div className="mb-4">
          <AdminError message={error} onRetry={() => refreshAssets()} />
        </div>
      ) : null}

      <AdminPanel title="Add avatar asset">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Upload image
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </label>

          {pendingUploads.length ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {pendingUploads.map((upload, index) => (
                <img key={`${upload.name}-${index}`} src={upload.imageUrl} alt="Upload preview" className="h-24 w-24 rounded-xl object-cover" />
              ))}
            </div>
          ) : null}

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
            />
            Active
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !pendingUploads.length}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save avatar'}
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel title={`Current avatar options${pagination ? ` (${pagination.total})` : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AdminFilterForm basePath="/admin/avatar-assets" className="mb-0 flex-1 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
            <AdminFilterInput name="search" defaultValue={avatarSearch} placeholder="Search avatar name" />
            <AdminFilterSelect name="status" defaultValue={avatarStatus}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </AdminFilterSelect>
            <AdminFilterSelect name="pageSize" defaultValue={avatarPageSize}>
              <option value="12">12 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </AdminFilterSelect>
          </AdminFilterForm>
          <AdminExportButton
            exportPath="/admin/avatar-assets/export.csv"
            params={{ search: avatarSearch, status: avatarStatus }}
            label="Export CSV"
          />
        </div>
        <AdminTable
          loading={loading && !pendingUploads.length}
          emptyMessage="No avatar options yet."
          columns={[
            {
              key: 'serialNumber',
              label: 'S.No',
              render: (row, index) => row.serialNumber ?? index + 1,
            },
            {
              key: 'image',
              label: 'Avatar',
              render: (row) => (
                <button
                  type="button"
                  onClick={() => setPreviewImage(row.imageUrl)}
                  title="View full image"
                  className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <img src={row.imageUrl} alt="Avatar" className="h-14 w-14 rounded-lg object-cover" />
                </button>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => row.pending ? (
                <span className="text-xs text-amber-700">Ready to save</span>
              ) : (
                <select
                  value={row.isActive ? 'active' : 'inactive'}
                  onChange={(event) => handleStatusChange(row, event.target.value === 'active')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => row.pending ? null : (
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                >
                  Delete
                </button>
              ),
            },
          ]}
          rows={[
            ...pendingUploads.map((upload, index) => ({
              ...upload,
              _key: `pending-${upload.name}-${index}`,
              pending: true,
              serialNumber: index + 1,
            })),
            ...items.map((asset, index) => ({
              ...asset,
              _key: asset.id,
              serialNumber: (avatarPage - 1) * avatarPageSize + pendingUploads.length + index + 1,
            })),
          ]}
        />
        <AdminPagination
          pagination={pagination}
          basePath="/admin/avatar-assets"
          params={{ page: avatarPage, pageSize: avatarPageSize }}
        />
      </AdminPanel>

      {previewImage ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Avatar preview"
            className="relative max-h-full max-w-full rounded-xl bg-white p-3 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
              className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-lg leading-none text-white"
            >
              ×
            </button>
            <img src={previewImage} alt="Full avatar preview" className="max-h-[85vh] max-w-[90vw] object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SchoolLinksAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canWrite = adminProfile?.permissions?.includes('organizations.write');
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [registrationLinks, setRegistrationLinks] = useState([]);
  const [geoNotice, setGeoNotice] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    schoolName: '',
    countryId: '',
    stateId: '',
    cityId: '',
    standard: '',
    section: '',
  });
  const [linkQuantity, setLinkQuantity] = useState('1');
  const [generatedLinks, setGeneratedLinks] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');
  const [linksPagination, setLinksPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');

      try {
        const countriesData = await api.getGeoCountries();
        if (!cancelled) {
          const nextCountries = sortCountries(countriesData.countries ?? []);
          setCountries(nextCountries);
          setGeoNotice(
            nextCountries.length
              ? ''
              : 'No countries are available yet. Seed the geo tables before creating school links.'
          );
        }
      } catch (err) {
        if (!cancelled) {
          setGeoNotice(err.message || 'Failed to load location data.');
        }
      }

      try {
        const linksData = await api.admin.listSchoolRegistrationLinks(query);
        if (!cancelled) {
          setRegistrationLinks(linksData.links ?? []);
          setLinksPagination(linksData.pagination ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load school links');
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  useEffect(() => {
    if (!linkForm.countryId) {
      setStates([]);
      setLinkForm((current) => ({ ...current, stateId: '', cityId: '' }));
      return;
    }
    const selectedCountry = countries.find((country) => country.id === linkForm.countryId);
    if (!selectedCountry) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGeoStates(selectedCountry.name);
        if (!cancelled) setStates(res.states ?? []);
      } catch (err) {
        if (!cancelled) {
          setStates([]);
          setGeoNotice(err.message || 'Failed to load states.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countries, linkForm.countryId]);

  useEffect(() => {
    if (!linkForm.stateId) {
      setCities([]);
      setLinkForm((current) => ({ ...current, cityId: '' }));
      return;
    }
    const selectedCountry = countries.find((country) => country.id === linkForm.countryId);
    const selectedState = states.find((state) => state.id === linkForm.stateId);
    if (!selectedCountry || !selectedState) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGeoCities(selectedCountry.name, selectedState.name);
        if (!cancelled) setCities(res.cities ?? []);
      } catch (err) {
        if (!cancelled) {
          setCities([]);
          setGeoNotice(err.message || 'Failed to load cities.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countries, states, linkForm.countryId, linkForm.stateId]);

  async function generateRegistrationLink(e) {
    e.preventDefault();
    if (!linkForm.schoolName.trim()) {
      setError('School name is required');
      return;
    }
    if (!linkForm.cityId) {
      setError(
        countries.length
          ? 'Choose a country, state, and city before generating the link'
          : 'No location data is available yet. Seed the geo tables before creating a school link.'
      );
      return;
    }
    const quantity = Number(linkQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5000) {
      setError('Number of links must be between 1 and 5000');
      return;
    }
    setLinkLoading(true);
    setError('');
    try {
      const selectedCountry = countries.find((country) => country.id === linkForm.countryId);
      const selectedState = states.find((state) => state.id === linkForm.stateId);
      const selectedCity = cities.find((city) => city.id === linkForm.cityId);

      const payload = {
        schoolName: linkForm.schoolName,
        countryName: selectedCountry?.name || null,
        stateName: selectedState?.name || null,
        cityName: selectedCity?.name || null,
        cityId: linkForm.cityId || null,
        standard: linkForm.standard || undefined,
        section: linkForm.section || undefined,
      };
      const res = await api.admin.createSchoolRegistrationLinks({ ...payload, quantity });
      setGeneratedLinks(res.links ?? []);
      setRegistrationLinks((current) => [...(res.links ?? []), ...current]);
      setLinkForm({ schoolName: '', countryId: '', stateId: '', cityId: '', standard: '', section: '' });
      setLinkQuantity('1');
      setStates([]);
      setCities([]);
    } catch (err) {
      setError(err.message || 'Failed to generate school registration link');
    } finally {
      setLinkLoading(false);
    }
  }

  function exportLinks(links, filename = 'school-registration-links.csv') {
    if (!links.length) return;
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['School', 'Standard', 'Section', 'Registration link'],
      ...links.map((link) => [
        link.organization?.name || 'School',
        link.standard || '',
        link.section || '',
        `${window.location.origin}/register?schoolLink=${encodeURIComponent(link.token)}`,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportSchoolLinks(group) {
    try {
      const result = await api.admin.getSchoolRegistrationLinksForExport(group.organization.id);
      exportLinks(
        result.links ?? [],
        `${String(group.organization.name || 'school').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-links.csv`,
      );
    } catch (err) {
      setError(err.message || 'Failed to export school links');
    }
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/register?schoolLink=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((current) => (current === token ? '' : current)), 1800);
    } catch {
      window.prompt('Copy the school registration URL', url);
    }
  }

  const selectedCountry = countries.find((country) => country.id === linkForm.countryId);
  const linkGroups = Object.values(registrationLinks.reduce((groups, link) => {
    const key = link.batchId || link.id;
    if (!groups[key]) groups[key] = { ...link, links: [] };
    groups[key].links.push(link);
    return groups;
  }, {}));

  return (
    <div>
      <AdminPageHeader
        title="School registration links"
        description="Generate shareable school sign-up links that auto-verify students into the selected school and class."
      />

      <AdminPanel title="Generate school registration link" className="mt-6">
        <form onSubmit={generateRegistrationLink} className="space-y-3">
          <input
            type="text"
            value={linkForm.schoolName}
            onChange={(e) => setLinkForm((current) => ({ ...current, schoolName: e.target.value }))}
            placeholder="School name"
            className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0"
          />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900"
                aria-haspopup="listbox"
                aria-expanded={countryOpen}
              >
                <span className="flex items-center gap-2">
                  {selectedCountry ? (
                    <img
                      src={`https://flagcdn.com/24x18/${String(selectedCountry.code || selectedCountry.id).toLowerCase()}.png`}
                      alt=""
                      width="24"
                      height="18"
                      className="h-[18px] w-6 object-cover"
                    />
                  ) : null}
                  {selectedCountry?.name || 'Country'}
                </span>
                <span aria-hidden="true">{countryOpen ? '▴' : '▾'}</span>
              </button>
              {countryOpen ? (
                <div
                  role="listbox"
                  aria-label="Country"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-violet-200 bg-white py-1 shadow-lg"
                >
                  {countries.map((country) => (
                    <button
                      key={country.id}
                      type="button"
                      role="option"
                      aria-selected={country.id === linkForm.countryId}
                      onClick={() => {
                        setLinkForm((current) => ({
                          ...current,
                          countryId: country.id,
                          stateId: '',
                          cityId: '',
                        }));
                        setCountryOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 hover:bg-violet-50"
                    >
                      <img
                        src={`https://flagcdn.com/24x18/${String(country.code || country.id).toLowerCase()}.png`}
                        alt=""
                        width="24"
                        height="18"
                        className="h-[18px] w-6 object-cover"
                      />
                      {country.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <select
              value={linkForm.stateId}
              onChange={(e) => setLinkForm((current) => ({ ...current, stateId: e.target.value, cityId: '' }))}
              disabled={!linkForm.countryId || states.length === 0}
              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-50"
            >
              <option value="">State</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>

            <select
              value={linkForm.cityId}
              onChange={(e) => setLinkForm((current) => ({ ...current, cityId: e.target.value }))}
              disabled={!linkForm.stateId || cities.length === 0}
              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-50"
            >
              <option value="">City</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={linkForm.standard}
              onChange={(e) => setLinkForm((current) => ({ ...current, standard: e.target.value }))}
              placeholder="Standard"
              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
            <input
              type="text"
              value={linkForm.section}
              onChange={(e) => setLinkForm((current) => ({ ...current, section: e.target.value }))}
              placeholder="Section"
              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block max-w-xs">
              <span className="text-xs font-medium text-slate-600">Number of student links</span>
              <input
                type="number"
                min="1"
                max="5000"
                value={linkQuantity}
                onChange={(e) => setLinkQuantity(e.target.value)}
                placeholder="Example: 1000"
                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900"
              />
            </label>
            {generatedLinks.length > 0 ? (
              <button
                type="button"
                onClick={() => exportLinks(generatedLinks)}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
              >
                Export {generatedLinks.length} links for Excel
              </button>
            ) : null}
          </div>

          {geoNotice ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {geoNotice}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={linkLoading || !canWrite || countries.length === 0}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {linkLoading ? 'Generating…' : 'Generate link'}
          </button>
        </form>
      </AdminPanel>

      <AdminPanel title="Existing school links" className="mt-6">
        {loading ? (
          <AdminLoading label="Loading links…" />
        ) : registrationLinks.length === 0 ? (
          <p className="text-sm text-slate-500">No school links yet.</p>
        ) : (
          <>
          <AdminFilterForm basePath="/admin/school-links" className="sm:grid-cols-[1fr_auto]">
            <AdminFilterInput name="search" defaultValue={listParams.search} placeholder="Search school name" />
            <AdminFilterSelect name="pageSize" defaultValue={listParams.pageSize}>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </AdminFilterSelect>
          </AdminFilterForm>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">S.No</th>
                  <th className="px-3 py-2 font-medium">School</th>
                  <th className="px-3 py-2 font-medium">Standard</th>
                  <th className="px-3 py-2 font-medium">Section</th>
                  <th className="px-3 py-2 font-medium">Links</th>
                  <th className="px-3 py-2 font-medium">Joined users</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkGroups.map((group, index) => {
                  const generatedCount = Math.max(...group.links.map((link) => link.generatedCount ?? 1), group.links.length);
                  const usedCount = group.links.reduce((total, link) => total + (link.usesCount ?? 0), 0);
                  const joinedCount = group.links.reduce((total, link) => total + (link.claimsCount ?? link.claims?.length ?? 0), 0);
                  return (
                    <tr key={group.batchId || group.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2 text-slate-600">
                        {(listParams.page - 1) * listParams.pageSize + index + 1}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {group.organization?.name ?? 'School'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{group.standard ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{group.section ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{generatedCount} generated / {usedCount} used</td>
                      <td className="px-3 py-2 text-slate-600">
                        {joinedCount ? `${joinedCount} student${joinedCount === 1 ? '' : 's'}` : 'None yet'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-3">
                          <a
                            href={`/admin/school-links/${group.links[0]?.id || group.id}/students`}
                            className="font-medium text-violet-700 underline"
                          >
                            View students
                          </a>
                          <button
                            type="button"
                            onClick={() => void exportSchoolLinks(group)}
                            className="text-violet-700 underline"
                          >
                            Export {generatedCount}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination pagination={linksPagination} basePath="/admin/school-links" params={query} />
          </>
        )}
      </AdminPanel>
    </div>
  );
}

export function SchoolLinkStudentsAdminPage() {
  const { linkId } = useParams();
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const basePath = `/admin/school-links/${linkId}/students`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await api.admin.getSchoolLinkStudents(linkId, query);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load joined students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkId, searchParams.toString()]);

  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <div className="mb-4">
        <a href="/admin/school-links" className="text-sm font-medium text-violet-700 underline">
          ← Back to school links
        </a>
      </div>
      <AdminPageHeader
        title={`${data?.link?.organization?.name ?? 'School'} students`}
        description="Students who joined through this school registration link."
      />
      <AdminPanel
        title={`Joined students${data?.pagination ? ` (${data.pagination.total})` : ''}`}
        actions={
          <AdminExportButton
            exportPath={`/admin/organizations/registration-links/${linkId}/students/export.csv`}
            params={{ search: listParams.search }}
          />
        }
      >
        <AdminFilterForm basePath={basePath} className="sm:grid-cols-[1fr_auto]">
          <AdminFilterInput name="search" defaultValue={listParams.search} placeholder="Search username or email" />
          <AdminFilterSelect name="pageSize" defaultValue={listParams.pageSize}>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </AdminFilterSelect>
        </AdminFilterForm>
        <AdminTable
          loading={loading}
          emptyMessage="No students have joined through this link yet."
          columns={[
            { key: 'serialNumber', label: 'S.No' },
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            { key: 'standard', label: 'Standard', render: (row) => row.standard ?? '—' },
            { key: 'section', label: 'Section', render: (row) => row.section ?? '—' },
            {
              key: 'location',
              label: 'Location',
              render: (row) => [row.cityName, row.stateName, row.countryName].filter(Boolean).join(', ') || '—',
            },
            {
              key: 'view',
              label: '',
              render: (row) => (
                <a
                  href={`/admin/users?userId=${encodeURIComponent(row.id)}`}
                  className="font-medium text-violet-700 underline"
                >
                  View
                </a>
              ),
            },
            {
              key: 'claimedAt',
              label: 'Joined',
              render: (row) => new Date(row.claimedAt).toLocaleString(),
            },
          ]}
          rows={(data?.students ?? []).map((student, index) => ({
            ...student,
            serialNumber: (listParams.page - 1) * listParams.pageSize + index + 1,
            _key: student.id,
          }))}
        />
        <AdminPagination pagination={data?.pagination} basePath={basePath} params={query} />
      </AdminPanel>
    </div>
  );
}

export function MissionEngineAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canWrite = adminProfile?.permissions?.includes('mission_engine.write');
  const [overview, setOverview] = useState(null);
  const [missions, setMissions] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [overviewData, missionData] = await Promise.all([
          api.admin.getMissionEngineOverview(),
          api.admin.getMissions(query),
        ]);
        if (!cancelled) {
          setOverview(overviewData);
          setMissions(missionData);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load mission engine admin');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  async function openMission(id) {
    try {
      setSelectedMission(await api.admin.getMission(id));
    } catch (err) {
      setError(err.message || 'Failed to load mission detail');
    }
  }

  async function toggleMissionDisabled() {
    if (!selectedMission || !canWrite) return;
    const disabling = !selectedMission.isDisabled;
    const disabledReason = disabling
      ? window.prompt('Reason for disabling this mission (required):', 'Content review')
      : undefined;
    if (disabling && !disabledReason?.trim()) return;
    try {
      const updated = await api.admin.patchMission(selectedMission.id, {
        isDisabled: disabling,
        disabledReason: disabledReason?.trim(),
      });
      setSelectedMission(updated);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to update mission');
    }
  }

  if (loading && !overview) return <AdminLoading label="Loading mission engine…" />;
  if (error && !overview) {
    return <AdminError message={error} onRetry={() => window.location.reload()} />;
  }

  const analytics = overview?.analytics;

  return (
    <div>
      <AdminPageHeader
        title="Missions"
        description="Browse the mission catalog, inspect rewards, and manage disabled missions."
      />

      <AdminStatGrid
        loading={loading && !analytics}
        stats={[
          {
            label: 'Total missions',
            value: analytics?.catalog?.byCategory?.reduce((s, r) => s + r.count, 0) ?? '—',
          },
          {
            label: 'Age categories',
            value: overview?.ageCategories?.length ?? 9,
            hint: 'S1E through N7',
          },
          {
            label: 'Completions',
            value: analytics?.completions?.total ?? 0,
            hint: 'All-time user completions',
          },
          {
            label: 'Disabled missions',
            value: analytics?.catalog?.disabledMissions ?? 0,
            hint: `${analytics?.catalog?.activeMissions ?? 0} active`,
          },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Completions by hill">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'hillCode', label: 'Hill' },
              { key: 'count', label: 'Completions' },
            ]}
            rows={(analytics?.completions?.byHill ?? []).map((r) => ({ ...r, _key: r.hillCode }))}
          />
        </AdminPanel>
        <AdminPanel title="Catalog by internal group (1–5)">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'missionGroup', label: 'Group' },
              { key: 'count', label: 'Missions' },
            ]}
            rows={(analytics?.catalog?.byGroup ?? []).map((r) => ({ ...r, _key: r.missionGroup }))}
          />
        </AdminPanel>
      </div>

      <AdminPanel
        title="Mission catalog — browse & inspect"
        actions={
          <AdminExportButton exportPath="/admin/mission-engine/missions/export.csv" params={query} />
        }
      >
        <AdminFilterForm basePath={MISSION_BASE} className="md:grid-cols-4">
          <AdminFilterInput name="search" defaultValue={listParams.search} placeholder="Search title / ID…" />
          <AdminFilterSelect name="categoryCode" defaultValue={listParams.categoryCode}>
            <option value="">All age stages</option>
            {overview?.ageCategories?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </AdminFilterSelect>
          <AdminFilterSelect name="hillCode" defaultValue={listParams.hillCode}>
            <option value="">All hills</option>
            {['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </AdminFilterSelect>
          <AdminFilterSelect name="missionGroup" defaultValue={listParams.missionGroup}>
            <option value="">All groups</option>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </AdminFilterSelect>
        </AdminFilterForm>

        <AdminTable
          loading={loading}
          columns={[
            { key: 'externalId', label: 'ID' },
            { key: 'title', label: 'Title' },
            { key: 'categoryCode', label: 'Stage' },
            { key: 'hillCode', label: 'Hill' },
            { key: 'missionGroup', label: 'Grp' },
            {
              key: 'verificationType',
              label: 'Verification',
              render: (row) => <AdminBadge tone="staff">{row.verificationType}</AdminBadge>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) =>
                row.isDisabled ? (
                  <AdminBadge tone="red">disabled</AdminBadge>
                ) : (
                  <AdminBadge tone="green">active</AdminBadge>
                ),
            },
            { key: 'coinReward', label: 'Coins' },
            {
              key: 'actions',
              label: '',
              render: (row) => (
                <button
                  type="button"
                  className="text-sm font-medium text-amber-700 underline"
                  onClick={() => openMission(row.id)}
                >
                  View
                </button>
              ),
            },
          ]}
          rows={(missions?.items ?? []).map((m) => ({ ...m, _key: m.id }))}
        />

        <AdminPagination pagination={missions?.pagination} basePath={MISSION_BASE} params={query} />
      </AdminPanel>

      {selectedMission ? (
        <AdminPanel title="Mission detail (age-stage preview)">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-gray-500">Title</p>
              <p className="font-medium text-slate-900">{selectedMission.title}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">External ID</p>
              <p>{selectedMission.externalId ?? '—'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase text-gray-500">Description</p>
              <p className="text-sm text-gray-700">{selectedMission.description}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Age stage</p>
              <p>{selectedMission.categoryCode}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Hill</p>
              <p>{selectedMission.hillCode}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Internal group</p>
              <p>{selectedMission.missionGroup} (admin-only metadata)</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Verification</p>
              <AdminBadge tone="amber">{selectedMission.verificationType}</AdminBadge>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Rewards</p>
              <p>
                {selectedMission.coinReward} coins · {selectedMission.pulseReward} pulse
              </p>
            </div>
            {selectedMission.isDisabled ? (
              <div className="md:col-span-2">
                <p className="text-xs uppercase text-gray-500">Disabled</p>
                <AdminBadge tone="red">{selectedMission.disabledReason ?? 'No reason recorded'}</AdminBadge>
              </div>
            ) : null}
          </div>
          {canWrite ? (
            <button
              type="button"
              className={`mt-4 rounded-lg px-4 py-2 text-sm font-medium ${
                selectedMission.isDisabled ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
              onClick={toggleMissionDisabled}
            >
              {selectedMission.isDisabled ? 'Re-enable mission' : 'Disable mission'}
            </button>
          ) : null}
          <button
            type="button"
            className="mt-4 ml-3 text-sm text-gray-500 underline"
            onClick={() => setSelectedMission(null)}
          >
            Close detail
          </button>
        </AdminPanel>
      ) : null}
    </div>
  );
}

export function JourneyAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canWrite = adminProfile?.permissions?.includes('journey.write');
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState(null);
  const [editingCamp, setEditingCamp] = useState(null);
  const [campForm, setCampForm] = useState({ name: '', stepThreshold: '', coinReward: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [overview, stats, userList] = await Promise.all([
          api.admin.getJourneyOverview(),
          api.admin.getJourneyAnalytics(),
          api.admin.getJourneyUsers(query),
        ]);
        if (!cancelled) {
          setData(overview);
          setAnalytics(stats);
          setUsers(userList);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load journey admin');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  function startCampEdit(camp) {
    setEditingCamp(camp);
    setCampForm({
      name: camp.name,
      stepThreshold: String(camp.stepThreshold),
      coinReward: String(camp.coinReward),
    });
  }

  async function saveCampEdit() {
    if (!editingCamp || !canWrite) return;
    try {
      await api.admin.patchCamp(editingCamp.id, {
        name: campForm.name.trim(),
        stepThreshold: Number(campForm.stepThreshold),
        coinReward: Number(campForm.coinReward),
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to update camp');
    }
  }

  if (loading && !data) return <AdminLoading label="Loading journey admin…" />;
  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <AdminPageHeader
        title="Journey"
        description="Camp milestones, user step progress, and hill progression."
      />

      <AdminStatGrid
        loading={loading}
        stats={[
          { label: 'Steps per hill', value: data?.stepConfig?.stepsPerHill ?? 49 },
          { label: 'Avg user step', value: data?.analytics?.averageStep ?? 0 },
          { label: 'Onboarded users', value: analytics?.onboardingCompleted ?? 0 },
          { label: 'Growth sets completed', value: analytics?.growthSetCompletions ?? 0 },
        ]}
      />

      <AdminPanel title={canWrite ? 'Camp milestones — click Edit to update' : 'Camp milestones'}>
        <AdminTable
          loading={loading}
          columns={[
            { key: 'number', label: 'Camp #' },
            { key: 'name', label: 'Name' },
            { key: 'stepThreshold', label: 'Step threshold' },
            {
              key: 'coinReward',
              label: 'Coin reward',
              render: (row) => row.coinReward.toLocaleString(),
            },
            ...(canWrite
              ? [
                  {
                    key: 'actions',
                    label: '',
                    render: (row) => (
                      <button
                        type="button"
                        className="text-sm text-amber-700 underline"
                        onClick={() => startCampEdit(row)}
                      >
                        Edit
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={(data?.camps ?? []).map((c) => ({ ...c, _key: c.id }))}
        />
      </AdminPanel>

      {editingCamp ? (
        <AdminPanel title={`Edit camp ${editingCamp.number}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={campForm.name}
                onChange={(e) => setCampForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Step threshold
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={campForm.stepThreshold}
                onChange={(e) => setCampForm((f) => ({ ...f, stepThreshold: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Coin reward
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={campForm.coinReward}
                onChange={(e) => setCampForm((f) => ({ ...f, coinReward: e.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950"
              onClick={saveCampEdit}
            >
              Save (audit logged)
            </button>
            <button type="button" className="text-sm underline" onClick={() => setEditingCamp(null)}>
              Cancel
            </button>
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel
        title="User progression — search & filter"
        actions={<AdminExportButton exportPath="/admin/journey/users/export.csv" params={query} />}
      >
        <AdminFilterForm basePath={JOURNEY_BASE} className="md:grid-cols-3 lg:grid-cols-6">
          <AdminFilterInput
            name="search"
            defaultValue={listParams.search}
            placeholder="User, email, hill…"
            className="lg:col-span-2"
          />
          <AdminFilterSelect name="hillCode" defaultValue={listParams.hillCode}>
            <option value="">All hills</option>
            {(data?.hills ?? []).map((h) => (
              <option key={h.id} value={h.code}>
                {h.code}
              </option>
            ))}
          </AdminFilterSelect>
          <AdminFilterSelect name="campId" defaultValue={listParams.campId}>
            <option value="">Any camp reached</option>
            {(data?.camps ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                Camp {c.number} — {c.name}
              </option>
            ))}
          </AdminFilterSelect>
          <AdminFilterInput
            name="stepMin"
            type="number"
            defaultValue={listParams.stepMin}
            placeholder="Step min"
          />
          <AdminFilterInput
            name="stepMax"
            type="number"
            defaultValue={listParams.stepMax}
            placeholder="Step max"
          />
        </AdminFilterForm>

        <AdminTable
          loading={loading}
          columns={[
            { key: 'username', label: 'User' },
            { key: 'email', label: 'Email' },
            { key: 'currentStep', label: 'Step' },
            { key: 'currentCamp', label: 'Camp' },
            { key: 'focusHill', label: 'Hill' },
            { key: 'treeLevel', label: 'Tree' },
            { key: 'walletCoins', label: 'Coins' },
            {
              key: 'onboardingCompleted',
              label: 'Onboarded',
              render: (row) => (row.onboardingCompleted ? 'Yes' : 'No'),
            },
          ]}
          rows={(users?.items ?? []).map((u) => ({ ...u, _key: u.id }))}
          emptyMessage="No users match these filters."
        />

        <AdminPagination pagination={users?.pagination} basePath={JOURNEY_BASE} params={query} />
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Users per camp reached">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'campName', label: 'Camp' },
              { key: 'stepThreshold', label: 'Step' },
              { key: 'usersReached', label: 'Users' },
            ]}
            rows={(analytics?.campDistribution ?? []).map((r) => ({ ...r, _key: r.campNumber }))}
          />
        </AdminPanel>
        <AdminPanel title="Step distribution">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'label', label: 'Step range' },
              { key: 'count', label: 'Users' },
            ]}
            rows={(analytics?.stepBuckets ?? []).map((r) => ({ ...r, _key: r.label }))}
          />
        </AdminPanel>
      </div>

      <AdminPanel title="Hill domains">
        <AdminTable
          loading={loading}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Domain' },
            { key: 'virtueName', label: 'Virtue' },
            {
              key: 'colorTheme',
              label: 'Color',
              render: (row) => (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: row.colorTheme }} />
                  {row.colorTheme}
                </span>
              ),
            },
          ]}
          rows={(data?.hills ?? []).map((h) => ({ ...h, _key: h.id }))}
        />
      </AdminPanel>
    </div>
  );
}

export function GlowAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [seeds, setSeeds] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [overview, stats, seedList] = await Promise.all([
          api.admin.getGlowOverview(),
          api.admin.getGlowAnalytics(),
          api.admin.getGlowSeeds(query),
        ]);
        if (!cancelled) {
          setData(overview);
          setAnalytics(stats);
          setSeeds(seedList);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load GLOW admin');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  if (loading && !data) return <AdminLoading label="Loading GLOW admin…" />;
  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  const rules = data?.rules ?? {};

  return (
    <div>
      <AdminPageHeader
        title="GLOW"
        description="Referral seeds, invitation status, and send trends."
      />

      <AdminStatGrid
        loading={loading}
        stats={[
          { label: 'Total seeds sent', value: data?.analytics?.totalSeeds ?? 0 },
          { label: '30-day acceptance', value: `${analytics?.last30Days?.acceptanceRate ?? 0}%` },
          { label: 'Seeds (30 days)', value: analytics?.last30Days?.totalSent ?? 0 },
          { label: 'Expired', value: data?.analytics?.expired ?? 0 },
        ]}
      />

      <AdminPanel title="GLOW rules (AdminConfig)">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['welcome_bonus', 'Welcome bonus coins'],
            ['max_seed_inventory', 'Max seed inventory'],
            ['seed_expiry_days', 'Invitation expiry (days)'],
            ['monthly_send_limit', 'Monthly send limit'],
          ].map(([key, label]) => (
            <div key={key} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs uppercase text-gray-500">{label}</p>
              <p className="mt-1 font-medium text-slate-900">{JSON.stringify(rules[key] ?? '—')}</p>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel
        title="GLOW seeds — search & filter"
        actions={<AdminExportButton exportPath="/admin/glow/seeds/export.csv" params={query} />}
      >
        <AdminFilterForm basePath={GLOW_BASE} className="md:grid-cols-3 lg:grid-cols-5">
          <AdminFilterInput
            name="search"
            defaultValue={listParams.search}
            placeholder="Sender / receiver email…"
            className="lg:col-span-2"
          />
          <AdminFilterSelect name="status" defaultValue={listParams.status}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
          </AdminFilterSelect>
          <AdminFilterInput name="dateFrom" type="date" defaultValue={listParams.dateFrom} />
          <AdminFilterInput name="dateTo" type="date" defaultValue={listParams.dateTo} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="flaggedOnly"
              value="1"
              defaultChecked={listParams.flaggedOnly}
              className="rounded border-slate-300"
            />
            Abuse-flagged only (expired)
          </label>
        </AdminFilterForm>

        <AdminTable
          loading={loading}
          columns={[
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <AdminBadge tone={row.status === 'accepted' ? 'green' : row.status === 'expired' ? 'red' : 'amber'}>
                  {row.status}
                </AdminBadge>
              ),
            },
            { key: 'sender', label: 'Sender', render: (row) => row.sender?.email ?? row.sender?.username ?? '—' },
            { key: 'receiver', label: 'Receiver', render: (row) => row.receiver?.email ?? row.receiver?.username ?? '—' },
            { key: 'virtue', label: 'Virtue', render: (row) => row.virtue ?? '—' },
            {
              key: 'flagged',
              label: 'Flagged',
              render: (row) => (row.flagged ? <AdminBadge tone="red">yes</AdminBadge> : '—'),
            },
            {
              key: 'sentAt',
              label: 'Sent',
              render: (row) => new Date(row.sentAt).toLocaleString(),
            },
          ]}
          rows={(seeds?.items ?? []).map((s) => ({ ...s, _key: s.id }))}
          emptyMessage="No seeds match these filters."
        />

        <AdminPagination pagination={seeds?.pagination} basePath={GLOW_BASE} params={query} />
      </AdminPanel>

      <AdminPanel title="30-day send trend">
        <AdminTable
          loading={loading}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'sent', label: 'Sent' },
            { key: 'accepted', label: 'Accepted' },
          ]}
          rows={(analytics?.last30Days?.dailyTrend ?? []).map((r) => ({ ...r, _key: r.date }))}
          emptyMessage="No GLOW activity in the last 30 days."
        />
      </AdminPanel>
    </div>
  );
}

export function UsersAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const selectedUserId = searchParams.get('userId') ?? '';
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canWrite = adminProfile?.permissions?.includes('trust_safety.write');
  const [data, setData] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const overview = await api.admin.getTrustSafetyOverview(query);
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const detail = await api.admin.getUserDetail(selectedUserId);
        if (!cancelled) setUserDetail(detail);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load user details');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  function userDetailUrl(userId) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        params.set(key, String(value));
      }
    }
    params.set('userId', userId);
    return `${USERS_BASE}?${params.toString()}`;
  }

  function openDeleteModal(user) {
    if (!canWrite || user.role === 'admin') return;
    setError('');
    setDeleteTarget(user);
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setDeletingUserId(deleteTarget.id);
    setError('');
    try {
      await api.admin.deleteUser(deleteTarget.id);
      window.location.assign(USERS_BASE);
    } catch (err) {
      setError(err.message || 'Failed to delete user');
      setDeletingUserId('');
    }
  }

  async function deleteUser(user) {
    openDeleteModal(user);
  }

  async function toggleAccountStatus(user) {
    if (!canWrite) return;
    const suspending = user.accountStatus !== 'suspended';
    const suspendedReason = suspending
      ? window.prompt('Reason for suspension (required):', 'Account review')
      : undefined;
    if (suspending && !suspendedReason?.trim()) return;
    try {
      await api.admin.patchUserStatus(user.id, {
        accountStatus: suspending ? 'suspended' : 'active',
        suspendedReason: suspendedReason?.trim(),
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to update account status');
    }
  }

  if (loading && !data) return <AdminLoading label="Loading users…" />;
  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  const profile = userDetail?.profile;

  return (
    <div>
      <AdminPageHeader
        title="User management"
        description="Search members, open profiles, suspend accounts, or permanently delete a user and all related data."
      />

      {error ? (
        <div className="mb-4">
          <AdminError message={error} onRetry={() => setError('')} />
        </div>
      ) : null}

      {deletingUserId && !deleteTarget ? <AdminLoading label="Deleting user and related data…" /> : null}

      <AdminDeleteUserModal
        open={Boolean(deleteTarget)}
        user={deleteTarget}
        deleting={Boolean(deletingUserId)}
        error={deleteTarget ? error : ''}
        onClose={() => {
          if (!deletingUserId) {
            setDeleteTarget(null);
            setError('');
          }
        }}
        onConfirm={confirmDeleteUser}
      />

      <AdminStatGrid
        loading={loading}
        stats={[
          { label: 'Total users', value: data?.summary?.totalUsers ?? 0 },
          { label: 'Child profiles', value: data?.summary?.childProfiles ?? 0 },
          { label: 'Staff accounts', value: data?.summary?.adminUsers ?? 0 },
        ]}
      />

      {selectedUserId ? (
        <AdminPanel
          title={profile ? `${profile.username} — profile` : 'User profile'}
          actions={
            <a href={USERS_BASE} className="text-sm font-medium text-amber-700 underline">
              ← Back to all users
            </a>
          }
        >
          {detailLoading && !profile ? (
            <AdminLoading label="Loading user profile…" />
          ) : profile ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Email', profile.email],
                  ['Username', profile.username],
                  ['Role', profile.role],
                  ['Status', profile.accountStatus ?? 'active'],
                  ['Age group', profile.ageGroup ?? '—'],
                  ['Country', profile.countryName ?? '—'],
                  ['State', profile.stateName ?? '—'],
                  ['City', profile.cityName ?? '—'],
                  ['Standard', profile.standard ?? '—'],
                  ['Section', profile.section ?? '—'],
                  ['Child profile', profile.isChildProfile ? 'Yes' : 'No'],
                  ['Onboarding', profile.onboardingCompleted ? 'Complete' : 'Incomplete'],
                  ['Joined', new Date(profile.createdAt).toLocaleDateString()],
                  ['Current step', profile.currentStep],
                  ['Camp', profile.currentCamp?.name ?? '—'],
                  ['Tree level', profile.treeLevel],
                  ['Wallet coins', profile.walletCoins],
                  ['Flow index', profile.flowIndex],
                  ['Streak', profile.currentStreak],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{String(value)}</p>
                  </div>
                ))}
              </div>

              {profile.gapAssessment ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">GAP assessment</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Focus hill: {profile.gapAssessment.focusHill?.name ?? '—'} · Strongest:{' '}
                    {profile.gapAssessment.strongestHill?.name ?? '—'}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(profile.gapAssessment.hillScores ?? []).map((score) => (
                      <div key={score.hill.code} className="rounded bg-slate-50 p-2 text-xs text-slate-700">
                        <span className="font-semibold">{score.hill.code}</span>: {score.rawScore} / {score.flowPercent}%
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {userDetail.family ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Family — {userDetail.family.name}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {(userDetail.family.members ?? []).map((m) => (
                      <li key={m.id}>
                        {m.username} ({m.email}){m.isChildProfile ? ' · child' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <AdminStatGrid
                stats={[
                  { label: 'Missions completed', value: userDetail.activity?.missionsCompleted ?? 0 },
                  { label: 'In progress', value: userDetail.activity?.missionsInProgress ?? 0 },
                  { label: 'GLOW sent', value: userDetail.activity?.glowSent ?? 0 },
                  { label: 'GLOW received', value: userDetail.activity?.glowReceived ?? 0 },
                ]}
              />

              {canWrite && profile.role !== 'admin' ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      profile.accountStatus === 'suspended' ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
                    }`}
                    onClick={() => toggleAccountStatus(profile)}
                  >
                    {profile.accountStatus === 'suspended' ? 'Restore account' : 'Suspend account'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(deletingUserId)}
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    onClick={() => deleteUser(profile)}
                  >
                    {deletingUserId === profile.id ? 'Deleting…' : 'Delete user permanently'}
                  </button>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Recent coin activity</p>
                <div className="mt-3">
                  <AdminTable
                  columns={[
                    { key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
                    { key: 'amount', label: 'Amount' },
                    { key: 'source', label: 'Source' },
                    { key: 'ledgerType', label: 'Type' },
                  ]}
                  rows={(userDetail.recentLedger ?? []).map((r) => ({ ...r, _key: r.id }))}
                  emptyMessage="No coin activity yet."
                />
                </div>
              </div>
            </div>
          ) : (
            <AdminError message="User not found." />
          )}
        </AdminPanel>
      ) : null}

      <AdminPanel
        title="All users"
        actions={<AdminExportButton exportPath="/admin/trust-safety/users/export.csv" params={query} />}
      >
        <AdminFilterForm basePath={USERS_BASE} className="md:grid-cols-2">
          <AdminFilterInput
            name="search"
            defaultValue={listParams.search}
            placeholder="Search by email or username…"
            className="md:col-span-2"
          />
        </AdminFilterForm>

        <AdminTable
          loading={loading}
          columns={[
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            {
              key: 'role',
              label: 'Role',
              render: (row) => <AdminBadge tone={row.role === 'admin' ? 'staff' : 'gray'}>{row.role}</AdminBadge>,
            },
            {
              key: 'accountStatus',
              label: 'Status',
              render: (row) => (
                <AdminBadge tone={row.accountStatus === 'suspended' ? 'red' : 'green'}>
                  {row.accountStatus ?? 'active'}
                </AdminBadge>
              ),
            },
            { key: 'currentStep', label: 'Step' },
            { key: 'walletCoins', label: 'Coins' },
            {
              key: 'onboardingCompleted',
              label: 'Onboarded',
              render: (row) => (row.onboardingCompleted ? 'Yes' : 'No'),
            },
            {
              key: 'actions',
              label: '',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <a href={userDetailUrl(row.id)} className="text-sm font-medium text-amber-700 underline">
                    View
                  </a>
                  {canWrite && row.role !== 'admin' ? (
                    <button
                      type="button"
                      disabled={Boolean(deletingUserId)}
                      className="text-sm font-medium text-red-600 underline disabled:opacity-50"
                      onClick={() => deleteUser(row)}
                    >
                      {deletingUserId === row.id ? 'Deleting…' : 'Delete'}
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={(data?.users ?? []).map((u) => ({ ...u, _key: u.id }))}
          emptyMessage="No users found. Try a different search."
        />

        <AdminPagination pagination={data?.pagination} basePath={USERS_BASE} params={query} />
      </AdminPanel>
    </div>
  );
}

/** @deprecated Use UsersAdminPage */
export const TrustSafetyAdminPage = UsersAdminPage;

function demandBadge(tier, label) {
  if (tier === 'high') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
        🔥 {label}
      </span>
    );
  }
  if (tier === 'growing') {
    return <span className="font-medium text-amber-700">{label}</span>;
  }
  return <span className="text-slate-500">{label}</span>;
}

function orgStatusLabel(status) {
  switch (status) {
    case 'gofam_verified':
      return 'GOFAM Verified ✓';
    case 'community_interest':
      return 'Community interest';
    default:
      return 'Listed';
  }
}

export function OrganizationsAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams);
  const query = cleanListParams(listParams);
  const selectedOrgId = searchParams.get('orgId') ?? '';
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canWrite = adminProfile?.permissions?.includes('organizations.write');
  const [data, setData] = useState(null);
  const [orgDetail, setOrgDetail] = useState(null);
  const [pendingMemberships, setPendingMemberships] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [registrationLinks, setRegistrationLinks] = useState([]);
  const [linkForm, setLinkForm] = useState({
    schoolName: '',
    countryId: '',
    stateId: '',
    cityId: '',
    standard: '',
    section: '',
  });
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const overview = await api.admin.getOrganizationsOverview(query);
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load organizations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  useEffect(() => {
    if (!selectedOrgId) {
      setOrgDetail(null);
      setPendingMemberships([]);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const [detail, pending] = await Promise.all([
          api.admin.getOrganization(selectedOrgId),
          api.admin.getOrganizationPendingMemberships(selectedOrgId),
        ]);
        if (!cancelled) {
          setOrgDetail(detail);
          setPendingMemberships(pending.items ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load organization detail');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGeoCountries();
        if (!cancelled) setCountries((res.countries ?? []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))));
      } catch {
        if (!cancelled) setCountries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.admin.listSchoolRegistrationLinks();
        if (!cancelled) setRegistrationLinks(res.links ?? []);
      } catch {
        if (!cancelled) setRegistrationLinks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!linkForm.countryId) {
      setStates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGeoStates(linkForm.countryId);
        if (!cancelled) setStates(res.states ?? []);
      } catch {
        if (!cancelled) setStates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkForm.countryId]);

  useEffect(() => {
    if (!linkForm.stateId) {
      setCities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGeoCities(linkForm.stateId);
        if (!cancelled) setCities(res.cities ?? []);
      } catch {
        if (!cancelled) setCities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkForm.stateId]);

  function orgDetailUrl(orgId) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        params.set(key, String(value));
      }
    }
    params.set('orgId', orgId);
    return `${ORGS_BASE}?${params.toString()}`;
  }

  async function verifyOrg(orgId) {
    if (!canWrite) return;
    setActionBusy('verify');
    setError('');
    try {
      await api.admin.verifyOrganization(orgId);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to verify organization');
      setActionBusy('');
    }
  }

  async function membershipAction(membershipId, action) {
    if (!canWrite || !selectedOrgId) return;
    setActionBusy(`${action}-${membershipId}`);
    setError('');
    try {
      await api.admin.patchOrganizationMembership(selectedOrgId, membershipId, { action });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to update membership');
      setActionBusy('');
    }
  }

  async function generateRegistrationLink(e) {
    e.preventDefault();
    if (!linkForm.schoolName.trim()) {
      setError('School name is required');
      return;
    }
    setLinkLoading(true);
    setError('');
    try {
      if (!linkForm.cityId) {
        throw new Error('Choose a country, state, and city before generating the link');
      }
      const payload = {
        schoolName: linkForm.schoolName,
        cityId: linkForm.cityId || null,
        standard: linkForm.standard || undefined,
        section: linkForm.section || undefined,
      };
      const res = await api.admin.createSchoolRegistrationLink(payload);
      setRegistrationLinks((current) => [res.link, ...current]);
      setLinkForm({ schoolName: '', countryId: '', stateId: '', cityId: '', standard: '', section: '' });
      setStates([]);
      setCities([]);
      if (navigator.clipboard) {
        const url = `${window.location.origin}/register?schoolLink=${encodeURIComponent(res.link.token)}`;
        await navigator.clipboard.writeText(url);
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate registration link');
    } finally {
      setLinkLoading(false);
    }
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/register?schoolLink=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy the school registration URL', url);
    }
  }

  if (loading && !data) return <AdminLoading label="Loading organizations…" />;
  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  const stats = data?.stats ?? {};

  return (
    <div>
      <AdminPageHeader
        title="Organisation demand"
        description="Aggregate interest signals for B2B outreach. Individual minors are never disclosed — use counts only in marketing."
      />

      <AdminStatGrid
        loading={loading}
        stats={[
          { label: 'Total organisations', value: stats.totalOrganizations ?? '—' },
          { label: 'Community interest', value: stats.communityInterest ?? '—' },
          { label: 'GOFAM verified', value: stats.gofamVerified ?? '—' },
          { label: 'High demand (50+)', value: stats.highDemandCount ?? '—', hint: '🔥 outreach priority' },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminPanel
          title="Organisations by interest"
          actions={
            <AdminExportButton exportPath="/admin/organizations/export.csv" params={query} />
          }
        >
          <AdminFilterForm basePath={ORGS_BASE} className="md:grid-cols-2 lg:grid-cols-4">
            <AdminFilterInput
              name="search"
              defaultValue={listParams.search}
              placeholder="School or org name…"
              className="lg:col-span-2"
            />
            <AdminFilterSelect name="status" defaultValue={listParams.status}>
              <option value="">All statuses</option>
              <option value="listed">Listed</option>
              <option value="community_interest">Community interest</option>
              <option value="gofam_verified">GOFAM verified</option>
            </AdminFilterSelect>
            <AdminFilterSelect name="demandTier" defaultValue={listParams.demandTier}>
              <option value="">All demand</option>
              <option value="high">High (50+)</option>
              <option value="growing">Growing (25–49)</option>
              <option value="early">Early (&lt;25)</option>
            </AdminFilterSelect>
          </AdminFilterForm>

          <AdminTable
            loading={loading}
            columns={[
              {
                key: 'name',
                label: 'Organisation',
                render: (row) => (
                  <a href={orgDetailUrl(row.id)} className="font-medium text-amber-800 hover:underline">
                    {row.name}
                  </a>
                ),
              },
              { key: 'interestCount', label: 'Interested' },
              {
                key: 'demandLabel',
                label: 'Status',
                render: (row) => demandBadge(row.demandTier, row.demandLabel),
              },
              {
                key: 'orgStatus',
                label: 'Partnership',
                render: (row) => orgStatusLabel(row.status),
              },
              {
                key: 'cityName',
                label: 'Location',
                render: (row) =>
                  [row.cityName, row.stateName].filter(Boolean).join(', ') || '—',
              },
            ]}
            rows={(data?.items ?? []).map((row) => ({ ...row, _key: row.id }))}
            emptyMessage="No organisations match these filters."
          />

          <AdminPagination pagination={data?.pagination} basePath={ORGS_BASE} params={query} />
        </AdminPanel>

        <AdminPanel title={selectedOrgId ? 'Organisation detail' : 'Select an organisation'}>
          {!selectedOrgId ? (
            <p className="text-sm text-slate-500">
              Open an organisation from the list to verify partnerships, manage invite codes, and
              approve pending memberships.
            </p>
          ) : detailLoading ? (
            <AdminLoading label="Loading detail…" />
          ) : orgDetail ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-lg font-semibold text-slate-900">{orgDetail.name}</p>
                <p className="text-slate-600">{orgStatusLabel(orgDetail.status)}</p>
                <p className="mt-1 text-slate-500">
                  {orgDetail.interestCount} interested · {orgDetail.activeVerifiedCount} verified
                  members
                </p>
                {orgDetail.marketingNote ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Marketing (aggregate only): {orgDetail.marketingNote}
                  </p>
                ) : null}
              </div>

              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  {orgDetail.status !== 'gofam_verified' ? (
                    <button
                      type="button"
                      disabled={actionBusy === 'verify'}
                      onClick={() => void verifyOrg(orgDetail.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Mark GOFAM verified
                    </button>
                  ) : null}
                </div>
              ) : null}

              {pendingMemberships.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pending membership approvals
                  </p>
                  <ul className="space-y-2">
                    {pendingMemberships.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <span>
                          {m.user.displayName || m.user.username}
                          <span className="ml-2 text-xs text-slate-500">{m.user.ageGroup}</span>
                        </span>
                        {canWrite ? (
                          <span className="flex gap-2">
                            <button
                              type="button"
                              disabled={Boolean(actionBusy)}
                              onClick={() => void membershipAction(m.id, 'approve')}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionBusy)}
                              onClick={() => void membershipAction(m.id, 'reject')}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                            >
                              Reject
                            </button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : orgDetail.status === 'gofam_verified' ? (
                <p className="text-xs text-slate-500">No pending membership requests.</p>
              ) : null}

              {orgDetail.memberships?.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active memberships
                  </p>
                  <AdminTable
                    columns={[
                      {
                        key: 'user',
                        label: 'Member',
                        render: (row) => row.user.displayName || row.user.username,
                      },
                      { key: 'status', label: 'Status' },
                      {
                        key: 'startDate',
                        label: 'Since',
                        render: (row) => new Date(row.startDate).toLocaleDateString(),
                      },
                    ]}
                    rows={orgDetail.memberships.map((m) => ({ ...m, _key: m.id }))}
                    emptyMessage=""
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </AdminPanel>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function AuditLogAdminPage() {
  const [searchParams] = useSearchParams();
  const listParams = readAdminListParams(searchParams, { pageSize: 50 });
  const query = cleanListParams(listParams);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const adminProfile = useAuthStore((s) => s.adminProfile);
  const canClearAudit = adminProfile?.permissions?.includes('admin.roles.manage');

  async function handleClearAuditLogs() {
    if (window.prompt('Type CLEAR to permanently delete all audit logs') !== 'CLEAR') return;

    setClearing(true);
    setError('');
    try {
      await api.admin.clearAuditLogs();
      setData((current) => ({
        ...(current ?? {}),
        items: [],
        pagination: { ...(current?.pagination ?? {}), total: 0, totalPages: 0, page: 1 },
      }));
    } catch (err) {
      setError(err.message || 'Failed to clear audit log');
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const logs = await api.admin.getAuditLogs(query);
        if (!cancelled) setData(logs);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load audit log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]);

  if (loading && !data) return <AdminLoading label="Loading audit log…" />;
  if (error && !data) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <AdminPageHeader
        title="Audit log"
        description="Staff actions across the platform — search, filter, and export."
      />

      <AdminStatGrid
        loading={loading}
        stats={[
          { label: 'Total entries (filtered)', value: data?.pagination?.total ?? 0 },
          { label: 'Page size', value: listParams.pageSize },
          { label: 'Current page', value: data?.pagination?.page ?? 1 },
        ]}
      />

      <AdminPanel
        title="Audit entries"
        actions={(
          <div className="flex flex-wrap gap-2">
            <AdminExportButton exportPath="/admin/audit/logs/export.csv" params={query} />
            {canClearAudit ? (
              <button
                type="button"
                disabled={clearing}
                onClick={() => void handleClearAuditLogs()}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Clear all logs'}
              </button>
            ) : null}
          </div>
        )}
      >
        <AdminFilterForm basePath={AUDIT_BASE} className="md:grid-cols-3 lg:grid-cols-5">
          <AdminFilterInput
            name="search"
            defaultValue={listParams.search}
            placeholder="Action, entity, email…"
            className="lg:col-span-2"
          />
          <AdminFilterSelect name="module" defaultValue={listParams.module}>
            <option value="">All modules</option>
            <option value="mission_engine">Mission Engine</option>
            <option value="journey">Journey</option>
            <option value="glow">GLOW</option>
            <option value="trust_safety">Trust & Safety</option>
            <option value="organizations">Organisations</option>
            <option value="system">System</option>
          </AdminFilterSelect>
          <AdminFilterInput name="action" defaultValue={listParams.action} placeholder="Action contains…" />
          <AdminFilterInput name="dateFrom" type="date" defaultValue={listParams.dateFrom} />
          <AdminFilterInput name="dateTo" type="date" defaultValue={listParams.dateTo} />
        </AdminFilterForm>

        <AdminTable
          loading={loading}
          columns={[
            {
              key: 'createdAt',
              label: 'When',
              render: (row) => new Date(row.createdAt).toLocaleString(),
            },
            { key: 'module', label: 'Module' },
            { key: 'action', label: 'Action' },
            { key: 'entityType', label: 'Entity type' },
            { key: 'entityId', label: 'Entity ID' },
            { key: 'actor', label: 'Actor', render: (row) => row.actor?.email ?? 'system' },
            { key: 'subject', label: 'Subject', render: (row) => row.subject?.email ?? '—' },
          ]}
          rows={(data?.items ?? []).map((log) => ({ ...log, _key: log.id }))}
          emptyMessage="No audit entries match these filters."
        />

        <AdminPagination pagination={data?.pagination} basePath={AUDIT_BASE} params={query} />
      </AdminPanel>
    </div>
  );
}

export function AdminHomePage() {
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const modules = new Set(adminProfile?.modules ?? []);
  const canAudit = adminProfile?.permissions?.includes('audit.read');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const overview = await api.admin.getOverview();
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load admin overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <AdminError message={error} onRetry={() => window.location.reload()} />;

  const t = data?.totals ?? {};
  const trends = data?.trends;

  const statCards = [
    {
      label: 'Users',
      value: loading ? null : t.users,
      weekHint: trends ? `+${trends.thisWeek?.newUsers ?? 0} this week` : null,
      href: modules.has('trust_safety') ? USERS_BASE : undefined,
    },
    {
      label: 'Missions in catalog',
      value: loading ? null : t.missions,
      href: modules.has('mission_engine') ? MISSION_BASE : undefined,
    },
    {
      label: 'Mission completions',
      value: loading ? null : t.completedMissions,
      weekHint: trends ? `+${trends.thisWeek?.missionCompletions ?? 0} this week` : null,
      href: modules.has('mission_engine') ? MISSION_BASE : undefined,
    },
    {
      label: 'GLOW seeds',
      value: loading ? null : t.glowSeeds,
      weekHint: trends ? `+${trends.thisWeek?.glowSeeds ?? 0} this week` : null,
      href: modules.has('glow') ? GLOW_BASE : undefined,
    },
    {
      label: 'Families',
      value: loading ? null : t.families,
      href: modules.has('trust_safety') ? USERS_BASE : undefined,
    },
    {
      label: 'Audit logs',
      value: loading ? null : t.auditLogs,
      weekHint: trends ? `+${trends.thisWeek?.auditEvents ?? 0} this week` : null,
      href: canAudit ? AUDIT_BASE : undefined,
    },
  ];

  const quickLinks = [
    modules.has('trust_safety')
      ? { label: 'User management', href: USERS_BASE, desc: 'Search accounts and open full user profiles.' }
      : null,
    modules.has('organizations')
      ? {
          label: 'Organisation demand',
          href: ORGS_BASE,
          desc: 'Interest signals, verify partnerships, approve memberships.',
        }
      : null,
    modules.has('mission_engine')
      ? { label: 'Missions', href: MISSION_BASE, desc: 'Browse and manage the mission catalog.' }
      : null,
    modules.has('journey')
      ? { label: 'Journey progress', href: JOURNEY_BASE, desc: 'See where users are on the step map.' }
      : null,
    modules.has('glow')
      ? { label: 'GLOW referrals', href: GLOW_BASE, desc: 'Track seeds sent, accepted, and expired.' }
      : null,
    canAudit ? { label: 'Audit log', href: AUDIT_BASE, desc: 'Review staff actions and changes.' } : null,
  ].filter(Boolean);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Platform snapshot at a glance. Use the shortcuts below to manage users, missions, and more."
      />

      <AdminStatGrid stats={statCards} loading={loading} />

      <AdminQuickLinks links={quickLinks} />

      {loading ? (
        <div className="mt-6">
          <AdminLoading label="Loading trends…" />
        </div>
      ) : (
        <AdminTrendPanel trends={trends} />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminPanel title="Missions by hill">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'hillCode', label: 'Hill' },
              { key: 'count', label: 'Missions' },
            ]}
            rows={(data?.missionsByHill ?? []).map((r) => ({ ...r, _key: r.hillCode }))}
          />
        </AdminPanel>
        <AdminPanel title="Camp checkpoints">
          <AdminTable
            loading={loading}
            columns={[
              { key: 'name', label: 'Camp' },
              { key: 'stepThreshold', label: 'Step' },
              { key: 'coinReward', label: 'Reward' },
            ]}
            rows={(data?.camps ?? []).map((c) => ({ ...c, _key: c.id }))}
          />
        </AdminPanel>
      </div>
    </div>
  );
}
