/**
 * Transforms a candidate node (from get-candidates-by-project-id) to linkedin_premium
 * format for upload-profiles. Used when merging candidates from multiple jobs.
 */
export type CandidateNodeFromApi = {
  id: string;
  name?: string;
  peopleId?: string;
  phoneNumber?: { primaryPhoneNumber?: string };
  email?: { primaryEmail?: string };
  linkedinUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string };
  uniqueStringKey?: string;
  jobTitle?: string;
  jobCompanyName?: string;
};

export const candidateToLinkedInPremiumFormat = (
  candidate: CandidateNodeFromApi,
): Record<string, unknown> => {
  const linkedinUrl =
    typeof candidate.linkedinUrl === 'object' && candidate.linkedinUrl
      ? candidate.linkedinUrl.primaryLinkUrl ?? candidate.linkedinUrl.primaryLinkLabel
      : typeof candidate.linkedinUrl === 'string'
        ? candidate.linkedinUrl
        : '';
  const publicIdentifier =
    linkedinUrl && typeof linkedinUrl === 'string'
      ? linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').split('/')[0]
      : '';
  const uniqueStringKey =
    candidate.uniqueStringKey ||
    (linkedinUrl && typeof linkedinUrl === 'string' ? linkedinUrl : `candidate-${candidate.id}`);
  const email =
    typeof candidate.email === 'object' && candidate.email
      ? candidate.email.primaryEmail
      : undefined;
  const phone =
    typeof candidate.phoneNumber === 'object' && candidate.phoneNumber
      ? candidate.phoneNumber.primaryPhoneNumber
      : undefined;

  return {
    full_name: candidate.name ?? 'Unknown',
    job_title: candidate.jobTitle ?? '',
    linkedin_url: linkedinUrl,
    profile_url: linkedinUrl,
    public_identifier: publicIdentifier || undefined,
    linkedin_profile_id_url: linkedinUrl,
    uniqueStringKey,
    email_address: email,
    phone_number: phone,
    raw: {
      email,
      phone,
      peopleId: candidate.peopleId,
    },
  };
};

/**
 * Deduplicate candidates by peopleId. When merging from multiple jobs,
 * the same person may appear in several source jobs - we create one new
 * candidate per person in the target job.
 */
export const deduplicateCandidatesByPeopleId = <T extends { peopleId?: string }>(
  candidates: T[],
): T[] => {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const pid = c.peopleId ?? c.id;
    if (seen.has(pid)) return false;
    seen.add(pid);
    return true;
  });
};
