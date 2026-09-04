export const FAMILY_MEMBER_ROLES = [
  'Mom',
  'Dad',
  'Sister',
  'Brother',
  'Son',
  'Daughter',
  'Grandma',
  'Grandpa',
  'Aunt',
  'Uncle',
  'Cousin',
  'Other',
];

export function emptyPendingMember() {
  return {
    role: 'Mom',
    displayName: '',
    dateOfBirth: '',
    ageCategory: '',
    inviteEmail: '',
    inviteUsername: '',
  };
}
