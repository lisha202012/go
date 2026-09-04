import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AVATAR_OPTIONS, refreshAvatarOptions } from '../pages/onboarding/avatars';

export function AvatarPickerModal({ open, currentUrl, onClose, onSave, saving = false }) {
  const [selected, setSelected] = useState(currentUrl);
  const [avatarOptions, setAvatarOptions] = useState([...AVATAR_OPTIONS]);

  useEffect(() => {
    if (open) {
      refreshAvatarOptions().then((options) => setAvatarOptions([...options]));
    }
  }, [open]);

  useEffect(() => {
    if (open) setSelected(currentUrl);
  }, [open, currentUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-picker-title"
    >
      <div className="max-h-[85dvh] w-full max-w-app overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="avatar-picker-title" className="font-display text-lg font-semibold text-violet-950">
              Change avatar
            </h2>
            <p className="text-xs text-violet-600">Pick a look that feels like you</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-violet-500 hover:bg-violet-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {avatarOptions.map((url) => {
            const isSelected = selected === url;
            return (
              <button
                key={url}
                type="button"
                onClick={() => setSelected(url)}
                className={[
                  'aspect-square overflow-hidden rounded-xl bg-violet-50 p-0.5 transition',
                  isSelected
                    ? 'ring-2 ring-violet-600 ring-offset-2'
                    : 'ring-1 ring-violet-100 hover:ring-violet-300',
                ].join(' ')}
              >
                <img src={url} alt="" className="h-full w-full rounded-[10px] object-cover" />
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-violet-200 py-3 text-sm font-semibold text-violet-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || saving}
            onClick={() => onSave(selected)}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:bg-violet-300"
          >
            {saving ? 'Saving…' : 'Save avatar'}
          </button>
        </div>
      </div>
    </div>
  );
}
