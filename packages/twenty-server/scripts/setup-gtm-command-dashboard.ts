import axios from 'axios';
import { randomUUID } from 'crypto';

// Seeds the native "GTM Command" CRM dashboard (6 tabs + charts + RECORD_TABLEs).
// Discovery / pre-CRM search tables live on /gtm-home — not here.
// Requires ARX standard sync so GTM fields exist on company/candidate/project/opportunity.

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'apple.localhost';
const API_TOKEN = process.env.API_TOKEN;
const DASHBOARD_TITLE = 'GTM Command';
// Prefer an existing Project UUID; otherwise seed creates "GTM Run · seed".
const GTM_PROJECT_ID = process.env.GTM_PROJECT_ID || '';
const GTM_SEED_PROJECT_NAME = 'GTM Run · seed';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type ObjectMeta = {
  id: string;
  nameSingular: string;
  fieldsList: Array<{ id: string; name: string; type: string }>;
};

type FieldMap = Record<string, string>;

const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

type CompanySeed = {
  key: string;
  name: string;
  domain: string;
  industry: string;
  employees: number;
  segment: string;
  icpFit: 'HIGH' | 'MEDIUM' | 'LOW';
  gtmStatus: string;
  gtmFunnelStage: string;
  peopleTargeted: number;
  peopleReached: number;
  coverageBucket: 'ZERO' | 'ONE_TWO' | 'THREE_PLUS';
  channelsUsed: string[];
  firstContactChannel?: string;
  daysToFirstContact?: number;
  daysToMeetingBooked?: number;
  timeToFirstContactBucket?: string;
  timeToMeetingBucket?: string;
  attentionReason: string;
  daysSinceLastTouch: number;
  coverageScore: number;
  firstContactDaysAgo?: number;
  firstReplyDaysAgo?: number;
  meetingBookedDaysAgo?: number;
  meetingHeldDaysAgo?: number;
};

const GTM_COMPANIES: CompanySeed[] = [
  {
    key: 'co-1',
    name: 'Northwind Labs',
    domain: 'northwindlabs.com',
    industry: 'B2B SaaS',
    employees: 120,
    segment: 'Series B SaaS',
    icpFit: 'HIGH',
    gtmStatus: 'REPLIED',
    gtmFunnelStage: 'REPLIED',
    peopleTargeted: 4,
    peopleReached: 2,
    coverageBucket: 'ONE_TWO',
    channelsUsed: ['LINKEDIN_CONNECT', 'EMAIL'],
    firstContactChannel: 'LINKEDIN_CONNECT',
    daysToFirstContact: 2,
    daysToMeetingBooked: undefined,
    timeToFirstContactBucket: 'D1_3',
    attentionReason: 'NO_REPLY',
    daysSinceLastTouch: 9,
    coverageScore: 55,
    firstContactDaysAgo: 14,
    firstReplyDaysAgo: 10,
  },
  {
    key: 'co-2',
    name: 'Ledgerly',
    domain: 'ledgerly.io',
    industry: 'Fintech',
    employees: 85,
    segment: 'Fintech 50-200',
    icpFit: 'HIGH',
    gtmStatus: 'REACHED',
    gtmFunnelStage: 'REACHED',
    peopleTargeted: 3,
    peopleReached: 1,
    coverageBucket: 'ONE_TWO',
    channelsUsed: ['LINKEDIN_CONNECT'],
    firstContactChannel: 'LINKEDIN_CONNECT',
    daysToFirstContact: 1,
    timeToFirstContactBucket: 'UNDER_1D',
    attentionReason: 'CONNECT_IGNORE',
    daysSinceLastTouch: 12,
    coverageScore: 40,
    firstContactDaysAgo: 12,
  },
  {
    key: 'co-3',
    name: 'Hirestack',
    domain: 'hirestack.com',
    industry: 'HR Tech',
    employees: 210,
    segment: 'HR Tech',
    icpFit: 'MEDIUM',
    gtmStatus: 'COVERED',
    gtmFunnelStage: 'COVERED',
    peopleTargeted: 5,
    peopleReached: 3,
    coverageBucket: 'THREE_PLUS',
    channelsUsed: ['EMAIL', 'WHATSAPP'],
    firstContactChannel: 'EMAIL',
    daysToFirstContact: 4,
    timeToFirstContactBucket: 'D3_7',
    attentionReason: 'NONE',
    daysSinceLastTouch: 2,
    coverageScore: 72,
    firstContactDaysAgo: 8,
  },
  {
    key: 'co-4',
    name: 'ParcelOps',
    domain: 'parcelops.com',
    industry: 'B2B SaaS',
    employees: 160,
    segment: 'Series B SaaS',
    icpFit: 'HIGH',
    gtmStatus: 'MEETING_BOOKED',
    gtmFunnelStage: 'MEETING_BOOKED',
    peopleTargeted: 4,
    peopleReached: 3,
    coverageBucket: 'THREE_PLUS',
    channelsUsed: ['LINKEDIN_CONNECT', 'INMAIL', 'EMAIL'],
    firstContactChannel: 'INMAIL',
    daysToFirstContact: 1,
    daysToMeetingBooked: 11,
    timeToFirstContactBucket: 'UNDER_1D',
    timeToMeetingBucket: 'D7_14',
    attentionReason: 'NONE',
    daysSinceLastTouch: 1,
    coverageScore: 88,
    firstContactDaysAgo: 18,
    firstReplyDaysAgo: 12,
    meetingBookedDaysAgo: 7,
  },
  {
    key: 'co-5',
    name: 'Clearpay Systems',
    domain: 'clearpaysystems.com',
    industry: 'Fintech',
    employees: 95,
    segment: 'Fintech 50-200',
    icpFit: 'MEDIUM',
    gtmStatus: 'RESEARCHING',
    gtmFunnelStage: 'ADDED',
    peopleTargeted: 3,
    peopleReached: 0,
    coverageBucket: 'ZERO',
    channelsUsed: [],
    attentionReason: 'NONE',
    daysSinceLastTouch: 0,
    coverageScore: 10,
  },
  {
    key: 'co-6',
    name: 'Orbit ATS',
    domain: 'orbitats.com',
    industry: 'HR Tech',
    employees: 70,
    segment: 'HR Tech',
    icpFit: 'HIGH',
    gtmStatus: 'REACHED',
    gtmFunnelStage: 'REACHED',
    peopleTargeted: 3,
    peopleReached: 1,
    coverageBucket: 'ONE_TWO',
    channelsUsed: ['EMAIL'],
    firstContactChannel: 'EMAIL',
    daysToFirstContact: 5,
    timeToFirstContactBucket: 'D3_7',
    attentionReason: 'ENRICH_MISS',
    daysSinceLastTouch: 3,
    coverageScore: 35,
    firstContactDaysAgo: 5,
  },
  {
    key: 'co-7',
    name: 'Signalboard',
    domain: 'signalboard.ai',
    industry: 'B2B SaaS',
    employees: 140,
    segment: 'Series B SaaS',
    icpFit: 'HIGH',
    gtmStatus: 'OPPORTUNITY',
    gtmFunnelStage: 'OPPORTUNITY',
    peopleTargeted: 4,
    peopleReached: 3,
    coverageBucket: 'THREE_PLUS',
    channelsUsed: ['LINKEDIN_CONNECT', 'COMMENT', 'EMAIL'],
    firstContactChannel: 'COMMENT',
    daysToFirstContact: 2,
    daysToMeetingBooked: 9,
    timeToFirstContactBucket: 'D1_3',
    timeToMeetingBucket: 'D7_14',
    attentionReason: 'NONE',
    daysSinceLastTouch: 0,
    coverageScore: 95,
    firstContactDaysAgo: 25,
    firstReplyDaysAgo: 20,
    meetingBookedDaysAgo: 16,
    meetingHeldDaysAgo: 14,
  },
  {
    key: 'co-8',
    name: 'Vaultline',
    domain: 'vaultline.com',
    industry: 'Fintech',
    employees: 110,
    segment: 'Fintech 50-200',
    icpFit: 'MEDIUM',
    gtmStatus: 'RESEARCHING',
    gtmFunnelStage: 'ADDED',
    peopleTargeted: 2,
    peopleReached: 0,
    coverageBucket: 'ZERO',
    channelsUsed: [],
    attentionReason: 'NONE',
    daysSinceLastTouch: 0,
    coverageScore: 8,
  },
  {
    key: 'co-9',
    name: 'Peoplegrid',
    domain: 'peoplegrid.io',
    industry: 'HR Tech',
    employees: 55,
    segment: 'HR Tech',
    icpFit: 'HIGH',
    gtmStatus: 'COVERED',
    gtmFunnelStage: 'COVERED',
    peopleTargeted: 3,
    peopleReached: 2,
    coverageBucket: 'ONE_TWO',
    channelsUsed: ['WHATSAPP', 'LINKEDIN_CONNECT'],
    firstContactChannel: 'WHATSAPP',
    daysToFirstContact: 3,
    timeToFirstContactBucket: 'D1_3',
    attentionReason: 'STUCK_STAGE',
    daysSinceLastTouch: 5,
    coverageScore: 60,
    firstContactDaysAgo: 10,
  },
  {
    key: 'co-10',
    name: 'Canvasflow',
    domain: 'canvasflow.com',
    industry: 'B2B SaaS',
    employees: 190,
    segment: 'Series B SaaS',
    icpFit: 'HIGH',
    gtmStatus: 'TARGET',
    gtmFunnelStage: 'ADDED',
    peopleTargeted: 4,
    peopleReached: 0,
    coverageBucket: 'ZERO',
    channelsUsed: [],
    attentionReason: 'STUCK_STAGE',
    daysSinceLastTouch: 5,
    coverageScore: 15,
  },
  {
    key: 'co-11',
    name: 'Mintroute',
    domain: 'mintroute.com',
    industry: 'Fintech',
    employees: 130,
    segment: 'Fintech 50-200',
    icpFit: 'LOW',
    gtmStatus: 'WATCH',
    gtmFunnelStage: 'ADDED',
    peopleTargeted: 2,
    peopleReached: 0,
    coverageBucket: 'ZERO',
    channelsUsed: [],
    attentionReason: 'NONE',
    daysSinceLastTouch: 0,
    coverageScore: 5,
  },
  {
    key: 'co-12',
    name: 'Relayhire',
    domain: 'relayhire.com',
    industry: 'B2B SaaS',
    employees: 75,
    segment: 'Series B SaaS',
    icpFit: 'HIGH',
    gtmStatus: 'MEETING_HELD',
    gtmFunnelStage: 'MEETING_HELD',
    peopleTargeted: 3,
    peopleReached: 2,
    coverageBucket: 'ONE_TWO',
    channelsUsed: ['EMAIL', 'LINKEDIN_CONNECT'],
    firstContactChannel: 'EMAIL',
    daysToFirstContact: 2,
    daysToMeetingBooked: 8,
    timeToFirstContactBucket: 'D1_3',
    timeToMeetingBucket: 'D7_14',
    attentionReason: 'NONE',
    daysSinceLastTouch: 1,
    coverageScore: 90,
    firstContactDaysAgo: 20,
    firstReplyDaysAgo: 15,
    meetingBookedDaysAgo: 12,
    meetingHeldDaysAgo: 10,
  },
];

