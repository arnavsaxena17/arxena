type MonthKey = `${number}-${string}`;

type ContactOutDetailedExperience = {
  title?: string;
  summary?: string;
  locality?: string;
  company_name?: string;
  start_date_year?: number | null;
  start_date_month?: number | null;
  end_date_year?: number | null;
  end_date_month?: number | null;
  is_current?: boolean;
  linkedin_url?: string;
  domain?: string;
  logo_url?: string;
};

export type ContactOutPeopleSearchProfile = {
  li_vanity?: string;
  full_name?: string;
  title?: string;
  headline?: string;
  location?: string;
  country?: string;
  industry?: string;
  updated_at?: string;
  profile_picture_url?: string;
  job_function?: string;
  seniority?: string;
  experience?: ContactOutDetailedExperience[];
  education?: unknown[];
};

export type ContactOutPeopleSearchResponse = {
  status_code: 200;
  metadata: { page: number; page_size: number; total_results: number };
  profiles: Record<string, ContactOutPeopleSearchProfile>;
};

type ApifyDatePart = {
  month?: string | null;
  year?: number | null;
  text?: string | null;
};

type ApifyExperienceEntry = {
  position?: string;
  location?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  companyName?: string;
  companyLinkedinUrl?: string | null;
  companyId?: string | null;
  companyUniversalName?: string | null;
  duration?: string | null;
  description?: string | null;
  skills?: unknown[] | null;
  startDate?: ApifyDatePart | null;
  endDate?: ApifyDatePart | null;
  companyLogo?: { url?: string | null; sizes?: unknown[] } | null;
};

export type ApifyCompanyProfileActorItem = {
  id?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  emails?: string[];
  headline?: string;
  openToWork?: boolean;
  hiring?: boolean;
  premium?: boolean;
  influencer?: boolean;
  location?: {
    linkedinText?: string;
    countryCode?: string;
    parsed?: {
      text?: string;
      countryCode?: string;
      regionCode?: string | null;
      country?: string;
      countryFull?: string;
      state?: string;
      city?: string;
    };
  };
  objectUrn?: string;
  registeredAt?: string | null;
  connectionsCount?: number;
  followerCount?: number;
  verified?: boolean;
  about?: string;
  photo?: string;
  profilePicture?: { url?: string | null; sizes?: unknown[] } | null;
  currentPosition?: Array<{
    position?: string;
    location?: string | null;
    employmentType?: string | null;
    workplaceType?: string | null;
    companyName?: string;
    companyLinkedinUrl?: string | null;
    companyId?: string | null;
    duration?: string | null;
    description?: string | null;
    skills?: unknown[] | null;
    startDate?: ApifyDatePart | null;
    endDate?: ApifyDatePart | null;
  }>;
  experience?: ApifyExperienceEntry[];
  _meta?: unknown;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const FIRST_NAMES = [
  'Aarav',
  'Anaya',
  'Vihaan',
  'Isha',
  'Noah',
  'Mia',
  'Liam',
  'Olivia',
  'Ethan',
  'Sophia',
  'Arjun',
  'Sara',
  'Dev',
  'Kavya',
  'Riya',
  'Aiden',
  'Zoe',
  'Ava',
  'Leo',
  'Ella',
];

const LAST_NAMES = [
  'Sharma',
  'Patel',
  'Singh',
  'Mehta',
  'Iyer',
  'Kapoor',
  'Das',
  'Gupta',
  'Khan',
  'Rao',
  'Brown',
  'Johnson',
  'Miller',
  'Davis',
  'Wilson',
  'Taylor',
  'Anderson',
  'Thomas',
  'Moore',
  'Martin',
];

const TITLES = [
  'Software Engineer',
  'Senior Software Engineer',
  'Engineering Manager',
  'Product Manager',
  'Senior Product Manager',
  'VP Engineering',
  'VP Product',
  'Designer',
  'Senior Designer',
  'Data Scientist',
  'Sales Manager',
  'Account Executive',
  'Marketing Manager',
  'Recruiter',
  'People Ops Manager',
  'Finance Manager',
  'Operations Manager',
  'Customer Success Manager',
];

const LOCATIONS = [
  { text: 'San Francisco, California, United States', countryCode: 'US', country: 'United States', state: 'California', city: 'San Francisco' },
  { text: 'New York, New York, United States', countryCode: 'US', country: 'United States', state: 'New York', city: 'New York' },
  { text: 'London, England, United Kingdom', countryCode: 'GB', country: 'United Kingdom', state: 'England', city: 'London' },
  { text: 'Berlin, Germany', countryCode: 'DE', country: 'Germany', state: 'Berlin', city: 'Berlin' },
  { text: 'Mumbai, Maharashtra, India', countryCode: 'IN', country: 'India', state: 'Maharashtra', city: 'Mumbai' },
  { text: 'Bengaluru, Karnataka, India', countryCode: 'IN', country: 'India', state: 'Karnataka', city: 'Bengaluru' },
  { text: 'Singapore', countryCode: 'SG', country: 'Singapore', state: 'Singapore', city: 'Singapore' },
  { text: 'Sydney, New South Wales, Australia', countryCode: 'AU', country: 'Australia', state: 'New South Wales', city: 'Sydney' },
];

const pick = <T,>(arr: T[], idx: number): T => arr[Math.abs(idx) % arr.length] as T;

const clampInt = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.floor(n)));

