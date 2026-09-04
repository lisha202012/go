import { AGE_CATEGORIES, formatAgeCategoryOption } from '../lib/ageCategories';

export function AgeCategorySelect({
  value,
  onChange,
  id,
  className = 'mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200',
  placeholder = 'Select age category',
  required = false,
}) {
  return (
    <select
      id={id}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      required={required}
      className={className}
    >
      <option value="">{placeholder}</option>
      {AGE_CATEGORIES.map((category) => (
        <option key={category.code} value={category.code}>
          {formatAgeCategoryOption(category)}
        </option>
      ))}
    </select>
  );
}