type PersonSeed = {
  firstName: string;
  lastName: string;
  title: string;
  companyKey: string;
  linkedin: string;
  email: string;
  outreachSequenceStage: string;
  connectionStatus: string;
  enrichStatus: string;
  messagingChannel: string;
  firstOutboundDaysAgo?: number;
  lastOutboundDaysAgo?: number;
  lastInboundDaysAgo?: number;
};

const GTM_PEOPLE: PersonSeed[] = [
  {
    firstName: 'Maya',
    lastName: 'Chen',
    title: 'VP People',
    companyKey: 'co-1',
    linkedin: 'https://linkedin.com/in/mayachen',
    email: 'maya.chen@northwindlabs.com',
    outreachSequenceStage: 'EMAIL_SENT',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 14,
    lastOutboundDaysAgo: 9,
    lastInboundDaysAgo: 10,
  },
  {
    firstName: 'Jordan',
    lastName: 'Hale',
    title: 'Head of Talent',
    companyKey: 'co-1',
    linkedin: 'https://linkedin.com/in/jordanhale',
    email: 'jordan.hale@northwindlabs.com',
    outreachSequenceStage: 'CONNECTION_SENT',
    connectionStatus: 'SENT',
    enrichStatus: 'NOT_STARTED',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 12,
    lastOutboundDaysAgo: 12,
  },
  {
    firstName: 'Aisha',
    lastName: 'Rahman',
    title: 'Director of Recruiting',
    companyKey: 'co-2',
    linkedin: 'https://linkedin.com/in/aisharahman',
    email: 'aisha.rahman@ledgerly.io',
    outreachSequenceStage: 'CONNECTION_SENT',
    connectionStatus: 'IGNORED',
    enrichStatus: 'NOT_STARTED',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 12,
    lastOutboundDaysAgo: 12,
  },
  {
    firstName: 'Chris',
    lastName: 'Okonkwo',
    title: 'VP People',
    companyKey: 'co-2',
    linkedin: 'https://linkedin.com/in/chrisokonkwo',
    email: 'chris.okonkwo@ledgerly.io',
    outreachSequenceStage: 'QUEUED',
    connectionStatus: 'NONE',
    enrichStatus: 'NOT_STARTED',
    messagingChannel: 'LINKEDIN',
  },
  {
    firstName: 'Elena',
    lastName: 'Voss',
    title: 'Head of Talent',
    companyKey: 'co-4',
    linkedin: 'https://linkedin.com/in/elenavoss',
    email: 'elena.voss@parcelops.com',
    outreachSequenceStage: 'MEETING_BOOKED',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN_INMAIL',
    firstOutboundDaysAgo: 18,
    lastOutboundDaysAgo: 7,
    lastInboundDaysAgo: 12,
  },
  {
    firstName: 'Dev',
    lastName: 'Patel',
    title: 'Director of Recruiting',
    companyKey: 'co-4',
    linkedin: 'https://linkedin.com/in/devpatel',
    email: 'dev.patel@parcelops.com',
    outreachSequenceStage: 'EMAIL_SENT',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 15,
    lastOutboundDaysAgo: 8,
  },
  {
    firstName: 'Sofia',
    lastName: 'Mendes',
    title: 'VP People',
    companyKey: 'co-6',
    linkedin: 'https://linkedin.com/in/sofiamendes',
    email: 'sofia.mendes@orbitats.com',
    outreachSequenceStage: 'FAILED_ENRICH',
    connectionStatus: 'NONE',
    enrichStatus: 'FAILED',
    messagingChannel: 'WHATSAPP_UNIPILE',
    firstOutboundDaysAgo: 5,
    lastOutboundDaysAgo: 3,
  },
  {
    firstName: 'Noah',
    lastName: 'Kim',
    title: 'Head of Talent',
    companyKey: 'co-7',
    linkedin: 'https://linkedin.com/in/noahkim',
    email: 'noah.kim@signalboard.ai',
    outreachSequenceStage: 'MEETING_BOOKED',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 25,
    lastOutboundDaysAgo: 16,
    lastInboundDaysAgo: 20,
  },
  {
    firstName: 'Lara',
    lastName: 'Singh',
    title: 'Director of Recruiting',
    companyKey: 'co-7',
    linkedin: 'https://linkedin.com/in/larasingh',
    email: 'lara.singh@signalboard.ai',
    outreachSequenceStage: 'REPLIED',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 22,
    lastOutboundDaysAgo: 18,
    lastInboundDaysAgo: 19,
  },
  {
    firstName: 'Tom',
    lastName: 'Bradley',
    title: 'VP People',
    companyKey: 'co-9',
    linkedin: 'https://linkedin.com/in/tombradley',
    email: 'tom.bradley@peoplegrid.io',
    outreachSequenceStage: 'WARM_PATH',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'RUNNING',
    messagingChannel: 'WHATSAPP_UNIPILE',
    firstOutboundDaysAgo: 10,
    lastOutboundDaysAgo: 5,
  },
  {
    firstName: 'Hannah',
    lastName: 'Wu',
    title: 'Head of Talent',
    companyKey: 'co-10',
    linkedin: 'https://linkedin.com/in/hannahwu',
    email: 'hannah.wu@canvasflow.com',
    outreachSequenceStage: 'QUEUED',
    connectionStatus: 'NONE',
    enrichStatus: 'NOT_STARTED',
    messagingChannel: 'LINKEDIN',
  },
  {
    firstName: 'Omar',
    lastName: 'Farouk',
    title: 'Director of Recruiting',
    companyKey: 'co-10',
    linkedin: 'https://linkedin.com/in/omarfarouk',
    email: 'omar.farouk@canvasflow.com',
    outreachSequenceStage: 'QUEUED',
    connectionStatus: 'NONE',
    enrichStatus: 'NOT_STARTED',
    messagingChannel: 'LINKEDIN',
  },
  {
    firstName: 'Julia',
    lastName: 'Park',
    title: 'VP People',
    companyKey: 'co-12',
    linkedin: 'https://linkedin.com/in/juliapark',
    email: 'julia.park@relayhire.com',
    outreachSequenceStage: 'MEETING_BOOKED',
    connectionStatus: 'ACCEPTED',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 20,
    lastOutboundDaysAgo: 12,
    lastInboundDaysAgo: 15,
  },
  {
    firstName: 'Ben',
    lastName: 'Torres',
    title: 'Head of Talent',
    companyKey: 'co-12',
    linkedin: 'https://linkedin.com/in/bentorres',
    email: 'ben.torres@relayhire.com',
    outreachSequenceStage: 'EMAIL_SENT',
    connectionStatus: 'SENT',
    enrichStatus: 'FOUND',
    messagingChannel: 'LINKEDIN',
    firstOutboundDaysAgo: 18,
    lastOutboundDaysAgo: 14,
  },
  {
    firstName: 'Nina',
    lastName: 'Alvarez',
    title: 'Director of Recruiting',
    companyKey: 'co-3',
    linkedin: 'https://linkedin.com/in/ninaalvarez',
    email: 'nina.alvarez@hirestack.com',
    outreachSequenceStage: 'WHATSAPP_SENT',
    connectionStatus: 'NONE',
    enrichStatus: 'FOUND',
    messagingChannel: 'WHATSAPP_UNIPILE',
    firstOutboundDaysAgo: 8,
    lastOutboundDaysAgo: 2,
  },
];

const OPPORTUNITY_SEEDS = [
  {
    name: 'Northwind · Recruiting OS eval',
    companyKey: 'co-1',
    stage: 'MEETING',
    amountMicros: 48_000_000_000,
  },
  {
    name: 'Ledgerly · Talent ops pilot',
    companyKey: 'co-2',
    stage: 'PROPOSAL',
    amountMicros: 72_000_000_000,
  },
  {
    name: 'ParcelOps · Outbound stack',
    companyKey: 'co-4',
    stage: 'SCREENING',
    amountMicros: 36_000_000_000,
  },
  {
    name: 'Orbit ATS · Partnership',
    companyKey: 'co-6',
    stage: 'NEW',
    amountMicros: 24_000_000_000,
  },
  {
    name: 'Signalboard · Expansion',
    companyKey: 'co-7',
    stage: 'CUSTOMER',
    amountMicros: 96_000_000_000,
  },
  {
    name: 'Relayhire · Intro meeting',
    companyKey: 'co-12',
    stage: 'MEETING',
    amountMicros: 30_000_000_000,
  },
] as const;

const REQUIRED_COMPANY_FIELDS = [
  'gtmStatus',
  'gtmFunnelStage',
  'icpSegment',
  'icpFit',
  'gtmRunKey',
  'peopleTargeted',
  'peopleReached',
  'coverageBucket',
  'firstContactAt',
  'meetingBookedAt',
  'daysToMeetingBooked',
  'timeToMeetingBucket',
  'attentionReason',
] as const;