const isoMonth = (year: number, month: number): MonthKey =>
  `${year}-${String(month).padStart(2, '0')}` as MonthKey;

const monthToNumber = (m: string | null | undefined): number | null => {
  if (!m) return null;
  const key = m.trim().toLowerCase().slice(0, 3);
  return MONTHS[key] ?? null;
};

const toLinkedinProfileUrl = (vanity: string): string =>
  `https://www.linkedin.com/in/${encodeURIComponent(vanity)}`;

function seededVanity(i: number): string {
  return `sample-${i}-${(i * 2654435761) >>> 0}`.slice(0, 22);
}

function buildPersonName(i: number): { firstName: string; lastName: string; fullName: string } {
  const firstName = pick(FIRST_NAMES, i);
  const lastName = pick(LAST_NAMES, i * 7 + 3);
  return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
}

function buildCompanyExperience(params: {
  companyName: string;
  companyLinkedinUrl?: string;
  domain?: string;
  startYear: number;
  startMonth: number;
  endYear?: number | null;
  endMonth?: number | null;
  isCurrent: boolean;
  title: string;
}): ContactOutDetailedExperience {
  return {
    title: params.title,
    company_name: params.companyName,
    is_current: params.isCurrent,
    start_date_year: params.startYear,
    start_date_month: params.startMonth,
    end_date_year: params.endYear ?? null,
    end_date_month: params.endMonth ?? null,
    linkedin_url: params.companyLinkedinUrl,
    domain: params.domain,
  };
}

function buildApifyExperience(params: {
  companyName: string;
  companyLinkedinUrl?: string | null;
  companyId?: string | null;
  position: string;
  startYear: number;
  startMonth: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isCurrent: boolean;
}): ApifyExperienceEntry {
  const end: ApifyDatePart =
    params.isCurrent
      ? { text: 'Present' }
      : {
          ...(params.endMonth ? { month: pick(Object.keys(MONTHS), params.endMonth - 1) } : {}),
          ...(params.endYear ? { year: params.endYear } : {}),
          text:
            params.endYear && params.endMonth
              ? `${String(pick(Object.keys(MONTHS), params.endMonth - 1)).slice(0, 3)} ${params.endYear}`
              : params.endYear
                ? String(params.endYear)
                : null,
        };

  const start: ApifyDatePart = {
    ...(params.startMonth ? { month: pick(Object.keys(MONTHS), params.startMonth - 1) } : {}),
    year: params.startYear,
    text:
      params.startMonth && params.startYear
        ? `${String(pick(Object.keys(MONTHS), params.startMonth - 1)).slice(0, 3)} ${params.startYear}`
        : String(params.startYear),
  };

  return {
    position: params.position,
    location: null,
    employmentType: 'Full-time',
    workplaceType: null,
    companyName: params.companyName,
    companyLinkedinUrl: params.companyLinkedinUrl ?? null,
    companyId: params.companyId ?? null,
    companyUniversalName: null,
    duration: null,
    description: null,
    skills: [],
    startDate: start,
    endDate: end,
    companyLogo: null,
  };
}

