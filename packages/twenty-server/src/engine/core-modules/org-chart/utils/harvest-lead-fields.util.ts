// Reads the fields every Harvest lead consumer needs (org chart rows, outreach
// list rows). The raw lead-search item nests `location` as { linkedinText },
// while compactHarvestSearchItem flattens it to a string, so both shapes are
// accepted here. Missing values come back as ''.
export type HarvestLeadFields = {
  id: string;
  // Only an explicit name field; callers compose first and last themselves
  fullName: string;
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  companyLinkedinUrl: string;
  linkedinUrl: string;
  location: string;
  pictureUrl: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const pickText = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const text = asText(record[key]);

    if (text) {
      return text;
    }
  }

  return '';
};

// First non-empty `key` across currentPositions
const pickFromPositions = (positions: unknown, key: string): string => {
  if (!Array.isArray(positions)) {
    return '';
  }

  for (const position of positions) {
    const text = isRecord(position) ? asText(position[key]) : '';

    if (text) {
      return text;
    }
  }

  return '';
};

export const readHarvestLocationText = (value: unknown): string =>
  isRecord(value) ? asText(value.linkedinText) : asText(value);

export const readHarvestLeadFields = (
  lead: Record<string, unknown>,
): HarvestLeadFields => ({
  id: pickText(lead, ['id']),
  fullName: pickText(lead, ['name', 'fullName', 'full_name', 'displayName']),
  firstName: pickText(lead, ['firstName', 'first_name']),
  lastName: pickText(lead, ['lastName', 'last_name']),
  title:
    pickFromPositions(lead.currentPositions, 'title') ||
    pickText(lead, ['title', 'headline', 'position']),
  companyName: pickFromPositions(lead.currentPositions, 'companyName'),
  companyLinkedinUrl: pickFromPositions(
    lead.currentPositions,
    'companyLinkedinUrl',
  ),
  linkedinUrl: pickText(lead, [
    'linkedinUrl',
    'linkedin_url',
    'profileUrl',
    'profile_url',
    'url',
  ]),
  location:
    readHarvestLocationText(lead.location) || pickText(lead, ['locationName']),
  pictureUrl: pickText(lead, [
    'pictureUrl',
    'profile_picture_url',
    'profilePictureUrl',
  ]),
});
