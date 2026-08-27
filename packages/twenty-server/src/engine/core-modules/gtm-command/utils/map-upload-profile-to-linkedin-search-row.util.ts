import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';

const readString = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const primary = (value as Record<string, unknown>).primaryLinkUrl;

      if (typeof primary === 'string' && primary.trim()) {
        return primary.trim();
      }
    }
  }

  return '';
};

export const mapUploadProfileToLinkedinSearchRow = (
  row: unknown,
  companyId = '',
): Record<string, unknown> => {
  if (typeof row !== 'object' || row === null) {
    return {};
  }

  const person = row as Record<string, unknown>;
  const linkedinUrl =
    readString(person, [
      'linkedinUrl',
      'linkedinLink',
      'profileUrl',
      'profile_url',
    ]) ||
    (readString(person, ['linkedinProfileId', 'public_identifier'])
      ? `https://www.linkedin.com/in/${readString(person, ['linkedinProfileId', 'public_identifier'])}`
      : '');
  const linkedinProfileId =
    readString(person, ['linkedinProfileId', 'public_identifier']) ||
    extractLinkedinProfileId(linkedinUrl);
  const profilePictureUrl = readString(person, [
    'profilePictureUrl',
    'displayPicture',
    'profile_picture_url',
    'avatarUrl',
  ]);
  const firstName = readString(person, ['firstName', 'first_name']);
  const lastName = readString(person, ['lastName', 'last_name']);
  const name =
    readString(person, ['name', 'fullName']) ||
    [firstName, lastName].filter(Boolean).join(' ');
  const experience = Array.isArray(person.experience)
    ? person.experience[0]
    : Array.isArray(person.work_experience)
      ? person.work_experience[0]
      : null;
  const experienceRecord =
    experience && typeof experience === 'object'
      ? (experience as Record<string, unknown>)
      : null;
  const jobTitle =
    readString(person, ['title', 'jobTitle']) ||
    (experienceRecord
      ? readString(experienceRecord, ['position', 'title', 'jobTitle'])
      : '') ||
    readString(person, ['headline']);
  const headline = readString(person, ['headline', 'title', 'jobTitle']);
  const companyName =
    readString(person, ['company', 'companyName', 'jobCompanyName']) ||
    (experienceRecord
      ? readString(experienceRecord, ['company', 'companyName', 'company_name'])
      : '');
  const location = readString(person, ['location', 'locationName']);
  const resolvedCompanyId =
    readString(person, ['companyId']) || companyId.trim();
  const jobCompanyId = readString(person, ['jobCompanyId']);
  const incomingPositions = Array.isArray(person.current_positions)
    ? person.current_positions
    : Array.isArray(person.currentPositions)
      ? person.currentPositions
      : [];

  return {
    ...person,
    name,
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    jobTitle,
    headline,
    company: companyName,
    jobCompanyName: companyName,
    location,
    linkedinUrl,
    profileUrl: linkedinUrl,
    profile_url: linkedinUrl,
    public_profile_url: linkedinUrl,
    public_identifier: linkedinProfileId,
    linkedinProfileId,
    profilePictureUrl,
    profile_picture_url: profilePictureUrl,
    displayPicture: profilePictureUrl,
    ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
    ...(jobCompanyId
      ? { jobCompanyId }
      : resolvedCompanyId
        ? { jobCompanyId: resolvedCompanyId }
        : {}),
    ...(incomingPositions.length > 0
      ? { current_positions: incomingPositions }
      : companyName || jobTitle
        ? {
            current_positions: [
              {
                company: companyName,
                role: jobTitle,
                location,
              },
            ],
          }
        : {}),
  };
};
