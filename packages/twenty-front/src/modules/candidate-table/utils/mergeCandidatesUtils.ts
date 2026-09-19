/**
 * Transforms a candidate node (from get-candidates-by-project-id) to linkedin_premium
 * format for upload-profiles. Used when merging candidates from multiple jobs.
 */
export type CandidateNodeFromApi = {
  id: string;
  name?: string;
  peopleId?: string;
  people?: {
    phones?: { primaryPhoneNumber?: string };
    emails?: { primaryEmail?: string };
    linkedinLink?: { primaryLinkUrl?: string; primaryLinkLabel?: string };
    jobTitle?: string;
    jobCompanyName?: string;
    uniqueStringKey?: string;
  };
};

export const candidateToLinkedInPremiumFormat = (
  candidate: CandidateNodeFromApi,
): Record<string, unknown> => {
  const person = candidate.people;
  const linkedinUrl =
    typeof person?.linkedinLink === 'object' && person.linkedinLink
      ? person.linkedinLink.primaryLinkUrl ??
        person.linkedinLink.primaryLinkLabel
      : '';
  const publicIdentifier =
    linkedinUrl && typeof linkedinUrl === 'string'
      ? linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').split('/')[0]
      : '';
  const uniqueStringKey =
    person?.uniqueStringKey ||
    (linkedinUrl && typeof linkedinUrl === 'string' ? linkedinUrl : `candidate-${candidate.id}`);
  const email = person?.emails?.primaryEmail;
  const phone = person?.phones?.primaryPhoneNumber;

  return {
    full_name: candidate.name ?? 'Unknown',
    job_title: person?.jobTitle ?? '',
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
