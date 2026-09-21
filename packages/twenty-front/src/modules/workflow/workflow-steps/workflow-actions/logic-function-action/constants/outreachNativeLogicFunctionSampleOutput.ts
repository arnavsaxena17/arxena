export const OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME =
  'search-people-for-company';
export const OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME =
  'fetch-linkedin-profile';
export const OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME =
  'visit-linkedin-profile';
export const OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME = 'search-people';
export const OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME = 'search-companies';
export const OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME =
  'search-crunchbase-companies';
export const OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME = 'search-jobs';
export const OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME = 'search-posts';
export const OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME =
  'fetch-user-comments';
export const OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME =
  'fetch-linkedin-messages';
export const OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME =
  'fetch-company-details';
export const OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME = 'upload-profiles';
export const OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME = 'upsert-companies';
export const OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME = 'enrich-contact';
export const OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME = 'fetch-email';
export const OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME = 'fetch-phone';
export const OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME =
  'get-calendar-availability';
export const OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME =
  'detect-fake-profiles';
export const OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME = 'filter-profiles';
export const OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME =
  'validate-inbound-signals';

const withLlmFormattedText = <T extends object>(
  result: T,
): T & { text: string } => ({
  ...result,
  text: JSON.stringify(result, null, 2),
});

export const OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'unipile',
  projectId: 'project-id',
  companyId: 'company-id',
  error: '',
  people: [
    {
      name: 'Arapa Hara',
      firstName: 'Arapa',
      lastName: 'Hara',
      title: 'Head of Sales',
      headline: 'Head of Sales at Acme',
      company: 'Acme',
      location: 'San Francisco',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      linkedinProfileId: 'example',
      peopleId: 'ACwAAAExample',
      profilePictureUrl: '',
      companyId: 'company-id',
      source: 'linkedin_sales_navigator',
      stdFunction: 'sales',
      stdFunctionRoot: 'go-to-market',
      stdGrade: 'leadership',
      companyName: 'Acme',
      experience: [
        {
          company: 'Acme',
          position: 'Head of Sales',
          location: 'San Francisco',
          description: '',
          start: '2022-01',
          end: '',
          isCurrent: true,
          companyId: '1441',
        },
      ],
      education: [
        {
          school: 'Stanford University',
          degree: 'MBA',
          fieldOfStudy: 'Business',
          start: '2016',
          end: '2018',
        },
      ],
      current_positions: [
        {
          role: 'Head of Sales',
          company: 'Acme',
          company_id: '1441',
        },
      ],
    },
  ],
};

export const OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT =
  withLlmFormattedText({
    success: true,
    linkedinProfileId: 'example',
    firstName: 'Arapa',
    lastName: 'Hara',
    headline: 'Head of Sales',
    about: 'B2B sales leader at Acme',
    location: 'San Francisco',
    linkedinUrl: 'https://www.linkedin.com/in/example',
    profilePictureUrl: 'https://media.licdn.com/example.jpg',
    experience: [
      {
        company: 'Acme',
        position: 'Head of Sales',
        location: 'San Francisco',
        description: 'Owns enterprise revenue',
        start: '2022-01',
        end: '',
      },
    ],
    skills: ['Sales', 'GTM'],
    snapshot: '{}',
    people: [
      {
        name: 'Arapa Hara',
        firstName: 'Arapa',
        lastName: 'Hara',
        title: 'Head of Sales',
        headline: 'Head of Sales',
        company: 'Acme',
        companyName: 'Acme',
        location: 'San Francisco',
        linkedinUrl: 'https://www.linkedin.com/in/example',
        linkedinProfileId: 'example',
        peopleId: 'example',
        profilePictureUrl: 'https://media.licdn.com/example.jpg',
      },
    ],
    error: '',
  });

export const OUTREACH_VISIT_LINKEDIN_PROFILE_SAMPLE_OUTPUT = {
  success: true,
  visited: true,
  linkedinProfileId: 'example',
  firstName: 'Arapa',
  lastName: 'Hara',
  headline: 'Head of Sales',
  linkedinUrl: 'https://www.linkedin.com/in/example',
  error: '',
};

