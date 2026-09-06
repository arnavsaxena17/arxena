import { type UploadProfilesPerson } from 'src/engine/core-modules/outreach-command/utils/normalize-upload-people.util';

export const OUTREACH_MOCK_UPLOAD_DEFAULT_COUNT = 5;
export const OUTREACH_MOCK_UPLOAD_MAX_COUNT = 100;

export const resolveOutreachMockUploadCount = (
  count: number | undefined,
): number => {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return OUTREACH_MOCK_UPLOAD_DEFAULT_COUNT;
  }

  const floored = Math.floor(count);

  if (floored < 1) {
    throw new Error('count must be at least 1');
  }

  if (floored > OUTREACH_MOCK_UPLOAD_MAX_COUNT) {
    throw new Error(
      `count must be at most ${OUTREACH_MOCK_UPLOAD_MAX_COUNT}`,
    );
  }

  return floored;
};

// Unique companies so maxPersonasPerCompany does not defer everyone into one firm.
export const buildOutreachMockUploadPeople = ({
  count,
  projectId,
  stamp = Date.now(),
}: {
  count: number;
  projectId: string;
  stamp?: number;
}): UploadProfilesPerson[] =>
  Array.from({ length: count }, (_, index) => {
    const profileNumber = index + 1;
    const slug = `mock-bc-profile-${stamp}-${profileNumber}`;

    return {
      name: `Mock Profile ${profileNumber}`,
      firstName: 'Mock',
      lastName: `Profile${profileNumber}`,
      title: 'VP Talent',
      headline: 'Mock headline for outreach path testing',
      company: `Mock Co ${profileNumber}`,
      companyName: `Mock Co ${profileNumber}`,
      linkedinUrl: `https://www.linkedin.com/in/${slug}`,
      linkedinProfileId: slug,
      projectId,
      location: 'Bengaluru, India',
    };
  });
