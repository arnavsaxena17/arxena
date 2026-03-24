const getDomainFromEmail = (email: string): string | undefined => {
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[1]) {
    return undefined;
  }
  return parts[1];
};

/**
 * Domains blocked on the client when creating a new workspace (not joining via invite).
 * The API enforces the full list via `isWorkEmail` + `email-providers.ts` (10k+ disposable/free domains).
 * This smaller set improves UX for the most common personal and disposable providers.
 */
const BLOCKED_SIGNUP_EMAIL_DOMAINS = new Set([
  // Disposable / temporary (also on server list; subset for early snackbar)
  '10minutemail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'moakt.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwaway.email',
  'trashmail.com',
  'yopmail.com',
  // Consumer / personal (subset)
  'aol.com',
  'att.net',
  'bellsouth.net',
  'charter.net',
  'comcast.net',
  'fastmail.com',
  'gmail.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'googlemail.com',
  'hey.com',
  'hotmail.co.uk',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mac.com',
  'mail.com',
  'mail.ru',
  'me.com',
  'msn.com',
  'outlook.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  
  'pm.me',
  'proton.me',
  'protonmail.com',
  'qq.com',
  'rocketmail.com',
  'sbcglobal.net',
  'tutanota.com',
  'verizon.net',
  'yahoo.co.uk',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'ymail.com',
  'yandex.com',
]);

export const isAllowedEmailForNewWorkspaceSignup = (email: string): boolean => {
  const domain = getDomainFromEmail(email);
  if (!domain) {
    return false;
  }
  return !BLOCKED_SIGNUP_EMAIL_DOMAINS.has(domain);
};
