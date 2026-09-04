import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import {
  buildFamilyPayload,
  FamilyDetailsForm,
  validateFamilyDetails,
} from './FamilyDetailsForm';

const EMPTY_FAMILY = {
  familyName: '',
  myRole: '',
  pendingMembers: [],
};

export function FamilyDetailsModal({ open, onClose, onSaved }) {
  const [familyDetails, setFamilyDetails] = useState(EMPTY_FAMILY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    const validationError = validateFamilyDetails(familyDetails);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchFamily(buildFamilyPayload(familyDetails));
      onSaved?.(result);
      setFamilyDetails(EMPTY_FAMILY);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save family details');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-details-title"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
          <div>
            <h2 id="family-details-title" className="font-display text-xl font-semibold text-violet-900">
              Family details
            </h2>
            <p className="mt-1 text-sm text-violet-700/75">
              Add your role and invite family members when you are ready.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-violet-500 hover:bg-violet-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <FamilyDetailsForm
            familyDetails={familyDetails}
            onChange={(next) => {
              setFamilyDetails(next);
              if (error) setError('');
            }}
          />
        </div>

        <div className="border-t border-violet-100 px-5 py-4">
          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 disabled:bg-violet-300"
          >
            {submitting ? 'Saving…' : 'Save family details'}
          </button>
        </div>
      </div>
    </div>
  );
}