export const OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'unipile',
  error: '',
  people: [
    {
      name: 'Arapa Hara',
      firstName: 'Arapa',
      lastName: 'Hara',
      title: 'Head of Sales',
      headline: 'Head of Sales at Acme',
      companyName: 'Acme',
      company: 'Acme',
      location: 'San Francisco',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      linkedinProfileId: 'example',
      peopleId: 'ACwAAAExample',
      profilePictureUrl: '',
      source: 'index',
      stdFunction: 'sales',
      stdFunctionRoot: 'go-to-market',
      stdGrade: 'leadership',
      experience: [
        {
          company: 'Acme',
          position: 'Head of Sales',
          location: 'San Francisco',
          description: '',
          start: '2022-01',
          end: '',
          isCurrent: true,
          companyId: '1441',
        },
      ],
      education: [
        {
          school: 'Stanford University',
          degree: 'MBA',
          fieldOfStudy: 'Business',
          start: '2016',
          end: '2018',
        },
      ],
      current_positions: [
        {
          role: 'Head of Sales',
          company: 'Acme',
          company_id: '1441',
        },
      ],
    },
  ],
};

export const OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  companies: [
    {
      id: 'acme',
      name: 'Acme',
      website: 'acme.com',
      linkedinUrl: 'https://www.linkedin.com/company/acme',
      industry: 'Software',
    },
  ],
};

export const OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'crunchbase',
  error: '',
  companies: [
    {
      id: 'afd2f898-e292-f910-7350-60d2a033e795',
      name: 'Ather Energy',
      website: 'http://www.atherenergy.com',
      linkedinUrl: 'http://www.linkedin.com/company/ather-energy',
      industry: 'Automotive',
    },
  ],
};

export const OUTREACH_SEARCH_JOBS_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  jobs: [
    {
      id: 'job-1',
      title: 'Account Executive',
      location: 'San Francisco',
      url: 'https://www.linkedin.com/jobs/view/1',
      companyName: 'Acme',
      postedAt: '2026-08-01',
    },
  ],
};

export const OUTREACH_SEARCH_POSTS_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  posts: [
    {
      id: 'post-1',
      socialId: 'urn:li:activity:1',
      shareUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      title: 'Hiring',
      text: 'We are hiring Account Executives',
      postedAt: '2026-08-01T12:00:00.000Z',
      authorName: 'Jane Doe',
      authorUrl: 'https://www.linkedin.com/in/jane-doe',
      reactionCount: 12,
      commentCount: 3,
      isRepost: false,
    },
  ],
});

export const OUTREACH_FETCH_USER_COMMENTS_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  total: 1,
  nextCursor: '',
  error: '',
  comments: [
    {
      id: 'comment-1',
      text: 'Great insights — thanks for sharing.',
      createdAt: '2026-08-01T12:00:00.000Z',
      threadId: '',
      replyCounter: 0,
      authorName: 'Jane Doe',
      authorUrl: 'https://www.linkedin.com/in/jane-doe',
      parentPostId: 'post-1',
      parentPostUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      parentPostText: 'We are hiring Account Executives',
    },
  ],
});

export const OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT =
  withLlmFormattedText({
    success: true,
    chatId: 'chat-1',
    attendeeId: 'ACoAAExampleProviderId1234567890',
    total: 1,
    hasInboundReply: true,
    inboundCount: 1,
    error: '',
    messages: [
      {
        id: 'msg-1',
        text: 'Hello',
        timestamp: '2026-08-01T00:00:00.000Z',
        senderId: 'ACoAAExampleProviderId1234567890',
        isSender: false,
      },
    ],
  });

export const OUTREACH_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT = {
  success: true,
  dataSource: 'unipile',
  error: '',
  company: {
    id: '123',
    name: 'Acme',
    website: 'acme.com',
    linkedinUrl: 'https://www.linkedin.com/company/acme',
    industry: 'Software',
    description: 'B2B software',
    tagline: 'Build faster',
    employeeCount: 200,
    followersCount: 1000,
    publicIdentifier: 'acme',
  },
};

export const OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT = {
  success: true,
  queued: 1,
  created: 1,
  candidateIds: ['candidate-id'],
  projectId: 'project-id',
  uploadSessionId: 'upload-session-id',
  error: '',
};

export const OUTREACH_DETECT_FAKE_PROFILES_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  fakeCount: 1,
  genuineCount: 0,
  uncertainCount: 0,
  error: '',
  fakeProfiles: [
    {
      index: 0,
      isLikelyFake: true,
      verdict: 'fake',
      confidence: 0.92,
      riskScore: 88,
      name: 'TS Dadapeer',
      publicIdentifier: 'syed-dadapeer5410',
      headline: 'Change',
      summary:
        'Education ends in 2023 but elite search-firm tenure starts in 2013.',
      redFlags: [
        'Education vs Egon Zehnder dates',
        'Self-employed at Egon Zehnder',
      ],
      supportingSignals: [],
      profile: {},
    },
  ],
  genuineProfiles: [],
  assessments: [],
};

