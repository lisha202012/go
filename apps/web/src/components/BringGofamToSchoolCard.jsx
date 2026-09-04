import { useState } from 'react';
import { Copy, Mail, Share2, UserPlus, Users } from 'lucide-react';

function joinUrl() {
  return `${window.location.origin}/login`;
}

function buildShareText(organizationName) {
  return `I'm helping bring GOFAM to ${organizationName}! Join me and add your interest — it helps schools see community demand (this doesn't verify school membership). ${joinUrl()}`;
}

function buildParentText(organizationName) {
  return `Hi — I'm using GOFAM for personal growth and registered interest in bringing GOFAM to ${organizationName}. GOFAM is a virtue-growth app for families. Would you help us ask the school about partnering? Learn more: ${joinUrl()}`;
}

function buildSchoolEmail(organizationName) {
  return `Subject: Student interest in GOFAM for ${organizationName}

Dear ${organizationName} team,

Members of our school community have expressed interest in GOFAM — a family virtue-growth platform. GOFAM would like to explore a verified school partnership.

Please contact GOFAM partnerships to learn more.

Thank you.`;
}

async function copyText(text, onDone) {
  try {
    await navigator.clipboard.writeText(text);
    onDone();
    return true;
  } catch {
    return false;
  }
}

async function shareOrCopy(title, text, onDone, onError) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      onDone();
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const ok = await copyText(text, onDone);
  if (!ok) onError('Could not share — try copying instead.');
}

export function BringGofamToSchoolCard({ organizationName, interestCount, onDismiss }) {
  const [copiedAction, setCopiedAction] = useState('');
  const [error, setError] = useState('');

  function markCopied(action) {
    setCopiedAction(action);
    setError('');
    setTimeout(() => setCopiedAction(''), 2500);
  }

  const shareText = buildShareText(organizationName);

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Bring GOFAM to my school</p>
      <p className="mt-1 text-sm font-semibold text-amber-950">{organizationName}</p>
      {interestCount != null ? (
        <p className="mt-1 text-xs text-amber-700">
          {interestCount} {interestCount === 1 ? 'person has' : 'people have'} expressed interest so far
          (aggregate only — not verified students).
        </p>
      ) : null}
      <p className="mt-2 text-xs text-amber-800/90">
        Help your community grow the signal. Sharing interest does not verify school membership.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            void shareOrCopy(
              `Bring GOFAM to ${organizationName}`,
              shareText,
              () => markCopied('classmates'),
              setError,
            )
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200 hover:bg-violet-50"
        >
          <UserPlus className="h-4 w-4" />
          {copiedAction === 'classmates' ? 'Shared!' : 'Invite classmates'}
        </button>

        <button
          type="button"
          onClick={() =>
            void shareOrCopy(
              'Join GOFAM',
              shareText,
              () => markCopied('friends'),
              setError,
            )
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200 hover:bg-violet-50"
        >
          <Share2 className="h-4 w-4" />
          {copiedAction === 'friends' ? 'Shared!' : 'Share with friends'}
        </button>

        <button
          type="button"
          onClick={() =>
            void copyText(buildParentText(organizationName), () => markCopied('parent')).then((ok) => {
              if (!ok) setError('Could not copy — try again.');
            })
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200 hover:bg-violet-50"
        >
          <Users className="h-4 w-4" />
          {copiedAction === 'parent' ? 'Copied!' : 'Share with parent'}
        </button>

        <button
          type="button"
          onClick={() =>
            void copyText(buildSchoolEmail(organizationName), () => markCopied('school')).then((ok) => {
              if (!ok) setError('Could not copy — try again.');
            })
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200 hover:bg-violet-50"
        >
          <Mail className="h-4 w-4" />
          {copiedAction === 'school' ? 'Copied!' : 'Tell my school'}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
        >
          <Copy className="h-3 w-3" />
          Done for now
        </button>
      ) : null}
    </div>
  );
}