const REQUIRED_CANDIDATE_FIELDS = [
  'outreachSequenceStage',
  'connectionStatus',
  'enrichStatus',
  'messagingChannel',
  'firstOutboundAt',
  'lastOutboundAt',
] as const;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const requestOnce = async <T>(
  path: '/graphql' | '/metadata',
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  if (!API_TOKEN) {
    throw new Error('API_TOKEN environment variable is required');
  }

  const response = await axios.post<GraphQLResponse<T>>(
    `${SERVER_URL}${path}`,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        Host: SERVER_HOST,
      },
    },
  );

  if (response.data.errors?.length) {
    throw new Error(
      response.data.errors.map((error) => error.message).join('; '),
    );
  }

  if (!response.data.data) {
    throw new Error(`Empty GraphQL data from ${path}`);
  }

  return response.data.data;
};

const request = async <T>(
  path: '/graphql' | '/metadata',
  query: string,
  variables?: Record<string, unknown>,
  retries = 8,
): Promise<T> => {
  let attempt = 0;

  while (true) {
    try {
      return await requestOnce<T>(path, query, variables);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited =
        message.toLowerCase().includes('limit reached') ||
        message.toLowerCase().includes('too many requests');

      if (!isRateLimited || attempt >= retries) {
        throw error;
      }

      attempt += 1;
      const waitMs = Math.min(attempt * 3000, 20000);
      console.warn(
        `  rate limited — retry ${attempt}/${retries} in ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }
};

const requestWithRetry = request;

const fieldMapFromObject = (objectMeta: ObjectMeta): FieldMap =>
  Object.fromEntries(
    objectMeta.fieldsList.map((field) => [field.name, field.id]),
  );

const assertFieldsPresent = (
  objectName: string,
  fields: FieldMap,
  required: readonly string[],
) => {
  const missing = required.filter((fieldName) => !fields[fieldName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing ${objectName} GTM fields: ${missing.join(', ')}.\n` +
        `Create them by syncing Arxena standard metadata:\n` +
        `  npx nx run twenty-server:command -- workspace:sync-arxena-standard -w <workspaceId>\n` +
        `Or re-run this script after fields are created (it will also try to create missing fields via metadata API).`,
    );
  }
};

type FieldToCreate = {
  name: string;
  label: string;
  type: string;
  icon?: string;
  options?: Array<{
    value: string;
    label: string;
    color: string;
    position: number;
  }>;
  defaultValue?: unknown;
};

const COMPANY_FIELDS_TO_ENSURE: FieldToCreate[] = [
  {
    name: 'gtmStatus',
    label: 'GTM Status',
    type: 'SELECT',
    icon: 'IconTargetArrow',
    options: [
      { value: 'WATCH', label: 'Watch', color: 'gray', position: 0 },
      { value: 'RESEARCHING', label: 'Researching', color: 'sky', position: 1 },
      { value: 'TARGET', label: 'Target', color: 'blue', position: 2 },
      { value: 'REACHED', label: 'Reached', color: 'turquoise', position: 3 },
      { value: 'COVERED', label: 'Covered', color: 'green', position: 4 },
      { value: 'REPLIED', label: 'Replied', color: 'purple', position: 5 },
      {
        value: 'MEETING_BOOKED',
        label: 'Meeting booked',
        color: 'orange',
        position: 6,
      },
      {
        value: 'MEETING_HELD',
        label: 'Meeting held',
        color: 'yellow',
        position: 7,
      },
      {
        value: 'OPPORTUNITY',
        label: 'Opportunity',
        color: 'red',
        position: 8,
      },
      {
        value: 'DISQUALIFIED',
        label: 'Disqualified',
        color: 'gray',
        position: 9,
      },
    ],
  },
  {
    name: 'gtmFunnelStage',
    label: 'GTM Funnel Stage',
    type: 'SELECT',
    icon: 'IconFilter',
    options: [
      { value: 'ADDED', label: 'Added', color: 'gray', position: 0 },
      { value: 'REACHED', label: 'Reached', color: 'sky', position: 1 },
      { value: 'COVERED', label: 'Covered', color: 'blue', position: 2 },
      { value: 'REPLIED', label: 'Replied', color: 'turquoise', position: 3 },
      {
        value: 'MEETING_BOOKED',
        label: 'Meeting booked',
        color: 'green',
        position: 4,
      },
      {
        value: 'MEETING_HELD',
        label: 'Meeting held',
        color: 'purple',
        position: 5,
      },
      {
        value: 'OPPORTUNITY',
        label: 'Opportunity',
        color: 'orange',
        position: 6,
      },
    ],
  },
  {
    name: 'icpSegment',
    label: 'ICP Segment',
    type: 'TEXT',
    icon: 'IconTags',
  },
  {
    name: 'icpFit',
    label: 'ICP Fit',
    type: 'SELECT',
    icon: 'IconChartBar',
    options: [
      { value: 'HIGH', label: 'High', color: 'green', position: 0 },
      { value: 'MEDIUM', label: 'Medium', color: 'orange', position: 1 },
      { value: 'LOW', label: 'Low', color: 'red', position: 2 },
    ],
  },
  { name: 'gtmRunKey', label: 'GTM Run Key', type: 'TEXT', icon: 'IconKey' },
  {
    name: 'peopleTargeted',
    label: 'People Targeted',
    type: 'NUMBER',
    icon: 'IconUsers',
  },
  {
    name: 'peopleReached',
    label: 'People Reached',
    type: 'NUMBER',
    icon: 'IconUserCheck',
  },
  {
    name: 'coverageBucket',
    label: 'Coverage Bucket',
    type: 'SELECT',
    icon: 'IconChartPie',
    options: [
      { value: 'ZERO', label: '0 people', color: 'red', position: 0 },
      { value: 'ONE_TWO', label: '1–2 people', color: 'orange', position: 1 },
      { value: 'THREE_PLUS', label: '3+ people', color: 'green', position: 2 },
    ],
  },
  {
    name: 'channelsUsed',
    label: 'Channels Used',
    type: 'MULTI_SELECT',
    icon: 'IconMessage',
    options: [
      {
        value: 'LINKEDIN_CONNECT',
        label: 'LinkedIn connect',
        color: 'blue',
        position: 0,
      },
      { value: 'INMAIL', label: 'InMail', color: 'sky', position: 1 },
      { value: 'COMMENT', label: 'Comment', color: 'turquoise', position: 2 },
      { value: 'EMAIL', label: 'Email', color: 'purple', position: 3 },
      { value: 'WHATSAPP', label: 'WhatsApp', color: 'green', position: 4 },
      { value: 'OTHER', label: 'Other', color: 'gray', position: 5 },
    ],
  },
  {
    name: 'firstContactAt',
    label: 'First Contact At',
    type: 'DATE_TIME',
    icon: 'IconClock',
  },
  {
    name: 'firstReplyAt',
    label: 'First Reply At',
    type: 'DATE_TIME',
    icon: 'IconMessageReply',
  },
  {
    name: 'meetingBookedAt',
    label: 'Meeting Booked At',
    type: 'DATE_TIME',
    icon: 'IconCalendarPlus',
  },
  {
    name: 'meetingHeldAt',
    label: 'Meeting Held At',
    type: 'DATE_TIME',
    icon: 'IconCalendarCheck',
  },
  {
    name: 'daysToFirstContact',
    label: 'Days To First Contact',
    type: 'NUMBER',
    icon: 'IconHourglass',
  },
  {
    name: 'daysToMeetingBooked',
    label: 'Days To Meeting Booked',
    type: 'NUMBER',
    icon: 'IconHourglassHigh',
  },
  {
    name: 'timeToFirstContactBucket',
    label: 'Time To First Contact Bucket',
    type: 'SELECT',
    icon: 'IconChartBar',
    options: [
      { value: 'UNDER_1D', label: '<1d', color: 'green', position: 0 },
      { value: 'D1_3', label: '1–3d', color: 'turquoise', position: 1 },
      { value: 'D3_7', label: '3–7d', color: 'blue', position: 2 },
      { value: 'D7_14', label: '7–14d', color: 'orange', position: 3 },
      { value: 'OVER_14D', label: '14d+', color: 'red', position: 4 },
    ],
  },
  {
    name: 'timeToMeetingBucket',
    label: 'Time To Meeting Bucket',
    type: 'SELECT',
    icon: 'IconChartBar',
    options: [
      { value: 'UNDER_1D', label: '<1d', color: 'green', position: 0 },
      { value: 'D1_3', label: '1–3d', color: 'turquoise', position: 1 },
      { value: 'D3_7', label: '3–7d', color: 'blue', position: 2 },
      { value: 'D7_14', label: '7–14d', color: 'orange', position: 3 },
      { value: 'OVER_14D', label: '14d+', color: 'red', position: 4 },
    ],
  },
  {
    name: 'firstContactChannel',
    label: 'First Contact Channel',
    type: 'SELECT',
    icon: 'IconSend',
    options: [
      {
        value: 'LINKEDIN_CONNECT',
        label: 'LinkedIn connect',
        color: 'blue',
        position: 0,
      },
      { value: 'INMAIL', label: 'InMail', color: 'sky', position: 1 },
      { value: 'COMMENT', label: 'Comment', color: 'turquoise', position: 2 },
      { value: 'EMAIL', label: 'Email', color: 'purple', position: 3 },
      { value: 'WHATSAPP', label: 'WhatsApp', color: 'green', position: 4 },
      { value: 'OTHER', label: 'Other', color: 'gray', position: 5 },
    ],
  },
  {
    name: 'coverageScore',
    label: 'Coverage Score',
    type: 'NUMBER',
    icon: 'IconPercentage',
  },
  {
    name: 'attentionReason',
    label: 'Attention Reason',
    type: 'SELECT',
    icon: 'IconAlertTriangle',
    options: [
      { value: 'NONE', label: 'None', color: 'green', position: 0 },
      { value: 'NO_REPLY', label: 'No reply', color: 'orange', position: 1 },
      {
        value: 'CONNECT_IGNORE',
        label: 'Connect ignore',
        color: 'red',
        position: 2,
      },
      {
        value: 'ENRICH_MISS',
        label: 'Enrich miss',
        color: 'purple',
        position: 3,
      },
      {
        value: 'STUCK_STAGE',
        label: 'Stuck stage',
        color: 'yellow',
        position: 4,
      },
    ],
  },
  {
    name: 'daysSinceLastTouch',
    label: 'Days Since Last Touch',
    type: 'NUMBER',
    icon: 'IconCalendarDue',
  },
];

const CANDIDATE_FIELDS_TO_ENSURE: FieldToCreate[] = [
  {
    name: 'outreachSequenceStage',
    label: 'Outreach Sequence Stage',
    type: 'SELECT',
    icon: 'IconRoute',
    options: [
      { value: 'QUEUED', label: 'Queued', color: 'gray', position: 0 },
      {
        value: 'NEEDS_CONNECTION',
        label: 'Needs connection',
        color: 'red',
        position: 1,
      },
      {
        value: 'CONNECTION_SENT',
        label: 'Connection sent',
        color: 'sky',
        position: 2,
      },
      {
        value: 'CONNECTION_ACCEPTED',
        label: 'Connection accepted',
        color: 'blue',
        position: 3,
      },
      {
        value: 'PROFILE_CHECKED',
        label: 'Profile checked',
        color: 'turquoise',
        position: 4,
      },
      { value: 'WARM_PATH', label: 'Warm path', color: 'purple', position: 5 },
      { value: 'COMMENTED', label: 'Commented', color: 'orange', position: 6 },
      {
        value: 'EMAIL_ENRICHING',
        label: 'Enriching email',
        color: 'yellow',
        position: 7,
      },
      { value: 'EMAIL_SENT', label: 'Email sent', color: 'blue', position: 8 },
      {
        value: 'INMAIL_SENT',
        label: 'InMail sent',
        color: 'sky',
        position: 9,
      },
      {
        value: 'WHATSAPP_SENT',
        label: 'WhatsApp sent',
        color: 'green',
        position: 10,
      },
      { value: 'REPLIED', label: 'Replied', color: 'turquoise', position: 11 },
      {
        value: 'NEGOTIATING',
        label: 'Negotiating',
        color: 'purple',
        position: 12,
      },
      {
        value: 'MEETING_BOOKED',
        label: 'Meeting booked',
        color: 'green',
        position: 13,
      },
      { value: 'DEFERRED', label: 'Deferred', color: 'gray', position: 14 },
      { value: 'STOPPED', label: 'Stopped', color: 'red', position: 15 },
      {
        value: 'FAILED_ENRICH',
        label: 'Failed enrich',
        color: 'red',
        position: 16,
      },
      {
        value: 'FAILED_NO_REPLY',
        label: 'Failed no reply',
        color: 'red',
        position: 17,
      },
    ],
  },
  {
    name: 'connectionStatus',
    label: 'Connection Status',
    type: 'SELECT',
    icon: 'IconUserPlus',
    options: [
      { value: 'NONE', label: 'None', color: 'gray', position: 0 },
      { value: 'SENT', label: 'Sent', color: 'sky', position: 1 },
      { value: 'ACCEPTED', label: 'Accepted', color: 'green', position: 2 },
      { value: 'IGNORED', label: 'Ignored', color: 'red', position: 3 },
    ],
  },
  {
    name: 'enrichStatus',
    label: 'Enrich Status',
    type: 'SELECT',
    icon: 'IconDatabaseSearch',
    options: [
      {
        value: 'NOT_STARTED',
        label: 'Not started',
        color: 'gray',
        position: 0,
      },
      { value: 'RUNNING', label: 'Running', color: 'sky', position: 1 },
      { value: 'FOUND', label: 'Found', color: 'green', position: 2 },
      { value: 'FAILED', label: 'Failed', color: 'red', position: 3 },
    ],
  },
  {
    name: 'enrichedAt',
    label: 'Enriched At',
    type: 'DATE_TIME',
    icon: 'IconClock',
  },
  {
    name: 'lastOutboundAt',
    label: 'Last Outbound At',
    type: 'DATE_TIME',
    icon: 'IconSend',
  },
  {
    name: 'lastInboundAt',
    label: 'Last Inbound At',
    type: 'DATE_TIME',
    icon: 'IconMessageReply',
  },
  {
    name: 'firstOutboundAt',
    label: 'First Outbound At',
    type: 'DATE_TIME',
    icon: 'IconPlayerPlay',
  },
  {
    name: 'pendingMessageBody',
    label: 'Pending Message Body',
    type: 'TEXT',
    icon: 'IconMessage',
  },
  {
    name: 'pendingChannel',
    label: 'Pending Channel',
    type: 'SELECT',
    icon: 'IconSend',
    options: [
      {
        value: 'LINKEDIN_CONNECT',
        label: 'LinkedIn connect',
        color: 'blue',
        position: 0,
      },
      { value: 'INMAIL', label: 'InMail', color: 'sky', position: 1 },
      { value: 'COMMENT', label: 'Comment', color: 'turquoise', position: 2 },
      { value: 'EMAIL', label: 'Email', color: 'purple', position: 3 },
      { value: 'WHATSAPP', label: 'WhatsApp', color: 'green', position: 4 },
      { value: 'OTHER', label: 'Other', color: 'gray', position: 5 },
    ],
  },
  {
    name: 'stoppedReason',
    label: 'Stopped Reason',
    type: 'TEXT',
    icon: 'IconHandStop',
  },
  {
    name: 'personaPriorityScore',
    label: 'Persona Priority Score',
    type: 'NUMBER',
    icon: 'IconSortDescending',
  },
  {
    name: 'connectionDegree',
    label: 'Connection Degree',
    type: 'NUMBER',
    icon: 'IconTopologyStar',
  },
];

const PROJECT_FIELDS_TO_ENSURE: FieldToCreate[] = [
  { name: 'icpSegment', label: 'ICP Segment', type: 'TEXT', icon: 'IconTags' },
  {
    name: 'outreachWorkflowId',
    label: 'Outreach Workflow Id',
    type: 'TEXT',
    icon: 'IconGitBranch',
  },
  {
    name: 'outreachSendMode',
    label: 'Outreach Send Mode',
    type: 'SELECT',
    icon: 'IconUserCheck',
    options: [
      { value: 'AUTO', label: 'Auto-send', color: 'green', position: 0 },
      {
        value: 'APPROVAL',
        label: 'Send with approval',
        color: 'orange',
        position: 1,
      },
    ],
  },
  {
    name: 'maxPersonasPerCompany',
    label: 'Max Personas Per Company',
    type: 'NUMBER',
    icon: 'IconUsersGroup',
    defaultValue: 2,
  },
  {
    name: 'inMailFallbackEnabled',
    label: 'InMail Fallback Enabled',
    type: 'BOOLEAN',
    icon: 'IconMailForward',
    defaultValue: false,
  },
  {
    name: 'sendTimezone',
    label: 'Send Timezone',
    type: 'TEXT',
    icon: 'IconWorld',
  },
  {
    name: 'sendWindowStart',
    label: 'Send Window Start',
    type: 'TEXT',
    icon: 'IconClockHour4',
  },
  {
    name: 'sendWindowEnd',
    label: 'Send Window End',
    type: 'TEXT',
    icon: 'IconClockHour9',
  },
  {
    name: 'maxConnectsPerDay',
    label: 'Max Connects Per Day',
    type: 'NUMBER',
    icon: 'IconUserPlus',
    defaultValue: 25,
  },
  {
    name: 'maxCommentsPerDay',
    label: 'Max Comments Per Day',
    type: 'NUMBER',
    icon: 'IconMessageCircle',
    defaultValue: 20,
  },
  {
    name: 'maxEmailsPerDay',
    label: 'Max Emails Per Day',
    type: 'NUMBER',
    icon: 'IconMail',
    defaultValue: 50,
  },
  {
    name: 'linkedinConnectsToday',
    label: 'LinkedIn Connects Today',
    type: 'NUMBER',
    icon: 'IconCounter',
    defaultValue: 0,
  },
  {
    name: 'commentsToday',
    label: 'Comments Today',
    type: 'NUMBER',
    icon: 'IconCounter',
    defaultValue: 0,
  },
  {
    name: 'emailsToday',
    label: 'Emails Today',
    type: 'NUMBER',
    icon: 'IconCounter',
    defaultValue: 0,
  },
  { name: 'icpSpec', label: 'ICP Spec', type: 'TEXT', icon: 'IconJson' },
  {
    name: 'complianceCopy',
    label: 'Compliance Copy',
    type: 'TEXT',
    icon: 'IconScale',
  },
];

const PERSON_FIELDS_TO_ENSURE: FieldToCreate[] = [
  {
    name: 'doNotContact',
    label: 'Do Not Contact',
    type: 'BOOLEAN',
    icon: 'IconBan',
    defaultValue: false,
  },
  {
    name: 'unsubscribedAt',
    label: 'Unsubscribed At',
    type: 'DATE_TIME',
    icon: 'IconMailOff',
  },
  {
    name: 'notInterestedAt',
    label: 'Not Interested At',
    type: 'DATE_TIME',
    icon: 'IconThumbDown',
  },
  {
    name: 'bounceCount',
    label: 'Bounce Count',
    type: 'NUMBER',
    icon: 'IconMailX',
  },
  {
    name: 'oooUntil',
    label: 'OOO Until',
    type: 'DATE_TIME',
    icon: 'IconBeach',
  },
  {
    name: 'linkedinConnectionDegree',
    label: 'LinkedIn Connection Degree',
    type: 'NUMBER',
    icon: 'IconTopologyStar',
  },
];

const OPPORTUNITY_FIELDS_TO_ENSURE: FieldToCreate[] = [
  {
    name: 'sourcedFromGtm',
    label: 'Sourced From GTM',
    type: 'BOOLEAN',
    icon: 'IconTargetArrow',
    defaultValue: false,
  },
  { name: 'gtmRunKey', label: 'GTM Run Key', type: 'TEXT', icon: 'IconKey' },
];

const createOneField = async (
  objectMetadataId: string,
  field: FieldToCreate,
) => {
  await request(
    '/metadata',
    `mutation($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) { id name }
    }`,
    {
      input: {
        field: {
          objectMetadataId,
          name: field.name,
          label: field.label,
          type: field.type,
          icon: field.icon,
          isNullable: true,
          ...(field.options ? { options: field.options } : {}),
          ...(field.defaultValue !== undefined
            ? { defaultValue: field.defaultValue }
            : {}),
        },
      },
    },
  );
};

const ensureFieldsOnObject = async (
  objectMeta: ObjectMeta,
  fieldsToEnsure: FieldToCreate[],
) => {
  const existing = new Set(objectMeta.fieldsList.map((field) => field.name));
  let createdCount = 0;

  for (const field of fieldsToEnsure) {
    if (existing.has(field.name)) {
      continue;
    }

    try {
      await createOneField(objectMeta.id, field);
      createdCount += 1;
      console.log(`  created ${objectMeta.nameSingular}.${field.name}`);
    } catch (error) {
      console.warn(
        `  failed creating ${objectMeta.nameSingular}.${field.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return createdCount;
};

const refreshObject = async (nameSingular: string): Promise<ObjectMeta> => {
  const data = await request<{
    objects: { edges: Array<{ node: ObjectMeta }> };
  }>(
    '/metadata',
    `{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name type } } } } }`,
  );

  const objectMeta = data.objects.edges.find(
    ({ node }) => node.nameSingular === nameSingular,
  )?.node;

  if (!objectMeta) {
    throw new Error(
      `Missing object metadata for ${nameSingular}. Sync Arxena standard first:\n` +
        `  npx nx run twenty-server:command -- workspace:sync-arxena-standard -w <workspaceId>`,
    );
  }

  return objectMeta;
};

const getObjects = async () => {
  const data = await request<{
    objects: { edges: Array<{ node: ObjectMeta }> };
  }>(
    '/metadata',
    `{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name type } } } } }`,
  );

  const byName = Object.fromEntries(
    data.objects.edges.map(({ node }) => [node.nameSingular, node]),
  );

  for (const name of [
    'company',
    'person',
    'opportunity',
    'candidate',
    'project',
    'whatsappMessage',
  ] as const) {
    if (!byName[name]) {
      throw new Error(
        `Missing object metadata for ${name}.\n` +
          `This workspace needs Arxena standard objects. Sync with:\n` +
          `  npx nx run twenty-server:command -- workspace:sync-arxena-standard -w <workspaceId>\n` +
          `(workspaceId is in your API token JWT payload as workspaceId)`,
      );
    }
  }

  return {
    company: byName.company,
    person: byName.person,
    opportunity: byName.opportunity,
    candidate: byName.candidate,
    project: byName.project,
    whatsappMessage: byName.whatsappMessage,
    calendarEvent: byName.calendarEvent,
  };
};

const findExistingDashboard = async () => {
  const data = await request<{
    dashboards: {
      edges: Array<{
        node: { id: string; title: string; pageLayoutId: string };
      }>;
    };
  }>(
    '/graphql',
    `query($filter: DashboardFilterInput) {
      dashboards(first: 5, filter: $filter) {
        edges { node { id title pageLayoutId } }
      }
    }`,
    { filter: { title: { eq: DASHBOARD_TITLE } } },
  );

  return data.dashboards.edges[0]?.node ?? null;
};

const buildCompanyPayload = (
  company: CompanySeed,
  companyFields: FieldMap,
) => {
  const payload: Record<string, unknown> = {
    name: company.name,
    domainName: {
      primaryLinkUrl: `https://${company.domain}`,
      primaryLinkLabel: company.domain,
    },
    gtmStatus: company.gtmStatus,
    gtmFunnelStage: company.gtmFunnelStage,
    icpSegment: company.segment,
    icpFit: company.icpFit,
    peopleTargeted: company.peopleTargeted,
    peopleReached: company.peopleReached,
    coverageBucket: company.coverageBucket,
    channelsUsed: company.channelsUsed,
    firstContactChannel: company.firstContactChannel ?? null,
    daysToFirstContact: company.daysToFirstContact ?? null,
    daysToMeetingBooked: company.daysToMeetingBooked ?? null,
    timeToFirstContactBucket: company.timeToFirstContactBucket ?? null,
    timeToMeetingBucket: company.timeToMeetingBucket ?? null,
    attentionReason: company.attentionReason,
    daysSinceLastTouch: company.daysSinceLastTouch,
    coverageScore: company.coverageScore,
    firstContactAt:
      company.firstContactDaysAgo !== undefined
        ? daysAgoIso(company.firstContactDaysAgo)
        : null,
    firstReplyAt:
      company.firstReplyDaysAgo !== undefined
        ? daysAgoIso(company.firstReplyDaysAgo)
        : null,
    meetingBookedAt:
      company.meetingBookedDaysAgo !== undefined
        ? daysAgoIso(company.meetingBookedDaysAgo)
        : null,
    meetingHeldAt:
      company.meetingHeldDaysAgo !== undefined
        ? daysAgoIso(company.meetingHeldDaysAgo)
        : null,
  };

  if (companyFields?.employees) {
    payload.employees = company.employees;
  }

  return payload;
};