export const OUTREACH_FILTER_PROFILES_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  matchedCount: 1,
  rejectedCount: 0,
  error: '',
  people: [
    {
      name: 'Arapa Hara',
      firstName: 'Arapa',
      lastName: 'Hara',
      title: 'Head of Sales',
      headline: 'Head of Sales at Acme',
      company: 'Acme',
      location: 'San Francisco',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      linkedinProfileId: 'example',
      peopleId: 'ACwAAAExample',
      profilePictureUrl: '',
      companyId: 'company-id',
      source: 'linkedin_sales_navigator',
      stdFunction: 'sales',
      stdFunctionRoot: 'go-to-market',
      stdGrade: 'leadership',
    },
  ],
  rejected: [],
  assessments: [
    {
      index: 0,
      matches: true,
      reason:
        'Head of Sales at Acme with leadership grade matches senior GTM criteria.',
      name: 'Arapa Hara',
      profile: {},
    },
  ],
};

export const OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  created: 1,
  updated: 0,
  skipped: 0,
  projectId: 'project-id',
  companyIds: ['company-id'],
  error: '',
});

export const OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  email: 'arapahara@acme.com',
  emails: ['arapahara@acme.com'],
  phones: ['+1-555-0100'],
  source: 'arxena',
  enrichStatus: 'FOUND',
  error: '',
});

export const OUTREACH_FETCH_EMAIL_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  email: 'arapahara@acme.com',
  emails: ['arapahara@acme.com'],
  phones: [],
  source: 'arxena',
  enrichStatus: 'FOUND',
  error: '',
});

export const OUTREACH_FETCH_PHONE_SAMPLE_OUTPUT = withLlmFormattedText({
  success: true,
  email: '',
  emails: [],
  phones: ['+1-555-0100'],
  source: 'arxena',
  enrichStatus: 'FOUND',
  error: '',
});

export const OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT = {
  success: true,
  error: '',
  slots: [
    {
      startsAt: '2026-08-24T16:00:00.000Z',
      endsAt: '2026-08-24T16:30:00.000Z',
    },
  ],
  text: '(0) Mon, Aug 24 · 9:30–10:00 PM IST',
};

export const OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT =
  withLlmFormattedText({
    success: true,
    startsAt: '2026-08-24T16:00:00.000Z',
    endsAt: '2026-08-24T16:30:00.000Z',
    replyChannel: 'LINKEDIN',
    preferredChannelToStamp: '',
    prospectEmail: '',
    referralName: 'Priya Nair',
    referralEmail: 'priya.nair@acme.com',
    referralPhone: '',
    hasReferral: true,
    shouldNotRespond: false,
  });

export const OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES = new Set([
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME,
  OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
  OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME,
]);

const SAMPLE_OUTPUT_BY_NAME: Record<string, Record<string, unknown>> = {
  [OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  [OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME]:
    OUTREACH_VISIT_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  [OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
  [OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  [OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_SAMPLE_OUTPUT,
  [OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_JOBS_SAMPLE_OUTPUT,
  [OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME]:
    OUTREACH_SEARCH_POSTS_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_USER_COMMENTS_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
  [OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME]:
    OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
  [OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME]:
    OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT,
  [OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME]:
    OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_EMAIL_SAMPLE_OUTPUT,
  [OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME]:
    OUTREACH_FETCH_PHONE_SAMPLE_OUTPUT,
  [OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME]:
    OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
  [OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME]:
    OUTREACH_DETECT_FAKE_PROFILES_SAMPLE_OUTPUT,
  [OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME]:
    OUTREACH_FILTER_PROFILES_SAMPLE_OUTPUT,
  [OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME]:
    OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT,
};

export const isNativeOutreachLogicFunction = (name?: string | null): boolean =>
  typeof name === 'string' && OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES.has(name);

export const getOutreachNativeLogicFunctionSampleOutput = (
  name?: string | null,
): Record<string, unknown> | undefined =>
  typeof name === 'string' ? SAMPLE_OUTPUT_BY_NAME[name] : undefined;