export function generateSampleContactOutPeopleSearchResponse(input: {
  companyName: string;
  domain: string;
  totalProfiles?: number;
  seed?: number;
}): ContactOutPeopleSearchResponse {
  const total = clampInt(input.totalProfiles ?? 100, 1, 5000);
  const seed = clampInt(input.seed ?? 1337, 1, Number.MAX_SAFE_INTEGER);
  const profiles: Record<string, ContactOutPeopleSearchProfile> = {};

  const now = new Date();
  const nowIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).toISOString();

  for (let i = 0; i < total; i++) {
    const idx = seed + i;
    const { fullName } = buildPersonName(idx);
    const vanity = seededVanity(idx);
    const liUrl = toLinkedinProfileUrl(vanity);
    const title = pick(TITLES, idx);
    const loc = pick(LOCATIONS, idx * 3);

    // Rules requested:
    // - 20 people in first year at random months
    // - 30 past people joined over last 3 years
    // - 70 current people joined in last 3 years
    // We implement as:
    // - first 20: current, start between (nowYear-4) and (nowYear-3)
    // - next 70: current, start within last 3 years
    // - last 30: past, ended within last 3 years
    const bucket = i < 20 ? 'early_current' : i < 90 ? 'recent_current' : 'past';

    const nowYear = now.getUTCFullYear();
    const joinYear =
      bucket === 'early_current'
        ? nowYear - 4
        : bucket === 'recent_current'
          ? nowYear - (idx % 3)
          : nowYear - (idx % 3);
    const joinMonth = (idx % 12) + 1;

    const isCurrent = bucket !== 'past';
    const endYear = isCurrent ? null : nowYear - (idx % 2);
    const endMonth = isCurrent ? null : ((idx + 5) % 12) + 1;

    const companyExp = buildCompanyExperience({
      companyName: input.companyName,
      companyLinkedinUrl: `https://www.linkedin.com/company/${input.companyName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')}/`,
      domain: input.domain,
      startYear: joinYear,
      startMonth: joinMonth,
      endYear,
      endMonth,
      isCurrent,
      title,
    });

    // Add 1-2 other experiences to make it more realistic.
    const previousExp: ContactOutDetailedExperience = buildCompanyExperience({
      companyName: pick(['Acme', 'Globex', 'Initech', 'Umbrella'], idx),
      companyLinkedinUrl: undefined,
      domain: pick(['acme.com', 'globex.com', 'initech.com', 'umbrella.com'], idx),
      startYear: joinYear - 3,
      startMonth: ((joinMonth + 2) % 12) + 1,
      endYear: joinYear,
      endMonth: joinMonth,
      isCurrent: false,
      title: pick(TITLES, idx + 9),
    });

    profiles[liUrl] = {
      li_vanity: vanity,
      full_name: fullName,
      title,
      headline: `${title} at ${input.companyName}`,
      location: loc.text,
      country: loc.country,
      industry: 'Computer Software',
      updated_at: nowIso.replace('T', ' ').slice(0, 19),
      profile_picture_url: `https://images.contactout.com/profiles/sample-${idx}`,
      job_function: pick(['Engineering', 'Sales', 'Marketing', 'Design', 'Finance'], idx),
      seniority: pick(['Entry', 'Senior', 'Manager', 'Director', 'Vice President'], idx),
      experience: [companyExp, previousExp],
      education: [],
    };
  }

  return {
    status_code: 200,
    metadata: { page: 1, page_size: 25, total_results: total },
    profiles,
  };
}

