import { useEffect, useMemo, useState } from 'react';
import { api, SessionExpiredError } from '../../../lib/api';
import {
  dateOfBirthInputBounds,
  derivedCategoryLabel,
  deriveAgeCategoryFromDob,
  isValidDateOfBirth,
  parseDateOnly,
} from '../../../lib/deriveAgeFromDob';
import { useAuthStore } from '../../../store/useAuthStore';
import { AVATAR_OPTIONS } from '../avatars';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function UsernameStep({
  displayName,
  username,
  dateOfBirth,
  avatarUrl,
  onDisplayNameChange,
  onChange,
  onDateOfBirthChange,
  onAvatarChange,
  onSaved,
}) {
  const savedUsername = useAuthStore((s) => s.user?.username);
  const savedDisplayName = useAuthStore((s) => s.user?.displayName);
  const savedDateOfBirth = useAuthStore((s) => s.user?.dateOfBirth);
  const [availability, setAvailability] = useState(null);
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const { min: dobMin, max: dobMax } = useMemo(() => dateOfBirthInputBounds(), []);

  const derivedCategory = useMemo(() => {
    if (!isValidDateOfBirth(dateOfBirth)) return null;
    const dob = parseDateOnly(dateOfBirth);
    return deriveAgeCategoryFromDob(dob);
  }, [dateOfBirth]);

  const derivedLabel = derivedCategory ? derivedCategoryLabel(derivedCategory) : null;

  useEffect(() => {
    if (!USERNAME_REGEX.test(username)) {
      setAvailability(null);
      setCheckError('');
      return undefined;
    }

    const isOwnUsername =
      savedUsername && username === savedUsername && !/^u_[a-f0-9]{12}$/.test(savedUsername);
    if (isOwnUsername) {
      setAvailability(true);
      setChecking(false);
      setCheckError('');
      return undefined;
    }

    setChecking(true);
    setCheckError('');
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUsername(username);
        setAvailability(result.available);
        setCheckError('');
      } catch (err) {
        setAvailability(null);
        setCheckError(err.message || 'Could not check username availability');
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, savedUsername]);

  const usernameValid = USERNAME_REGEX.test(username);
  const displayNameValid = Boolean(displayName?.trim());
  const dobValid = isValidDateOfBirth(dateOfBirth);
  const profileAlreadySaved =
    Boolean(savedUsername) &&
    username === savedUsername &&
    Boolean(displayName) &&
    displayName === (savedDisplayName ?? '') &&
    Boolean(dateOfBirth) &&
    dateOfBirth === savedDateOfBirth &&
    !/^u_[a-f0-9]{12}$/.test(savedUsername);
  const canContinue =
    displayNameValid &&
    usernameValid &&
    dobValid &&
    !checking &&
    !submitting &&
    (availability === true || profileAlreadySaved);

  async function handleContinue() {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.patchProfile({
        displayName: displayName.trim(),
        username: username.trim(),
        dateOfBirth,
      });
      onSaved(result.user);
    } catch (err) {
      if (err instanceof SessionExpiredError || err.status === 401) {
        useAuthStore.getState().clearAuth();
        setError('Your session expired. Please sign in again.');
        window.location.replace('/login');
        return;
      }
      setError(err.message || 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <h2 className="font-display text-2xl font-semibold text-violet-900">
        What should we call you?
      </h2>
      <p className="mt-2 text-sm text-violet-800/70">
        Your display name is how GOFAM greets you. Pick a username and date of birth — we&apos;ll
        match missions and assessments to your stage automatically.
      </p>

      <label className="mt-6 block text-xs font-semibold tracking-wide text-violet-700 uppercase">
        Display name <span className="normal-case text-rose-600">(required)</span>
        <input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          autoComplete="nickname"
          required
        />
      </label>
      {!displayNameValid ? (
        <p className="mt-1.5 text-xs text-violet-500">What should we call you in GOFAM?</p>
      ) : null}

      {avatarUrl ? (
        <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowAvatarPicker((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
            aria-label="Change avatar"
            aria-expanded={showAvatarPicker}
          >
            <img
              src={avatarUrl}
              alt="Your avatar"
              className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover ring-2 ring-violet-300"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-violet-600 uppercase">
                Your avatar
              </p>
              <p className="text-sm text-violet-800/70">
                {showAvatarPicker ? 'Pick one below' : 'Tap to change'}
              </p>
            </div>
          </button>

          {showAvatarPicker ? (
            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-violet-100 pt-4">
              {AVATAR_OPTIONS.map((url) => {
                const selected = avatarUrl === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      onAvatarChange(url);
                      setShowAvatarPicker(false);
                    }}
                    className={[
                      'aspect-square overflow-hidden rounded-xl bg-white p-0.5 transition',
                      selected
                        ? 'ring-3 ring-violet-500 ring-offset-1'
                        : 'ring-1 ring-violet-100 hover:ring-violet-300',
                    ].join(' ')}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <label
        className={`block text-xs font-semibold tracking-wide text-violet-700 uppercase ${avatarUrl ? 'mt-5' : 'mt-6'}`}
      >
        Username <span className="normal-case text-rose-600">(required)</span>
        <input
          value={username}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
          className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          placeholder="grow_with_me"
          autoComplete="username"
          required
        />
      </label>
      <p className="mt-1.5 min-h-5 text-xs">
        {!username ? (
          <span className="text-violet-500">Required · 3–20 letters, numbers, or underscore</span>
        ) : !usernameValid ? (
          <span className="text-rose-600">Invalid username format</span>
        ) : checking ? (
          <span className="text-violet-500">Checking availability…</span>
        ) : availability === true ? (
          <span className="text-emerald-600">Username is available</span>
        ) : availability === false ? (
          <span className="text-rose-600">Username is taken</span>
        ) : checkError ? (
          <span className="text-rose-600">{checkError}</span>
        ) : null}
      </p>

      <label
        className="mt-5 block text-xs font-semibold tracking-wide text-violet-700 uppercase"
        htmlFor="date-of-birth"
      >
        When were you born? <span className="normal-case text-rose-600">(required)</span>
        <input
          id="date-of-birth"
          type="date"
          value={dateOfBirth}
          min={dobMin}
          max={dobMax}
          onChange={(e) => onDateOfBirthChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          required
        />
      </label>
      {!dateOfBirth ? (
        <p className="mt-1.5 text-xs text-violet-500">
          Your date of birth helps GOFAM choose the right GAP and missions.
        </p>
      ) : !dobValid ? (
        <p className="mt-1.5 text-xs text-rose-600">Enter a valid date of birth.</p>
      ) : derivedLabel ? (
        <p className="mt-1.5 text-xs text-emerald-700">
          GOFAM stage: <span className="font-semibold">{derivedLabel}</span>
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={!canContinue}
        onClick={handleContinue}
        className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        {submitting ? 'Saving…' : 'Continue'}
      </button>
      {!canContinue && usernameValid && !dobValid ? (
        <p className="mt-2 text-center text-xs text-violet-600">
          Add your date of birth to continue.
        </p>
      ) : null}
    </section>
  );
}
