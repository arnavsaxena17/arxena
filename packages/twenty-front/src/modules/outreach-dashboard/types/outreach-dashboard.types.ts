export type OutreachDashboardTab =
  | 'overview'
  | 'coverage'
  | 'stages'
  | 'channels'
  | 'speed'
  | 'outcomes';

export type OutreachKpi = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  tone?: 'default' | 'positive' | 'warning' | 'negative';
};

export type OutreachNamedValue = {
  id: string;
  label: string;
  value: number;
  secondary?: string;
};

export type OutreachTrendPoint = {
  label: string;
  companiesAdded: number;
  firstContacts: number;
  replies: number;
  meetings: number;
};

export type OutreachTableColumn = {
  key: string;
  label: string;
};

export type OutreachTableRow = Record<string, string | number>;

export type OutreachDashboardFixtures = {
  kpis: OutreachKpi[];
  funnel: OutreachNamedValue[];
  trend30d: OutreachTrendPoint[];
  attentionRows: OutreachTableRow[];
  coverageBuckets: OutreachNamedValue[];
  avgPeoplePerCompany: number;
  uncoveredCompanies: OutreachTableRow[];
  stageConversion: OutreachNamedValue[];
  stageFailures: OutreachNamedValue[];
  channelFirstContact: OutreachNamedValue[];
  channelReplies: OutreachNamedValue[];
  enrichWaterfall: OutreachNamedValue[];
  timeToFirstContactBuckets: OutreachNamedValue[];
  timeToMeetingBuckets: OutreachNamedValue[];
  slowAccounts: OutreachTableRow[];
  meetingsBooked: number;
  meetingsHeld: number;
  oppCreateRate: string;
  recentMeetings: OutreachTableRow[];
};
