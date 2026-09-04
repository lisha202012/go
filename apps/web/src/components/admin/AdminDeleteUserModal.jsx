import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function AdminDeleteUserModal({ open, user, deleting = false, error = '', onClose, onConfirm }) {
  const [emailInput, setEmailInput] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (open) {
      setEmailInput('');
      setLocalError('');
    }
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, deleting, onClose]);

  if (!open || !user) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (emailInput.trim().toLowerCase() !== user.email.toLowerCase()) {
      setLocalError('Email does not match. Type the exact address shown below.');
      return;
    }
    setLocalError('');
    onConfirm();
  }

  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delete-user-title" className="font-display text-lg font-semibold text-slate-900">
                Delete user permanently
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {user.username} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900">
            This removes <strong>all related data</strong>: missions, GLOW seeds, journey progress, coins,
            sessions, and family links. This action cannot be undone.
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Type <span className="font-semibold text-slate-900">{user.email}</span> to confirm
            </span>
            <input
              type="email"
              autoComplete="off"
              autoFocus
              disabled={deleting}
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (localError) setLocalError('');
              }}
              placeholder={user.email}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-amber-500 focus:border-amber-500 focus:ring-2 disabled:bg-slate-50"
            />
          </label>

          {displayError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{displayError}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleting || !emailInput.trim()}
              className="inline-flex min-w-[9rem] items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting…
                </>
              ) : (
                'Delete permanently'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
