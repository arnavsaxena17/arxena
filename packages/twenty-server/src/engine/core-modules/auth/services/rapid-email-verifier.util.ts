import { type RapidEmailVerifierResponse } from 'src/engine/core-modules/auth/services/rapid-email-verifier.types';

export const getSignupEmailRejectionMessage = (
  data: RapidEmailVerifierResponse,
): string | null => {
  if (data.typoSuggestion) {
    return `That email looks like a typo. Did you mean ${data.typoSuggestion}?`;
  }

  if (data.aliasOf) {
    return `Please sign up with your primary email (${data.aliasOf}) instead of an alias address.`;
  }

  const v = data.validations;

  if (!v.syntax) {
    return 'Please enter a valid email address.';
  }

  if (v.is_disposable) {
    return 'Disposable email addresses are not allowed. Please use a permanent work email.';
  }

  if (v.is_role_based) {
    return 'Please sign up with a personal email at your company, not a shared role (for example info@ or support@).';
  }

  if (!v.mx_records) {
    return 'This email domain cannot receive mail. Check the spelling or use your company email.';
  }

  return null;
};
