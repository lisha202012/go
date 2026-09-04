import { useEffect, useState } from 'react';
import { AVATAR_OPTIONS, refreshAvatarOptions } from '../avatars';

export function AvatarStep({ avatarUrl, onSelect, onNext }) {
  const [avatarOptions, setAvatarOptions] = useState([...AVATAR_OPTIONS]);

  useEffect(() => {
    refreshAvatarOptions().then((options) => setAvatarOptions([...options]));
  }, []);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <h2 className="font-display text-2xl font-semibold text-violet-900">Create your avatar</h2>
      <p className="mt-2 text-sm text-violet-800/70">Pick a look that feels like you.</p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {avatarOptions.map((url) => {
          const selected = avatarUrl === url;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onSelect(url)}
              className={[
                'aspect-square overflow-hidden rounded-2xl bg-violet-50 p-1 transition',
                selected
                  ? 'ring-4 ring-violet-500 ring-offset-2 ring-offset-violet-50'
                  : 'ring-1 ring-violet-100 hover:ring-violet-300',
              ].join(' ')}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!avatarUrl}
        onClick={onNext}
        className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        Continue
      </button>
    </section>
  );
}
