export function buildInviteMessage(shareUrl, username) {
  const from = username ? `@${username}` : 'A friend';
  return [
    `Hey! ${from} invited you to GOFAM GROW.`,
    '',
    'I planted a GLOW Seed for you — open the link, create your account, and bloom it with me.',
    '',
    shareUrl,
  ].join('\n');
}