const seedCompanies = async (
  companyIdsByKey: Record<string, string>,
  companyFields: FieldMap,
) => {
  for (const company of GTM_COMPANIES) {
    const payload = buildCompanyPayload(company, companyFields);

    const existing = await request<{
      companies: { edges: Array<{ node: { id: string; name: string } }> };
    }>(
      '/graphql',
      `query($filter: CompanyFilterInput) {
        companies(first: 1, filter: $filter) {
          edges { node { id name } }
        }
      }`,
      { filter: { name: { eq: company.name } } },
    );

    const existingId = existing.companies.edges[0]?.node.id;

    if (existingId) {
      await requestWithRetry(
        '/graphql',
        `mutation($id: ID!, $data: CompanyUpdateInput!) {
          updateCompany(id: $id, data: $data) { id }
        }`,
        { id: existingId, data: payload },
      );
      companyIdsByKey[company.key] = existingId;
      console.log(`  updated company ${company.name}`);
      await sleep(300);
      continue;
    }

    const created = await requestWithRetry<{
      createCompany: { id: string };
    }>(
      '/graphql',
      `mutation($data: CompanyCreateInput!) {
        createCompany(data: $data) { id }
      }`,
      { data: payload },
    );

    companyIdsByKey[company.key] = created.createCompany.id;
    console.log(`  company ${company.name}`);
    await sleep(300);
  }
};

