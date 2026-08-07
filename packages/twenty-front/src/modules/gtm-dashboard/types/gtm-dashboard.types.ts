export type GtmDashboardTab =
  | 'overview'
  | 'coverage'
  | 'stages'
  | 'channels'
  | 'speed'
  | 'outcomes';

export type GtmKpi = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  tone?: 'default' | 'positive' | 'warning' | 'negative';
};

export type GtmNamedValue = {
  id: string;
  label: string;
  value: number;
  secondary?: string;
};

export type GtmTrendPoint = {
  label: string;
  companiesAdded: number;
  firstContacts: number;
  replies: number;
  meetings: number;
};

export type GtmTableColumn = {
  key: string;
  label: string;
};

export type GtmTableRow = Record<string, string | number>;

export type GtmDashboardFixtures = {
  kpis: GtmKpi[];
  funnel: GtmNamedValue[];
  trend30d: GtmTrendPoint[];
  attentionRows: GtmTableRow[];
  coverageBuckets: GtmNamedValue[];
  avgPeoplePerCompany: number;
  uncoveredCompanies: GtmTableRow[];
  stageConversion: GtmNamedValue[];
  stageFailures: GtmNamedValue[];
  channelFirstContact: GtmNamedValue[];
  channelReplies: GtmNamedValue[];
  enrichWaterfall: GtmNamedValue[];
  timeToFirstContactBuckets: GtmNamedValue[];
  timeToMeetingBuckets: GtmNamedValue[];
  slowAccounts: GtmTableRow[];
  meetingsBooked: number;
  meetingsHeld: number;
  oppCreateRate: string;
  recentMeetings: GtmTableRow[];
};
