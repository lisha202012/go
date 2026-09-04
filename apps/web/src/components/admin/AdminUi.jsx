export function AdminPageHeader({ title, description, eyebrow }) {
  return (
    <div className="mb-6 border-b border-slate-200 pb-4">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{eyebrow}</p> : null}
      <h2 className="mt-1 font-display text-2xl text-slate-900 sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}

export function AdminQuickLinks({ links }) {
  if (!links?.length) return null;
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <p className="font-semibold text-slate-900">{link.label}</p>
          <p className="mt-1 text-sm text-slate-600">{link.desc}</p>
        </a>
      ))}
    </section>
  );
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
    </div>
  );
}

export function AdminStatGrid({ stats, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: stats?.length || 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stats.map((stat) => {
        const inner = (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value ?? '—'}</p>
            {stat.hint ? <p className="mt-1 text-xs text-slate-500">{stat.hint}</p> : null}
            {stat.weekHint ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">{stat.weekHint}</p>
            ) : null}
          </>
        );

        if (stat.href) {
          return (
            <a
              key={stat.label}
              href={stat.href}
              className="group rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
            >
              {inner}
              <p className="mt-2 text-xs font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">
                View full list →
              </p>
            </a>
          );
        }

        return (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function AdminSparkline({ series = [], color = '#d97706' }) {
  if (!series.length) {
    return <div className="h-10 w-full rounded bg-slate-100" />;
  }
  const values = series.map((p) => p.count ?? 0);
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 40;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

export function AdminTrendPanel({ trends }) {
  if (!trends) return null;

  const cards = [
    {
      label: 'New users',
      week: trends.thisWeek?.newUsers ?? 0,
      series: trends.series?.newUsers ?? [],
      color: '#2563eb',
    },
    {
      label: 'Mission completions',
      week: trends.thisWeek?.missionCompletions ?? 0,
      series: trends.series?.missionCompletions ?? [],
      color: '#d97706',
    },
    {
      label: 'GLOW seeds planted',
      week: trends.thisWeek?.glowSeeds ?? 0,
      series: trends.series?.glowSeeds ?? [],
      color: '#059669',
    },
    {
      label: 'Audit activity',
      week: trends.thisWeek?.auditEvents ?? 0,
      series: trends.series?.auditEvents ?? [],
      color: '#7c3aed',
    },
  ];

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Current trends</h3>
          <p className="text-xs text-slate-500">Last 7 days — weekly totals with daily sparklines</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {card.week}
              <span className="ml-1 text-xs font-normal text-slate-500">this week</span>
            </p>
            <div className="mt-2">
              <AdminSparkline series={card.series} color={card.color} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminPanel({ title, children, className = '', actions = null }) {
  return (
    <section className={`mt-6 rounded-xl border border-slate-200 ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {actions}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminTable({ columns, rows, emptyMessage = 'No data yet.', loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-[640px] w-full text-left text-sm sm:min-w-full">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row._key} className="border-b border-slate-100 align-top hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-3 text-slate-700">
                  {col.render ? col.render(row, rowIndex) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminLoading({ label = 'Loading admin data…' }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
      {label}
    </div>
  );
}

export function AdminError({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function AdminBadge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700',
    staff: 'bg-amber-100 text-amber-900',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.gray}`}>
      {children}
    </span>
  );
}

export function AdminPagination({ pagination, basePath, params = {} }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const prevParams = { ...params, page: Math.max(1, pagination.page - 1) };
  const nextParams = { ...params, page: Math.min(pagination.totalPages, pagination.page + 1) };

  const qs = (p) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        search.set(k, String(v));
      }
    }
    const q = search.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
      </span>
      <div className="flex gap-2">
        {pagination.page <= 1 ? (
          <span className="rounded border px-3 py-1 opacity-40">Previous</span>
        ) : (
          <a href={qs(prevParams)} className="rounded border px-3 py-1 hover:bg-slate-50">
            Previous
          </a>
        )}
        {pagination.page >= pagination.totalPages ? (
          <span className="rounded border px-3 py-1 opacity-40">Next</span>
        ) : (
          <a href={qs(nextParams)} className="rounded border px-3 py-1 hover:bg-slate-50">
            Next
          </a>
        )}
      </div>
    </div>
  );
}

export function AdminExportButton({ exportPath, params, label = 'Export CSV' }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      onClick={async () => {
        const { triggerAdminCsvDownload } = await import('../../lib/adminPageNav');
        try {
          await triggerAdminCsvDownload(exportPath, params);
        } catch (err) {
          window.alert(err.message || 'Export failed');
        }
      }}
    >
      {label}
    </button>
  );
}

/** Full-page reload filter bar — submits via GET navigation. */
export function AdminFilterForm({ basePath, children, className = '' }) {
  return (
    <form
      method="get"
      action={basePath}
      className={`mb-4 grid gap-3 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const next = {};
        for (const [key, value] of fd.entries()) {
          if (String(value).length > 0) next[key] = value;
        }
        next.page = '1';
        const qs = new URLSearchParams(next).toString();
        window.location.assign(qs ? `${basePath}?${qs}` : basePath);
      }}
    >
      {children}
      <div className="flex flex-wrap gap-2 md:col-span-full">
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
        >
          Apply filters
        </button>
        <a href={basePath} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Reset
        </a>
      </div>
    </form>
  );
}

export function AdminFilterInput({ name, defaultValue, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      name={name}
      defaultValue={defaultValue ?? ''}
      placeholder={placeholder}
      className={`rounded-lg border border-slate-200 px-3 py-2 text-sm ${className}`}
    />
  );
}

export function AdminFilterSelect({ name, defaultValue, children, className = '' }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className={`rounded-lg border border-slate-200 px-3 py-2 text-sm ${className}`}
    >
      {children}
    </select>
  );
}