const seedPeople = async (
  companyIdsByKey: Record<string, string>,
  personIdsByEmail: Record<string, string>,
) => {
  for (const person of GTM_PEOPLE) {
    const companyId = companyIdsByKey[person.companyKey];
    if (!companyId) {
      throw new Error(`Missing company for ${person.firstName}`);
    }

    const existing = await request<{
      people: { edges: Array<{ node: { id: string } }> };
    }>(
      '/graphql',
      `query($filter: PersonFilterInput) {
        people(first: 1, filter: $filter) {
          edges { node { id } }
        }
      }`,
      {
        filter: {
          and: [
            { emails: { primaryEmail: { eq: person.email } } },
            { companyId: { eq: companyId } },
          ],
        },
      },
    );

    const existingId = existing.people.edges[0]?.node.id;
    if (existingId) {
      personIdsByEmail[person.email] = existingId;
      continue;
    }

    const created = await request<{ createPerson: { id: string } }>(
      '/graphql',
      `mutation($data: PersonCreateInput!) {
        createPerson(data: $data) { id }
      }`,
      {
        data: {
          name: {
            firstName: person.firstName,
            lastName: person.lastName,
          },
          jobTitle: person.title,
          companyId,
          emails: { primaryEmail: person.email },
          linkedinLink: {
            primaryLinkUrl: person.linkedin,
            primaryLinkLabel: person.linkedin.replace(/^https?:\/\//, ''),
          },
        },
      },
    );

    personIdsByEmail[person.email] = created.createPerson.id;
    console.log(`  person ${person.firstName} ${person.lastName}`);
  }
};

const seedProject = async (companyIdsByKey: Record<string, string>) => {
  const projectName = GTM_SEED_PROJECT_NAME;
  const primaryCompanyId = companyIdsByKey['co-1'];

  const existing = await request<{
    projects: { edges: Array<{ node: { id: string } }> };
  }>(
    '/graphql',
    `query($filter: ProjectFilterInput) {
      projects(first: 1, filter: $filter) {
        edges { node { id } }
      }
    }`,
    { filter: { name: { eq: projectName } } },
  );

  const existingId = existing.projects.edges[0]?.node.id;
  const payload = {
    name: projectName,
    isActive: true,
    icpSegment: 'Series B SaaS',
    ...(primaryCompanyId ? { companyId: primaryCompanyId } : {}),
  };

  if (existingId) {
    await request(
      '/graphql',
      `mutation($id: ID!, $data: ProjectUpdateInput!) {
        updateProject(id: $id, data: $data) { id }
      }`,
      { id: existingId, data: payload },
    );
    console.log(`  updated project ${projectName}`);
    return existingId;
  }

  const created = await request<{ createProject: { id: string } }>(
    '/graphql',
    `mutation($data: ProjectCreateInput!) {
      createProject(data: $data) { id }
    }`,
    { data: payload },
  );

  console.log(`  project ${projectName}`);
  return created.createProject.id;
};

const seedCandidates = async ({
  projectId,
  personIdsByEmail,
}: {
  projectId: string;
  personIdsByEmail: Record<string, string>;
}) => {
  const candidateIds: string[] = [];

  for (const person of GTM_PEOPLE) {
    const candidateName = `${person.firstName} ${person.lastName}`;
    const personId = personIdsByEmail[person.email];
    const company = GTM_COMPANIES.find(
      (companySeed) => companySeed.key === person.companyKey,
    );

    const payload: Record<string, unknown> = {
      name: candidateName,
      jobTitle: person.title,
      jobCompanyName: company?.name,
      email: { primaryEmail: person.email },
      linkedinUrl: {
        primaryLinkUrl: person.linkedin,
        primaryLinkLabel: person.linkedin.replace(/^https?:\/\//, ''),
      },
      projectsId: projectId,
      ...(personId ? { peopleId: personId } : {}),
      outreachSequenceStage: person.outreachSequenceStage,
      connectionStatus: person.connectionStatus,
      enrichStatus: person.enrichStatus,
      messagingChannel: person.messagingChannel,
      engagementStatus: person.lastInboundDaysAgo !== undefined,
      candConversationStatus:
        person.lastInboundDaysAgo !== undefined
          ? 'CANDIDATE_IS_KEEN_TO_CHAT'
          : 'ONLY_ADDED_NO_CONVERSATION',
      firstOutboundAt:
        person.firstOutboundDaysAgo !== undefined
          ? daysAgoIso(person.firstOutboundDaysAgo)
          : null,
      lastOutboundAt:
        person.lastOutboundDaysAgo !== undefined
          ? daysAgoIso(person.lastOutboundDaysAgo)
          : null,
      lastInboundAt:
        person.lastInboundDaysAgo !== undefined
          ? daysAgoIso(person.lastInboundDaysAgo)
          : null,
      enrichedAt:
        person.enrichStatus === 'FOUND' || person.enrichStatus === 'FAILED'
          ? daysAgoIso(person.lastOutboundDaysAgo ?? 7)
          : null,
      campaign: projectId,
      source: 'gtm-command-seed',
    };

    const existing = await request<{
      candidates: { edges: Array<{ node: { id: string } }> };
    }>(
      '/graphql',
      `query($filter: CandidateFilterInput) {
        candidates(first: 1, filter: $filter) {
          edges { node { id } }
        }
      }`,
      {
        filter: {
          and: [
            { name: { eq: candidateName } },
            { projectsId: { eq: projectId } },
          ],
        },
      },
    );

    const existingId = existing.candidates.edges[0]?.node.id;

    if (existingId) {
      await requestWithRetry(
        '/graphql',
        `mutation($id: ID!, $data: CandidateUpdateInput!) {
          updateCandidate(id: $id, data: $data) { id }
        }`,
        { id: existingId, data: payload },
      );
      candidateIds.push(existingId);
      console.log(`  updated candidate ${candidateName}`);
      await sleep(400);
      continue;
    }

    const created = await requestWithRetry<{ createCandidate: { id: string } }>(
      '/graphql',
      `mutation($data: CandidateCreateInput!) {
        createCandidate(data: $data) { id }
      }`,
      { data: payload },
    );

    candidateIds.push(created.createCandidate.id);
    console.log(`  candidate ${candidateName}`);
    await sleep(400);
  }

  return candidateIds;
};

const seedWhatsappMessages = async ({
  projectId,
  candidateIds,
}: {
  projectId: string;
  candidateIds: string[];
}) => {
  const sampleCandidates = candidateIds.slice(0, 6);

  for (const [index, candidateId] of sampleCandidates.entries()) {
    const messageName = `GTM seed msg ${index + 1}`;
    const existing = await request<{
      whatsappMessages: { edges: Array<{ node: { id: string } }> };
    }>(
      '/graphql',
      `query($filter: WhatsappMessageFilterInput) {
        whatsappMessages(first: 1, filter: $filter) {
          edges { node { id } }
        }
      }`,
      { filter: { name: { eq: messageName } } },
    );

    if (existing.whatsappMessages.edges[0]?.node.id) {
      continue;
    }

    await request(
      '/graphql',
      `mutation($data: WhatsappMessageCreateInput!) {
        createWhatsappMessage(data: $data) { id }
      }`,
      {
        data: {
          name: messageName,
          message: index % 2 === 0 ? 'Outbound GTM touch' : 'Inbound received',
          typeOfMessage: index % 2 === 0 ? 'OUTGOING' : 'INCOMING',
          whatsappDeliveryStatus: 'delivered',
          phoneFrom: '+15550001111',
          phoneTo: `+1555000${1000 + index}`,
          candidateId,
          projectsId: projectId,
        },
      },
    );

    console.log(`  whatsappMessage ${messageName}`);
  }
};

const seedOpportunities = async (
  companyIdsByKey: Record<string, string>,
  projectId: string,
) => {
  for (const opportunity of OPPORTUNITY_SEEDS) {
    const companyId = companyIdsByKey[opportunity.companyKey];
    if (!companyId) {
      throw new Error(`Missing company for opportunity ${opportunity.name}`);
    }

    const payload = {
      name: opportunity.name,
      stage: opportunity.stage,
      companyId,
      sourcedFromGtm: true,
      gtmRunKey: projectId,
      amount: {
        amountMicros: opportunity.amountMicros,
        currencyCode: 'USD',
      },
      ...(opportunity.stage === 'MEETING' || opportunity.stage === 'CUSTOMER'
        ? { meetingScheduledAt: daysAgoIso(7) }
        : {}),
    };

    const existing = await request<{
      opportunities: { edges: Array<{ node: { id: string } }> };
    }>(
      '/graphql',
      `query($filter: OpportunityFilterInput) {
        opportunities(first: 1, filter: $filter) {
          edges { node { id } }
        }
      }`,
      { filter: { name: { eq: opportunity.name } } },
    );

    const existingId = existing.opportunities.edges[0]?.node.id;

    if (existingId) {
      await request(
        '/graphql',
        `mutation($id: ID!, $data: OpportunityUpdateInput!) {
          updateOpportunity(id: $id, data: $data) { id }
        }`,
        { id: existingId, data: payload },
      );
      continue;
    }

    await requestWithRetry(
      '/graphql',
      `mutation($data: OpportunityCreateInput!) {
        createOpportunity(data: $data) { id }
      }`,
      { data: payload },
    );

    console.log(`  opportunity ${opportunity.name}`);
    await sleep(700);
  }
};

const createTableWidgetView = async ({
  name,
  objectMetadataId,
  fieldIds,
  filters,
}: {
  name: string;
  objectMetadataId: string;
  fieldIds: string[];
  filters?: Array<{
    fieldMetadataId: string;
    operand: string;
    value: string;
  }>;
}) => {
  const view = await request<{
    createView: { id: string };
  }>(
    '/metadata',
    `mutation($input: CreateViewInput!) {
      createView(input: $input) { id name type }
    }`,
    {
      input: {
        name,
        objectMetadataId,
        type: 'TABLE_WIDGET',
        icon: 'IconTable',
        visibility: 'WORKSPACE',
      },
    },
  );

  await request(
    '/metadata',
    `mutation($inputs: [CreateViewFieldInput!]!) {
      createManyViewFields(inputs: $inputs) { id }
    }`,
    {
      inputs: fieldIds.map((fieldMetadataId, position) => ({
        viewId: view.createView.id,
        fieldMetadataId,
        position,
        isVisible: true,
        size: 150,
      })),
    },
  );

  if (filters && filters.length > 0) {
    for (const filter of filters) {
      await requestWithRetry(
        '/metadata',
        `mutation($input: CreateViewFilterInput!) {
          createViewFilter(input: $input) { id }
        }`,
        {
          input: {
            viewId: view.createView.id,
            fieldMetadataId: filter.fieldMetadataId,
            operand: filter.operand,
            value: filter.value,
          },
        },
      );
    }
  }

  return view.createView.id;
};

const grid = (
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
) => ({ row, column, rowSpan, columnSpan });

const positionFromGrid = (gridPosition: ReturnType<typeof grid>) => ({
  layoutMode: 'GRID',
  ...gridPosition,
});

const aggregateWidget = ({
  tabId,
  title,
  objectMetadataId,
  fieldId,
  gridPosition,
  filter,
  aggregateOperation = 'COUNT',
}: {
  tabId: string;
  title: string;
  objectMetadataId: string;
  fieldId: string;
  gridPosition: ReturnType<typeof grid>;
  filter?: Record<string, unknown>;
  aggregateOperation?: string;
}) => ({
  id: randomUUID(),
  pageLayoutTabId: tabId,
  title,
  type: 'GRAPH',
  objectMetadataId,
  gridPosition,
  position: positionFromGrid(gridPosition),
  configuration: {
    configurationType: 'AGGREGATE_CHART',
    aggregateFieldMetadataId: fieldId,
    aggregateOperation,
    displayDataLabel: false,
    prefix: '',
    timezone: 'UTC',
    firstDayOfTheWeek: 0,
    ...(filter ? { filter } : {}),
  },
});

const barWidget = ({
  tabId,
  title,
  objectMetadataId,
  aggregateFieldId,
  groupByFieldId,
  gridPosition,
  layout = 'HORIZONTAL',
  color = 'blue',
  filter,
  aggregateOperation = 'COUNT',
}: {
  tabId: string;
  title: string;
  objectMetadataId: string;
  aggregateFieldId: string;
  groupByFieldId: string;
  gridPosition: ReturnType<typeof grid>;
  layout?: 'HORIZONTAL' | 'VERTICAL';
  color?: string;
  filter?: Record<string, unknown>;
  aggregateOperation?: string;
}) => ({
  id: randomUUID(),
  pageLayoutTabId: tabId,
  title,
  type: 'GRAPH',
  objectMetadataId,
  gridPosition,
  position: positionFromGrid(gridPosition),
  configuration: {
    configurationType: 'BAR_CHART',
    aggregateFieldMetadataId: aggregateFieldId,
    aggregateOperation,
    primaryAxisGroupByFieldMetadataId: groupByFieldId,
    primaryAxisOrderBy: 'FIELD_POSITION_ASC',
    axisNameDisplay: 'BOTH',
    displayDataLabel: true,
    displayLegend: false,
    color,
    layout,
    timezone: 'UTC',
    firstDayOfTheWeek: 0,
    ...(filter ? { filter } : {}),
  },
});

const pieWidget = ({
  tabId,
  title,
  objectMetadataId,
  aggregateFieldId,
  groupByFieldId,
  gridPosition,
  color = 'orange',
  filter,
}: {
  tabId: string;
  title: string;
  objectMetadataId: string;
  aggregateFieldId: string;
  groupByFieldId: string;
  gridPosition: ReturnType<typeof grid>;
  color?: string;
  filter?: Record<string, unknown>;
}) => ({
  id: randomUUID(),
  pageLayoutTabId: tabId,
  title,
  type: 'GRAPH',
  objectMetadataId,
  gridPosition,
  position: positionFromGrid(gridPosition),
  configuration: {
    configurationType: 'PIE_CHART',
    aggregateFieldMetadataId: aggregateFieldId,
    aggregateOperation: 'COUNT',
    groupByFieldMetadataId: groupByFieldId,
    orderBy: 'FIELD_POSITION_ASC',
    displayDataLabel: false,
    showCenterMetric: true,
    displayLegend: true,
    color,
    timezone: 'UTC',
    firstDayOfTheWeek: 0,
    ...(filter ? { filter } : {}),
  },
});

const lineWidget = ({
  tabId,
  title,
  objectMetadataId,
  aggregateFieldId,
  dateFieldId,
  gridPosition,
  color = 'blue',
}: {
  tabId: string;
  title: string;
  objectMetadataId: string;
  aggregateFieldId: string;
  dateFieldId: string;
  gridPosition: ReturnType<typeof grid>;
  color?: string;
}) => ({
  id: randomUUID(),
  pageLayoutTabId: tabId,
  title,
  type: 'GRAPH',
  objectMetadataId,
  gridPosition,
  position: positionFromGrid(gridPosition),
  configuration: {
    configurationType: 'LINE_CHART',
    aggregateFieldMetadataId: aggregateFieldId,
    aggregateOperation: 'COUNT',
    primaryAxisGroupByFieldMetadataId: dateFieldId,
    primaryAxisDateGranularity: 'WEEK',
    primaryAxisOrderBy: 'FIELD_ASC',
    axisNameDisplay: 'NONE',
    displayDataLabel: false,
    displayLegend: false,
    color,
    timezone: 'UTC',
    firstDayOfTheWeek: 0,
  },
});

const tableWidget = ({
  tabId,
  title,
  objectMetadataId,
  viewId,
  gridPosition,
}: {
  tabId: string;
  title: string;
  objectMetadataId: string;
  viewId: string;
  gridPosition: ReturnType<typeof grid>;
}) => ({
  id: randomUUID(),
  pageLayoutTabId: tabId,
  title,
  type: 'RECORD_TABLE',
  objectMetadataId,
  gridPosition,
  position: positionFromGrid(gridPosition),
  configuration: {
    configurationType: 'RECORD_TABLE',
    viewId,
    recordLimit: 50,
  },
});

const buildDashboardLayout = async ({
  pageLayoutId,
  companyObjectId,
  candidateObjectId,
  opportunityObjectId,
  whatsappMessageObjectId,
  companyFields,
  candidateFields,
  opportunityFields,
  whatsappMessageFields,
  attentionViewId,
  uncoveredViewId,
  stuckCandidatesViewId,
  opportunitiesViewId,
  projectId,
}: {
  pageLayoutId: string;
  companyObjectId: string;
  candidateObjectId: string;
  opportunityObjectId: string;
  whatsappMessageObjectId: string;
  companyFields: FieldMap;
  candidateFields: FieldMap;
  opportunityFields: FieldMap;
  whatsappMessageFields: FieldMap;
  attentionViewId: string;
  uncoveredViewId: string;
  stuckCandidatesViewId: string;
  opportunitiesViewId: string;
  projectId: string;
}) => {
  const overviewTabId = randomUUID();
  const coverageTabId = randomUUID();
  const stagesTabId = randomUUID();
  const channelsTabId = randomUUID();
  const speedTabId = randomUUID();
  const outcomesTabId = randomUUID();

  const tabs = [
    {
      id: overviewTabId,
      title: 'Overview',
      position: 0,
      icon: 'IconLayoutDashboard',
      layoutMode: 'GRID',
      widgets: [
        aggregateWidget({
          tabId: overviewTabId,
          title: 'Target companies',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 0, 3, 2),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.gtmRunKey,
                operand: 'CONTAINS',
                value: projectId,
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: overviewTabId,
          title: 'Covered',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 2, 3, 2),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.gtmFunnelStage,
                operand: 'IS',
                value: JSON.stringify([
                  'COVERED',
                  'REPLIED',
                  'MEETING_BOOKED',
                  'MEETING_HELD',
                  'OPPORTUNITY',
                ]),
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: overviewTabId,
          title: 'Responded',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 4, 3, 2),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.gtmFunnelStage,
                operand: 'IS',
                value: JSON.stringify([
                  'REPLIED',
                  'MEETING_BOOKED',
                  'MEETING_HELD',
                  'OPPORTUNITY',
                ]),
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: overviewTabId,
          title: 'Meetings booked',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 6, 3, 2),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.meetingBookedAt,
                operand: 'IS_NOT_NULL',
                value: '',
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: overviewTabId,
          title: 'GTM opportunities',
          objectMetadataId: opportunityObjectId,
          fieldId: opportunityFields.id,
          gridPosition: grid(0, 8, 3, 2),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: opportunityFields.sourcedFromGtm,
                operand: 'IS',
                value: 'true',
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: overviewTabId,
          title: 'Avg days → meeting',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.daysToMeetingBooked,
          gridPosition: grid(0, 10, 3, 2),
          aggregateOperation: 'AVG',
        }),
        barWidget({
          tabId: overviewTabId,
          title: 'Funnel: Added → Opportunity',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          groupByFieldId: companyFields.gtmFunnelStage,
          gridPosition: grid(3, 0, 6, 7),
          layout: 'HORIZONTAL',
          color: 'blue',
        }),
        lineWidget({
          tabId: overviewTabId,
          title: 'Companies added (weekly)',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          dateFieldId: companyFields.createdAt,
          gridPosition: grid(3, 7, 3, 5),
          color: 'turquoise',
        }),
        lineWidget({
          tabId: overviewTabId,
          title: 'First contacts (weekly)',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          dateFieldId: companyFields.firstContactAt,
          gridPosition: grid(6, 7, 3, 5),
          color: 'purple',
        }),
        tableWidget({
          tabId: overviewTabId,
          title: 'Runs needing attention',
          objectMetadataId: companyObjectId,
          viewId: attentionViewId,
          gridPosition: grid(9, 0, 6, 12),
        }),
      ],
    },
    {
      id: coverageTabId,
      title: 'Account coverage',
      position: 1,
      icon: 'IconBuildingSkyscraper',
      layoutMode: 'GRID',
      widgets: [
        pieWidget({
          tabId: coverageTabId,
          title: 'Coverage buckets',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          groupByFieldId: companyFields.coverageBucket,
          gridPosition: grid(0, 0, 6, 5),
          color: 'blue',
        }),
        aggregateWidget({
          tabId: coverageTabId,
          title: 'Avg people targeted',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.peopleTargeted,
          gridPosition: grid(0, 5, 3, 3),
          aggregateOperation: 'AVG',
        }),
        aggregateWidget({
          tabId: coverageTabId,
          title: 'Avg people reached',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.peopleReached,
          gridPosition: grid(0, 8, 3, 4),
          aggregateOperation: 'AVG',
        }),
        barWidget({
          tabId: coverageTabId,
          title: 'People reached by funnel stage',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.peopleReached,
          groupByFieldId: companyFields.gtmFunnelStage,
          gridPosition: grid(3, 5, 5, 7),
          layout: 'VERTICAL',
          color: 'green',
          aggregateOperation: 'SUM',
        }),
        tableWidget({
          tabId: coverageTabId,
          title: 'Uncovered high-ICP companies',
          objectMetadataId: companyObjectId,
          viewId: uncoveredViewId,
          gridPosition: grid(8, 0, 6, 12),
        }),
      ],
    },
    {
      id: stagesTabId,
      title: 'Workflow stage health',
      position: 2,
      icon: 'IconRoute',
      layoutMode: 'GRID',
      widgets: [
        barWidget({
          tabId: stagesTabId,
          title: 'Candidates by outreach sequence stage',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.outreachSequenceStage,
          gridPosition: grid(0, 0, 7, 7),
          layout: 'HORIZONTAL',
          color: 'purple',
        }),
        pieWidget({
          tabId: stagesTabId,
          title: 'Connection status',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.connectionStatus,
          gridPosition: grid(0, 7, 7, 5),
          color: 'orange',
        }),
        pieWidget({
          tabId: stagesTabId,
          title: 'Enrich failures / status',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.enrichStatus,
          gridPosition: grid(7, 0, 5, 5),
          color: 'red',
        }),
        barWidget({
          tabId: stagesTabId,
          title: 'Conversation health',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.candConversationStatus,
          gridPosition: grid(7, 5, 5, 7),
          layout: 'VERTICAL',
          color: 'turquoise',
        }),
        tableWidget({
          tabId: stagesTabId,
          title: 'Stuck / failed candidates',
          objectMetadataId: candidateObjectId,
          viewId: stuckCandidatesViewId,
          gridPosition: grid(12, 0, 6, 12),
        }),
      ],
    },
    {
      id: channelsTabId,
      title: 'Channel mix',
      position: 3,
      icon: 'IconMessage',
      layoutMode: 'GRID',
      widgets: [
        pieWidget({
          tabId: channelsTabId,
          title: 'Candidates by messaging channel',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.messagingChannel,
          gridPosition: grid(0, 0, 6, 6),
          color: 'blue',
        }),
        pieWidget({
          tabId: channelsTabId,
          title: 'First contact channel (companies)',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          groupByFieldId: companyFields.firstContactChannel,
          gridPosition: grid(0, 6, 6, 6),
          color: 'green',
        }),
        lineWidget({
          tabId: channelsTabId,
          title: 'WhatsApp / LinkedIn messages over time',
          objectMetadataId: whatsappMessageObjectId,
          aggregateFieldId: whatsappMessageFields.id,
          dateFieldId: whatsappMessageFields.createdAt,
          gridPosition: grid(6, 0, 5, 7),
          color: 'turquoise',
        }),
        barWidget({
          tabId: channelsTabId,
          title: 'Enrich status',
          objectMetadataId: candidateObjectId,
          aggregateFieldId: candidateFields.id,
          groupByFieldId: candidateFields.enrichStatus,
          gridPosition: grid(6, 7, 5, 5),
          layout: 'VERTICAL',
          color: 'orange',
        }),
      ],
    },
    {
      id: speedTabId,
      title: 'Speed',
      position: 4,
      icon: 'IconClockHour4',
      layoutMode: 'GRID',
      widgets: [
        barWidget({
          tabId: speedTabId,
          title: 'Time to first contact',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          groupByFieldId: companyFields.timeToFirstContactBucket,
          gridPosition: grid(0, 0, 6, 6),
          layout: 'VERTICAL',
          color: 'blue',
        }),
        barWidget({
          tabId: speedTabId,
          title: 'Time to meeting booked',
          objectMetadataId: companyObjectId,
          aggregateFieldId: companyFields.id,
          groupByFieldId: companyFields.timeToMeetingBucket,
          gridPosition: grid(0, 6, 6, 6),
          layout: 'VERTICAL',
          color: 'purple',
        }),
        aggregateWidget({
          tabId: speedTabId,
          title: 'Avg days → first contact',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.daysToFirstContact,
          gridPosition: grid(6, 0, 3, 4),
          aggregateOperation: 'AVG',
        }),
        aggregateWidget({
          tabId: speedTabId,
          title: 'Avg days → meeting',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.daysToMeetingBooked,
          gridPosition: grid(6, 4, 3, 4),
          aggregateOperation: 'AVG',
        }),
        aggregateWidget({
          tabId: speedTabId,
          title: 'Max days → meeting',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.daysToMeetingBooked,
          gridPosition: grid(6, 8, 3, 4),
          aggregateOperation: 'MAX',
        }),
        tableWidget({
          tabId: speedTabId,
          title: 'Slow / aging accounts',
          objectMetadataId: companyObjectId,
          viewId: attentionViewId,
          gridPosition: grid(9, 0, 6, 12),
        }),
      ],
    },
    {
      id: outcomesTabId,
      title: 'Outcomes',
      position: 5,
      icon: 'IconTrophy',
      layoutMode: 'GRID',
      widgets: [
        aggregateWidget({
          tabId: outcomesTabId,
          title: 'Meetings booked',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 0, 3, 3),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.meetingBookedAt,
                operand: 'IS_NOT_NULL',
                value: '',
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: outcomesTabId,
          title: 'Meetings held',
          objectMetadataId: companyObjectId,
          fieldId: companyFields.id,
          gridPosition: grid(0, 3, 3, 3),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: companyFields.meetingHeldAt,
                operand: 'IS_NOT_NULL',
                value: '',
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: outcomesTabId,
          title: 'GTM opportunities',
          objectMetadataId: opportunityObjectId,
          fieldId: opportunityFields.id,
          gridPosition: grid(0, 6, 3, 3),
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: opportunityFields.sourcedFromGtm,
                operand: 'IS',
                value: 'true',
              },
            ],
          },
        }),
        aggregateWidget({
          tabId: outcomesTabId,
          title: 'Pipeline value',
          objectMetadataId: opportunityObjectId,
          fieldId: opportunityFields.amount,
          gridPosition: grid(0, 9, 3, 3),
          aggregateOperation: 'SUM',
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: opportunityFields.sourcedFromGtm,
                operand: 'IS',
                value: 'true',
              },
            ],
          },
        }),
        barWidget({
          tabId: outcomesTabId,
          title: 'GTM deals by stage',
          objectMetadataId: opportunityObjectId,
          aggregateFieldId: opportunityFields.id,
          groupByFieldId: opportunityFields.stage,
          gridPosition: grid(3, 0, 6, 12),
          layout: 'VERTICAL',
          color: 'green',
          filter: {
            recordFilters: [
              {
                id: randomUUID(),
                fieldMetadataId: opportunityFields.sourcedFromGtm,
                operand: 'IS',
                value: 'true',
              },
            ],
          },
        }),
        tableWidget({
          tabId: outcomesTabId,
          title: 'Recent GTM opportunities',
          objectMetadataId: opportunityObjectId,
          viewId: opportunitiesViewId,
          gridPosition: grid(9, 0, 6, 12),
        }),
      ],
    },
  ];

  await request(
    '/metadata',
    `mutation($id: String!, $input: UpdatePageLayoutWithTabsInput!) {
      updatePageLayoutWithTabsAndWidgets(id: $id, input: $input) {
        id
        name
        tabs { id title position }
      }
    }`,
    {
      id: pageLayoutId,
      input: {
        name: DASHBOARD_TITLE,
        type: 'DASHBOARD',
        objectMetadataId: null,
        tabs,
      },
    },
  );
};

