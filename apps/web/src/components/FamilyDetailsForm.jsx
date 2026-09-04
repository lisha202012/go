import { useEffect, useState } from 'react';
import { FAMILY_MEMBER_ROLES, emptyPendingMember } from '../lib/familyRoles';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

function PersonAvatar({ person, className = 'h-10 w-10' }) {
  const initial = (person?.username?.[0] ?? '?').toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-sm font-bold text-violet-700 ${className}`}
    >
      {person?.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

function MemberUsernameSearch({ member, onChange, glowQuota, onGlowQuotaChange }) {
  const me = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendMessage, setSendMessage] = useState('');

  const typed = member.inviteEmail || member.inviteUsername || '';
  const trimmedTyped = typed.trim();
  const isEmail = trimmedTyped.includes('@') && !trimmedTyped.startsWith('@');
  const query = isEmail ? '' : (member.inviteUsername || '');
  const matched = member.matchedUser;
  const showResults = !matched && !isEmail && query.trim().length >= 1;

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    setSendError('');
    if (!showResults || q.length < 1) {
      setPeople([]);
      setSearchError('');
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await api.searchGlowPeople(q);
        if (cancelled) return;
        const others = (result.people ?? []).filter(
          (p) =>
            !p.officialAccount &&
            p.username.toLowerCase() !== me?.username?.toLowerCase(),
        );
        setPeople(others);
        setSearchError(others.length === 0 ? `No members match “${q}”.` : '');
      } catch (err) {
        if (cancelled) return;
        setPeople([]);
        setSearchError(err.message || 'Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, showResults, me?.username]);

  function pickPerson(person) {
    onChange({
      inviteUsername: person.username,
      inviteEmail: '',
      displayName: member.displayName || person.username,
      matchedUser: person,
      glowSeedSent: false,
    });
    setPeople([]);
    setSearchError('');
    setSendMessage('');
  }

  function clearMatch() {
    onChange({
      matchedUser: null,
      glowSeedSent: false,
    });
    setSendMessage('');
  }

  async function sendSeed() {
    if (!matched?.username) return;
    setSending(true);
    setSendError('');
    try {
      const result = await api.sendGlowSeed(matched.username);
      onChange({
        glowSeedSent: true,
        matchedUser: {
          ...matched,
          alreadyHasGlowSeed: true,
          referredBy: me
            ? {
                id: me.id,
                username: me.username,
                flowIndex: me.flowIndex,
                growthCoinsLifetime: me.growthCoinsLifetime,
                currentStreak: me.currentStreak,
                treeLevel: me.treeLevel,
              }
            : matched.referredBy,
        },
      });
      setSendMessage(result.message || `Glow Seed sent to @${matched.username}`);
      if (typeof result.seedInventoryCount === 'number' && me) {
        updateUser({ ...me, seedInventoryCount: result.seedInventoryCount });
      }
      if (typeof result.sentThisMonth === 'number') {
        onGlowQuotaChange?.({
          sentThisMonth: result.sentThisMonth,
          monthlyLimit: result.monthlyLimit ?? glowQuota?.monthlyLimit ?? 49,
        });
      }
    } catch (err) {
      setSendError(err.message || 'Could not send Glow Seed');
    } finally {
      setSending(false);
    }
  }

  const referredByYou =
    matched?.referredBy?.username &&
    matched.referredBy.username.toLowerCase() === me?.username?.toLowerCase();
  const alreadyHasSeed = Boolean(matched?.alreadyHasGlowSeed);
  const inventory = me?.seedInventoryCount ?? 0;
  const sentThisMonth = glowQuota?.sentThisMonth ?? 0;
  const monthlyLimit = glowQuota?.monthlyLimit ?? 49;
  const monthlyCapReached = sentThisMonth >= monthlyLimit;

  return (
    <div className="mt-3">
      <label className="block text-xs font-semibold text-violet-700 uppercase">
        Email or username
        <input
          value={typed}
          onChange={(e) => {
            const value = e.target.value;
            const trimmed = value.trim();
            const looksLikeEmail = trimmed.includes('@') && !trimmed.startsWith('@');
            if (looksLikeEmail) {
              onChange({
                inviteEmail: trimmed,
                inviteUsername: '',
                matchedUser: null,
                glowSeedSent: false,
              });
            } else {
              onChange({
                inviteUsername: value.replace(/^\s+/, ''),
                inviteEmail: '',
                matchedUser: null,
                glowSeedSent: false,
              });
            }
            setSendMessage('');
            setSendError('');
          }}
          placeholder="Search username or mom@email.com"
          autoComplete="off"
          className="mt-1.5 w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
        />
      </label>
      <p className="mt-1 text-[11px] text-violet-600/80">
        Type a username to find family already on GoFam.
      </p>

      {searching ? <p className="mt-1.5 text-[11px] text-violet-500">Searching…</p> : null}
      {searchError && showResults ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-800">{searchError}</p>
      ) : null}

      {showResults && people.length > 0 ? (
        <ul className="mt-2 divide-y divide-violet-100 overflow-hidden rounded-xl border border-violet-100">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => pickPerson(person)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50"
              >
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-violet-900">
                    {person.displayName || person.username}
                  </span>
                  <span className="block text-[11px] text-violet-600">
                    @{person.username}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-violet-700">Select</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {matched ? (
        <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <PersonAvatar person={matched} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-950">
                  {matched.displayName || matched.username}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-emerald-900">
                  @{matched.username}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearMatch}
              className="text-[11px] font-medium text-violet-600 hover:text-violet-800"
            >
              Change
            </button>
          </div>

          {member.glowSeedSent || sendMessage ? (
            <p className="mt-2 text-xs font-medium text-emerald-800">
              {sendMessage || `Glow Seed sent to @${matched.username}`}
            </p>
          ) : alreadyHasSeed ? (
            <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-emerald-900">
              <p>
                They already have a GLOW seed
                {matched.referredBy?.username ? (
                  <>
                    {' '}
                    from{' '}
                    <span className="font-semibold">
                      @{matched.referredBy.username}
                    </span>
                    {referredByYou ? ' (you)' : ''}
                  </>
                ) : null}
                . No second seed is sent.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={sending || inventory < 1 || monthlyCapReached}
              onClick={sendSeed}
              className="mt-2.5 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            >
              {sending
                ? 'Sending…'
                : monthlyCapReached
                  ? `Monthly limit reached (${monthlyLimit})`
                  : inventory < 1
                    ? 'Need a GLOW seed in inventory'
                    : `Send GLOW seed to @${matched.username}`}
            </button>
          )}
          {!member.glowSeedSent && !sendMessage && !alreadyHasSeed && inventory < 1 ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
              Saving family details still sends a family invite. They will see it on GLOW. A Glow
              Seed can be sent later when you have one in inventory.
            </p>
          ) : null}
          {sendError ? <p className="mt-1.5 text-[11px] font-medium text-rose-700">{sendError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function FamilyDetailsForm({ familyDetails, onChange }) {
  const pendingMembers = familyDetails.pendingMembers ?? [];
  const [glowQuota, setGlowQuota] = useState({ sentThisMonth: 0, monthlyLimit: 49 });

  useEffect(() => {
    let cancelled = false;
    api
      .getGlowHub()
      .then((hub) => {
        if (cancelled) return;
        setGlowQuota({
          sentThisMonth: hub.sentThisMonth ?? 0,
          monthlyLimit: hub.monthlyLimit ?? 49,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function updatePendingMember(index, patch) {
    const next = pendingMembers.map((member, i) =>
      i === index ? { ...member, ...patch } : member,
    );
    onChange({ ...familyDetails, pendingMembers: next });
  }

  function addPendingMember() {
    onChange({
      ...familyDetails,
      pendingMembers: [...pendingMembers, emptyPendingMember()],
    });
  }

  function removePendingMember(index) {
    onChange({
      ...familyDetails,
      pendingMembers: pendingMembers.filter((_, i) => i !== index),
    });
  }

  return (
    <>
      <label className="block text-xs font-semibold tracking-wide text-violet-700 uppercase">
        Family name (optional)
        <input
          value={familyDetails.familyName}
          onChange={(e) => onChange({ ...familyDetails, familyName: e.target.value })}
          className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          placeholder="The Growers"
        />
      </label>

      <label className="mt-4 block text-xs font-semibold tracking-wide text-violet-700 uppercase">
        Your role in the family (optional)
        <select
          value={familyDetails.myRole || ''}
          onChange={(e) =>
            onChange({ ...familyDetails, myRole: e.target.value || null })
          }
          className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        >
          <option value="">Select your role</option>
          {FAMILY_MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-violet-700 uppercase">
            Family members (optional)
          </p>
          <button
            type="button"
            onClick={addPendingMember}
            className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-violet-200"
          >
            + Add member
          </button>
        </div>
        <p className="mt-1 text-xs text-violet-700/70">
          Add Mom, Dad, siblings, or grandparents. They can accept later with their own account.
        </p>

        {pendingMembers.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-5 text-center text-sm text-violet-700/80">
            No members added yet. Tap &ldquo;Add member&rdquo; to invite family.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingMembers.map((member, index) => (
              <div
                key={index}
                className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-100/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-violet-800">Member {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removePendingMember(index)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>

                <label className="mt-3 block text-xs font-semibold text-violet-700 uppercase">
                  Role
                  <select
                    value={member.role}
                    onChange={(e) => updatePendingMember(index, { role: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  >
                    {FAMILY_MEMBER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-xs font-semibold text-violet-700 uppercase">
                  Date of birth
                  <input
                    type="date"
                    value={member.dateOfBirth || ''}
                    onChange={(e) => updatePendingMember(index, { dateOfBirth: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </label>

                <label className="mt-3 block text-xs font-semibold text-violet-700 uppercase">
                  Name (optional)
                  <input
                    value={member.displayName}
                    onChange={(e) =>
                      updatePendingMember(index, { displayName: e.target.value })
                    }
                    placeholder="Granny, Sis, etc."
                    className="mt-1.5 w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </label>

                <MemberUsernameSearch
                  member={member}
                  onChange={(patch) => updatePendingMember(index, patch)}
                  glowQuota={glowQuota}
                  onGlowQuotaChange={setGlowQuota}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function validateFamilyDetails(familyDetails) {
  const familyName = familyDetails.familyName?.trim();
  const myRole = familyDetails.myRole;
  const pendingMembers = familyDetails.pendingMembers ?? [];

  const incompleteMembers = pendingMembers.filter((member) => {
    const hasIdentity = Boolean(member.inviteEmail?.trim()) || Boolean(member.inviteUsername?.trim());
    const hasDob = Boolean(member.dateOfBirth);
    return !hasIdentity || !hasDob;
  });

  if (pendingMembers.length > 0 && incompleteMembers.length > 0) {
    return 'Add a date of birth and an email or username for each family member.';
  }

  if (!familyName && !myRole && pendingMembers.length === 0) {
    return 'Add a family name, your role, or a family member before saving.';
  }

  return '';
}

export function buildFamilyPayload(familyDetails) {
  const pendingMembers = familyDetails.pendingMembers ?? [];
  const cleanedPending = pendingMembers
    .map((member) => ({
      role: member.role,
      displayName: member.displayName?.trim() || null,
      dateOfBirth: member.dateOfBirth || null,
      ageCategory: member.ageCategory || null,
      inviteEmail: member.inviteEmail?.trim() || null,
      inviteUsername: member.inviteUsername?.trim() || null,
    }))
    .filter(
      (member) => member.dateOfBirth && (member.inviteEmail || member.inviteUsername),
    );

  return {
    familyName: familyDetails.familyName || null,
    myRole: familyDetails.myRole || null,
    pendingMembers: cleanedPending,
  };
}