export function generateSampleApifyCompanyProfileActorItems(input: {
  companyName: string;
  linkedinCompanyUrl: string;
  totalProfiles?: number;
  seed?: number;
}): ApifyCompanyProfileActorItem[] {
  const total = clampInt(input.totalProfiles ?? 100, 1, 10000);
  const seed = clampInt(input.seed ?? 4242, 1, Number.MAX_SAFE_INTEGER);
  const items: ApifyCompanyProfileActorItem[] = [];

  for (let i = 0; i < total; i++) {
    const idx = seed + i;
    const { firstName, lastName, fullName } = buildPersonName(idx);
    const publicIdentifier = `sample-${firstName.toLowerCase()}-${lastName.toLowerCase()}-${idx}`.slice(
      0,
      40,
    );
    const linkedinUrl = `https://www.linkedin.com/in/${publicIdentifier}`;
    const title = pick(TITLES, idx);
    const loc = pick(LOCATIONS, idx * 3);

    const now = new Date();
    const nowYear = now.getUTCFullYear();

    const bucket = i < 20 ? 'early_current' : i < 90 ? 'recent_current' : 'past';
    const joinYear =
      bucket === 'early_current'
        ? nowYear - 4
        : bucket === 'recent_current'
          ? nowYear - (idx % 3)
          : nowYear - (idx % 3);
    const joinMonth = (idx % 12) + 1;
    const isCurrent = bucket !== 'past';

    const endYear = isCurrent ? null : nowYear - (idx % 2);
    const endMonth = isCurrent ? null : ((idx + 5) % 12) + 1;

    const expAtCompany = buildApifyExperience({
      companyName: input.companyName,
      companyLinkedinUrl: input.linkedinCompanyUrl.replace(/\/?$/, '/'),
      companyId: 'sample_company_id',
      position: title,
      startYear: joinYear,
      startMonth: joinMonth,
      endYear,
      endMonth,
      isCurrent,
    });

    const expPrev = buildApifyExperience({
      companyName: pick(['Acme', 'Globex', 'Initech', 'Umbrella'], idx),
      companyLinkedinUrl: null,
      companyId: null,
      position: pick(TITLES, idx + 9),
      startYear: joinYear - 3,
      startMonth: ((joinMonth + 2) % 12) + 1,
      endYear: joinYear,
      endMonth: joinMonth,
      isCurrent: false,
    });

    items.push({
      id: `ACoA${(idx * 99991).toString(16).slice(0, 10)}`,
      publicIdentifier,
      linkedinUrl,
      firstName,
      lastName,
      emails: [],
      headline: `${title} at ${input.companyName}`,
      openToWork: false,
      hiring: false,
      premium: false,
      influencer: false,
      verified: idx % 3 === 0,
      location: {
        linkedinText: loc.text,
        countryCode: loc.countryCode,
        parsed: {
          text: loc.text,
          countryCode: loc.countryCode,
          regionCode: null,
          country: loc.country,
          countryFull: loc.country,
          state: loc.state,
          city: loc.city,
        },
      },
      objectUrn: String(1000000 + idx),
      registeredAt: null,
      connectionsCount: 500 + (idx % 1500),
      followerCount: 200 + (idx % 5000),
      about: `Sample profile for ${fullName}.`,
      photo: `https://media.licdn.com/dms/image/v2/sample/${idx}`,
      profilePicture: { url: `https://media.licdn.com/dms/image/v2/sample/${idx}`, sizes: [] },
      currentPosition: isCurrent
        ? [
            {
              companyName: input.companyName,
              companyLinkedinUrl: input.linkedinCompanyUrl,
              companyId: 'sample_company_id',
              position: title,
              startDate: { month: pick(Object.keys(MONTHS), joinMonth - 1), year: joinYear, text: isoMonth(joinYear, joinMonth) },
              endDate: { text: 'Present' },
            },
          ]
        : [],
      experience: [expAtCompany, expPrev],
      _meta: {
        pagination: {
          totalElements: total,
          totalPages: Math.ceil(total / 25),
          pageNumber: 1,
          previousElements: 0,
          pageSize: 25,
        },
      },
    });
  }

  return items;
}

export function toApifyExperienceMonthKey(d: ApifyDatePart | null | undefined): MonthKey | null {
  if (!d || !d.year) return null;
  const m = monthToNumber(d.month ?? null) ?? 1;
  return isoMonth(d.year, m);
}