const main = async () => {
  console.log(`Seeding ${DASHBOARD_TITLE} via ${SERVER_URL}`);

  let objects = await getObjects();

  console.log('Ensuring GTM fields exist (create via metadata if missing)...');
  await ensureFieldsOnObject(objects.company, COMPANY_FIELDS_TO_ENSURE);
  await ensureFieldsOnObject(objects.candidate, CANDIDATE_FIELDS_TO_ENSURE);
  await ensureFieldsOnObject(objects.project, PROJECT_FIELDS_TO_ENSURE);
  await ensureFieldsOnObject(objects.opportunity, OPPORTUNITY_FIELDS_TO_ENSURE);
  await ensureFieldsOnObject(objects.person, PERSON_FIELDS_TO_ENSURE);

  // Refresh field maps after possible creates
  objects = {
    ...objects,
    company: await refreshObject('company'),
    candidate: await refreshObject('candidate'),
    project: await refreshObject('project'),
    opportunity: await refreshObject('opportunity'),
    person: await refreshObject('person'),
    whatsappMessage: await refreshObject('whatsappMessage'),
  };

  const companyFields = fieldMapFromObject(objects.company);
  const personFields = fieldMapFromObject(objects.person);
  const opportunityFields = fieldMapFromObject(objects.opportunity);
  const candidateFields = fieldMapFromObject(objects.candidate);
  const projectFields = fieldMapFromObject(objects.project);
  const whatsappMessageFields = fieldMapFromObject(objects.whatsappMessage);

  assertFieldsPresent('company', companyFields, REQUIRED_COMPANY_FIELDS);
  assertFieldsPresent('candidate', candidateFields, REQUIRED_CANDIDATE_FIELDS);
  assertFieldsPresent('project', projectFields, ['icpSegment']);
  assertFieldsPresent('opportunity', opportunityFields, [
    'sourcedFromGtm',
    'gtmRunKey',
  ]);

  const companyIdsByKey: Record<string, string> = {};
  const personIdsByEmail: Record<string, string> = {};

  console.log('Seeding companies with GTM rollups...');
  await seedCompanies(companyIdsByKey, companyFields);

  console.log('Seeding people...');
  await seedPeople(companyIdsByKey, personIdsByEmail);

  console.log('Seeding GTM project...');
  const projectId = GTM_PROJECT_ID || (await seedProject(companyIdsByKey));

  console.log('Tagging companies with Project.id as gtmRunKey...');
  for (const companyId of Object.values(companyIdsByKey)) {
    await requestWithRetry(
      '/graphql',
      `mutation($id: ID!, $data: CompanyUpdateInput!) {
        updateCompany(id: $id, data: $data) { id }
      }`,
      { id: companyId, data: { gtmRunKey: projectId } },
    );
  }

  console.log('Seeding candidates (execution spine)...');
  const candidateIds = await seedCandidates({
    projectId,
    personIdsByEmail,
  });

  console.log('Seeding whatsapp messages...');
  try {
    await seedWhatsappMessages({ projectId, candidateIds });
  } catch (error) {
    console.warn(
      `  skipped whatsapp messages: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log('Seeding opportunities...');
  await seedOpportunities(companyIdsByKey, projectId);

  console.log('Creating widget views...');
  const attentionViewId = await createTableWidgetView({
    name: `${DASHBOARD_TITLE} Attention`,
    objectMetadataId: objects.company.id,
    fieldIds: [
      companyFields.name,
      companyFields.gtmFunnelStage,
      companyFields.attentionReason,
      companyFields.daysSinceLastTouch,
      companyFields.icpFit,
      companyFields.peopleReached,
    ].filter(Boolean),
    filters: [
      {
        fieldMetadataId: companyFields.attentionReason,
        operand: 'IS_NOT',
        value: JSON.stringify(['NONE']),
      },
    ],
  });

  const uncoveredViewId = await createTableWidgetView({
    name: `${DASHBOARD_TITLE} Uncovered ICP`,
    objectMetadataId: objects.company.id,
    fieldIds: [
      companyFields.name,
      companyFields.icpFit,
      companyFields.coverageBucket,
      companyFields.peopleTargeted,
      companyFields.gtmStatus,
    ].filter(Boolean),
  });

  const stuckCandidatesViewId = await createTableWidgetView({
    name: `${DASHBOARD_TITLE} Stuck Candidates`,
    objectMetadataId: objects.candidate.id,
    fieldIds: [
      candidateFields.name,
      candidateFields.outreachSequenceStage,
      candidateFields.connectionStatus,
      candidateFields.enrichStatus,
      candidateFields.messagingChannel,
      candidateFields.lastOutboundAt,
    ].filter(Boolean),
  });

  const opportunitiesViewId = await createTableWidgetView({
    name: `${DASHBOARD_TITLE} Opportunities`,
    objectMetadataId: objects.opportunity.id,
    fieldIds: [
      opportunityFields.name,
      opportunityFields.stage,
      opportunityFields.amount,
      opportunityFields.company,
      opportunityFields.sourcedFromGtm,
      opportunityFields.meetingScheduledAt,
    ].filter(Boolean),
  });

  let dashboard = await findExistingDashboard();
  if (!dashboard) {
    console.log('Creating dashboard...');
    const created = await request<{
      createDashboard: { id: string; title: string; pageLayoutId: string };
    }>(
      '/graphql',
      `mutation($data: DashboardCreateInput!) {
        createDashboard(data: $data) { id title pageLayoutId }
      }`,
      { data: { title: DASHBOARD_TITLE } },
    );
    dashboard = created.createDashboard;
  } else {
    console.log(`Reusing dashboard ${dashboard.id}`);
  }

  console.log('Updating page layout tabs/widgets...');
  await buildDashboardLayout({
    pageLayoutId: dashboard.pageLayoutId,
    companyObjectId: objects.company.id,
    candidateObjectId: objects.candidate.id,
    opportunityObjectId: objects.opportunity.id,
    whatsappMessageObjectId: objects.whatsappMessage.id,
    companyFields,
    candidateFields,
    opportunityFields,
    whatsappMessageFields,
    attentionViewId,
    uncoveredViewId,
    stuckCandidatesViewId,
    opportunitiesViewId,
    projectId,
  });

  console.log(`Done. Open /object/dashboard/${dashboard.id}`);
  console.log(
    `Person fields available (unused on charts): ${Object.keys(personFields).length}`,
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
