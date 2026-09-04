import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { buildFamilyPayload, FamilyDetailsForm } from '../../../components/FamilyDetailsForm';
import { useAuthStore } from '../../../store/useAuthStore';

export function FamilyStep({ familyDetails, onChange, onNext, onNeedProfile }) {
  const user = useAuthStore((s) => s.user);
  const hasProfile = Boolean(user?.dateOfBirth || user?.ageGroup);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hasProfile) {
      onNeedProfile?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProfile]);

  async function saveFamily() {
    return api.patchFamily(buildFamilyPayload(familyDetails));
  }

  function handleProfileRequiredError(err) {
    const message = err?.message || '';
    if (/date of birth|age category/i.test(message)) {
      setError('Add your date of birth first — taking you back…');
      onNeedProfile?.();
      return true;
    }
    return false;
  }

  async function handleContinue() {
    setError('');
    setSubmitting(true);
    try {
      const result = await saveFamily();
      onNext(result.user);
    } catch (err) {
      if (!handleProfileRequiredError(err)) {
        setError(err.message || 'Could not save family details');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddLater() {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.skipFamily({ defer: true });
      onNext(result.user);
    } catch (err) {
      if (!handleProfileRequiredError(err)) {
        setError(err.message || 'Could not continue');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasProfile) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
        <h2 className="font-display text-2xl font-semibold text-violet-900">Profile needed</h2>
        <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
          Add your date of birth on the previous step before family details.
        </p>
        <button
          type="button"
          onClick={() => onNeedProfile?.()}
          className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30"
        >
          Back to profile
        </button>
      </section>
    );
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-6">
      <h2 className="font-display text-2xl font-semibold text-violet-900">Family details</h2>
      <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
        Optional — add your role and family members now, or add later from your profile.
      </p>

      <div className="mt-6 space-y-0">
        <FamilyDetailsForm familyDetails={familyDetails} onChange={onChange} />
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={handleContinue}
        className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 disabled:bg-violet-300"
      >
        {submitting ? 'Saving…' : 'Continue'}
      </button>

      <button
        type="button"
        disabled={submitting}
        onClick={handleAddLater}
        className="mt-3 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-50"
      >
        Add later
      </button>
    </section>
  );
}
