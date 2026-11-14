const IMAGE_KEY_RE =
  /picture|photo|avatar|logo|image|banner|background/i;
const MAX_PROFILE_JSON_CHARS = 14_000;
const MAX_TEXT_CHARS = 1_200;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const clip = (value: string, max = MAX_TEXT_CHARS): string =>
  value.length <= max ? value : `${value.slice(0, max)}…`;

const toYearMonth = (
  year?: number | null,
  month?: number | null,
): string | null => {
  if (!year || year < 1950 || year > 2100) {
    return null;
  }

  if (month && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  return `${year}`;
};

export const parseProfileDate = (value: unknown): string | null => {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number' && value > 1950 && value < 2100) {
    return `${value}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed || /present|current|now/i.test(trimmed)) {
      return trimmed && /present|current|now/i.test(trimmed) ? 'present' : null;
    }

    const iso = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
    if (iso) {
      return `${iso[1]}-${iso[2]}`;
    }

    const yearOnly = trimmed.match(/^(\d{4})$/);
    if (yearOnly) {
      return yearOnly[1];
    }

    const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
      return toYearMonth(Number(us[3]), Number(us[1]));
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);

      return toYearMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
    }

    return clip(trimmed, 32);
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.year != null || record.month != null) {
    return toYearMonth(asNumber(record.year), asNumber(record.month));
  }

  return parseProfileDate(record.start ?? record.date ?? record.value);
};

const yearOf = (stamp: string | null): number | null => {
  if (!stamp || stamp === 'present') {
    return null;
  }

  const year = Number(stamp.slice(0, 4));

  return Number.isFinite(year) ? year : null;
};

type TimelineRow = {
  kind: 'education' | 'experience';
  title: string;
  org: string;
  start: string | null;
  end: string | null;
  employmentType: string;
  location: string;
};

const pickArray = (
  record: Record<string, unknown>,
  keys: string[],
): unknown[] => {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const collectEducation = (record: Record<string, unknown>): TimelineRow[] =>
  pickArray(record, [
    'education',
    'educations',
    'schools',
    'educationExperience',
  ]).flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }

    return [
      {
        kind: 'education' as const,
        title: asString(
          row.degreeName ?? row.degree ?? row.fieldOfStudy ?? row.title,
        ),
        org: asString(row.schoolName ?? row.school ?? row.institution ?? row.name),
        start: parseProfileDate(
          row.startDate ?? row.startsAt ?? row.start ?? row.from,
        ),
        end: parseProfileDate(row.endDate ?? row.endsAt ?? row.end ?? row.to),
        employmentType: '',
        location: asString(row.location),
      },
    ];
  });

const collectExperience = (record: Record<string, unknown>): TimelineRow[] =>
  pickArray(record, [
    'experience',
    'experiences',
    'positions',
    'positionGroups',
    'currentPositions',
    'current_positions',
    'work_experience',
    'workExperience',
  ]).flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }

    const nestedPositions = pickArray(row, ['positions', 'roles', 'profilePositions']);
    if (nestedPositions.length > 0) {
      return nestedPositions.flatMap((nested) => {
        const nestedRow = asRecord(nested);
        if (!nestedRow) {
          return [];
        }

        return [
          {
            kind: 'experience' as const,
            title: asString(
              nestedRow.title ?? nestedRow.role ?? nestedRow.position,
            ),
            org: asString(
              nestedRow.companyName ??
                nestedRow.company ??
                row.companyName ??
                row.company ??
                row.name,
            ),
            start: parseProfileDate(
              nestedRow.startDate ??
                nestedRow.startsAt ??
                nestedRow.start ??
                nestedRow.from,
            ),
            end: parseProfileDate(
              nestedRow.endDate ?? nestedRow.endsAt ?? nestedRow.end ?? nestedRow.to,
            ),
            employmentType: asString(
              nestedRow.employmentType ??
                nestedRow.employment_type ??
                nestedRow.contractType,
            ),
            location: asString(nestedRow.location ?? nestedRow.geoLocationName),
          },
        ];
      });
    }

    const companyRecord = asRecord(row.company);

    return [
      {
        kind: 'experience' as const,
        title: asString(row.title ?? row.role ?? row.position ?? row.headline),
        org: asString(
          row.companyName ??
            row.company ??
            companyRecord?.name ??
            row.organization ??
            row.name,
        ),
        start: parseProfileDate(
          row.startDate ??
            row.startsAt ??
            row.start ??
            row.from ??
            row.startedOn,
        ),
        end: parseProfileDate(
          row.endDate ?? row.endsAt ?? row.end ?? row.to ?? row.endedOn,
        ),
        employmentType: asString(
          row.employmentType ??
            row.employment_type ??
            row.contractType ??
            row.jobType,
        ),
        location: asString(
          row.location ??
            row.geoLocationName ??
            row.companyLocation ??
            row.locationName,
        ),
      },
    ];
  });

const identityFromProfile = (record: Record<string, unknown>) => {
  const firstName = asString(record.firstName ?? record.first_name);
  const lastName = asString(record.lastName ?? record.last_name);
  const name =
    asString(record.name ?? record.fullName ?? record.full_name) ||
    [firstName, lastName].filter(Boolean).join(' ');

  return {
    name,
    firstName,
    lastName,
    headline: asString(
      record.headline ?? record.title ?? occupationTitle(record),
    ),
    location: asString(
      record.locationName ??
        record.location ??
        record.geoLocationName ??
        record.country,
    ),
    publicIdentifier: asString(
      record.publicIdentifier ??
        record.public_identifier ??
        record.publicId ??
        record.vanityName,
    ),
    profileId: asString(
      record.provider_id ??
        record.entityUrn ??
        record.linkedinProfileId ??
        record.id,
    ),
    about: clip(
      asString(
        record.summary ?? record.about ?? record.biography ?? record.bio,
      ),
    ),
    connections:
      asNumber(
        record.connectionsCount ??
          record.connections ??
          record.connection ??
          record.networkInfo,
      ) ??
      asNumber(asRecord(record.networkInfo)?.connectionCount),
    followerCount: asNumber(record.followerCount ?? record.followersCount),
  };
};

const occupationTitle = (record: Record<string, unknown>): string =>
  asString(record.occupation ?? record.primaryPosition);

const stripHeavyFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.slice(0, 40).map(stripHeavyFields);
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const next: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(record)) {
    if (IMAGE_KEY_RE.test(key)) {
      continue;
    }

    next[key] = stripHeavyFields(nested);
  }

  return next;
};

export const compactProfileJson = (profile: unknown): string => {
  const compact = JSON.stringify(stripHeavyFields(profile), null, 2) ?? '{}';

  return compact.length <= MAX_PROFILE_JSON_CHARS
    ? compact
    : `${compact.slice(0, MAX_PROFILE_JSON_CHARS)}\n…`;
};

const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (
    trimmed.length < 2 ||
    (trimmed[0] !== '{' && trimmed[0] !== '[')
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const isEmptyProfileValue = (value: unknown): boolean => {
  if (value == null || value === '') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  const record = asRecord(value);

  return record != null && Object.keys(record).length === 0;
};

export const extractProfilesFromPayload = (input: {
  profile?: unknown;
  snapshot?: unknown;
  profiles?: unknown;
}): unknown[] => {
  const profiles = parseJsonIfString(input.profiles);
  const profile = parseJsonIfString(input.profile);
  const snapshot = parseJsonIfString(input.snapshot);

  if (Array.isArray(profiles)) {
    return profiles;
  }

  const nestedProfiles = asRecord(profiles)?.items;
  if (Array.isArray(nestedProfiles)) {
    return nestedProfiles;
  }

  const single = profile ?? snapshot;
  if (isEmptyProfileValue(single)) {
    return [];
  }

  if (Array.isArray(single)) {
    return single;
  }

  const record = asRecord(single);
  if (
    record &&
    Array.isArray(record.items) &&
    /linkedin.?search/i.test(String(record.object ?? ''))
  ) {
    return record.items;
  }

  if (record && Array.isArray(record.people)) {
    return record.people;
  }

  return [single];
};

export const buildFakeProfileInvestigationBrief = (
  profile: unknown,
): string => {
  const record = asRecord(profile) ?? {};
  const identity = identityFromProfile(record);
  const education = collectEducation(record);
  const experience = collectExperience(record);
  const notes: string[] = [];

  const educationEndYears = education
    .map((row) => yearOf(row.end) ?? yearOf(row.start))
    .filter((year): year is number => year != null);
  const latestEducationEnd =
    educationEndYears.length > 0 ? Math.max(...educationEndYears) : null;
  const experienceStartYears = experience
    .map((row) => yearOf(row.start))
    .filter((year): year is number => year != null);
  const earliestExperienceStart =
    experienceStartYears.length > 0 ? Math.min(...experienceStartYears) : null;

  if (
    latestEducationEnd != null &&
    earliestExperienceStart != null &&
    earliestExperienceStart + 4 < latestEducationEnd
  ) {
    notes.push(
      `Chronology clash: latest education year ${latestEducationEnd} vs earliest experience start ${earliestExperienceStart}.`,
    );
  }

  const eliteSelfEmployed = experience.filter((row) => {
    const org = row.org.toLowerCase();
    const type = row.employmentType.toLowerCase();
    const elite =
      /egon zehnder|odgers|russell reynolds|spencer stuart|korn ferry|heidrick|mckinsey|goldman sachs|bain & company|boston consulting/i.test(
        org,
      );

    return (
      elite &&
      /self[- ]employed|freelance|founder|owner|independent/.test(type)
    );
  });

  for (const row of eliteSelfEmployed) {
    notes.push(
      `Elite firm "${row.org}" listed as ${row.employmentType || 'self-employed'} (${row.title || 'no title'}, ${row.start ?? '?'}–${row.end ?? 'present'}).`,
    );
  }

  const currentRoles = experience.filter(
    (row) => !row.end || row.end === 'present',
  );
  if (currentRoles.length >= 3) {
    notes.push(
      `Many overlapping current roles (${currentRoles.length}): ${currentRoles
        .map((row) => `${row.title} @ ${row.org}`)
        .slice(0, 6)
        .join('; ')}.`,
    );
  }

  if (
    identity.headline.length > 0 &&
    identity.headline.length <= 12 &&
    experience.some((row) => /consultant|director|partner|head of/i.test(row.title))
  ) {
    notes.push(
      `Headline "${identity.headline}" is too thin for claimed senior search/HR roles.`,
    );
  }

  if (
    /headhunt|leadership consulting firm founded|high-end talent recruitment/i.test(
      identity.about,
    )
  ) {
    notes.push(
      'About/summary reads like a company brochure rather than a personal career narrative.',
    );
  }

  if (
    identity.location &&
    /india/i.test(identity.location) &&
    experience.some((row) => /london|zurich|united kingdom|switzerland/i.test(row.location))
  ) {
    notes.push(
      `Person location is "${identity.location}" while jobs use ${experience
        .map((row) => row.location)
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ')}.`,
    );
  }

  const completeness =
    education.length + experience.length > 0
      ? 'full-or-partial profile'
      : 'snapshot/search-hit (limited fields)';

  return [
    `Name: ${identity.name || '(unknown)'}`,
    `Headline: ${identity.headline || '(none)'}`,
    `Location: ${identity.location || '(unknown)'}`,
    `Public identifier: ${identity.publicIdentifier || '(none)'}`,
    `Payload shape: ${completeness}`,
    identity.connections != null
      ? `Connections: ${identity.connections}`
      : 'Connections: (unknown)',
    '',
    'Education:',
    education.length > 0
      ? education
          .map(
            (row) =>
              `- ${row.start ?? '?'}–${row.end ?? '?'} ${row.title || 'study'} @ ${row.org || 'school'}`,
          )
          .join('\n')
      : '- (none in payload)',
    '',
    'Experience:',
    experience.length > 0
      ? experience
          .map(
            (row) =>
              `- ${row.start ?? '?'}–${row.end ?? 'present'} ${row.title || 'role'} @ ${row.org || 'company'}${row.employmentType ? ` [${row.employmentType}]` : ''}${row.location ? ` (${row.location})` : ''}`,
          )
          .join('\n')
      : '- (none in payload)',
    '',
    'About:',
    identity.about || '(none)',
    '',
    'Derived contradiction notes:',
    notes.length > 0 ? notes.map((note) => `- ${note}`).join('\n') : '- none automatic',
  ].join('\n');
};

export const profileDisplayName = (profile: unknown): string =>
  identityFromProfile(asRecord(profile) ?? {}).name;

export const profilePublicIdentifier = (profile: unknown): string =>
  identityFromProfile(asRecord(profile) ?? {}).publicIdentifier;

export const profileHeadline = (profile: unknown): string =>
  identityFromProfile(asRecord(profile) ?? {}).headline;
