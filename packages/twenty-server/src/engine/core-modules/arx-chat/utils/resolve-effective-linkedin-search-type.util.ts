import type { LinkedinSessionHandle } from '../services/linkedin-unipile-session.service';

export const resolveEffectiveLinkedinSearchType = (
  clientSearchType: 'classic' | 'sales_navigator' | 'recruiter' | undefined,
  session: LinkedinSessionHandle,
  inferSearchTypeEnabled: boolean,
): 'classic' | 'sales_navigator' | 'recruiter' => {
  const resolvedClientType = clientSearchType ?? 'classic';

  if (!inferSearchTypeEnabled && clientSearchType !== undefined) {
    return resolvedClientType;
  }

  if (
    clientSearchType &&
    clientSearchType !== session.inferredSearchType &&
    inferSearchTypeEnabled
  ) {
    // Caller may log mismatch; prefer inferred when flag is on.
  }

  return session.inferredSearchType;
};
