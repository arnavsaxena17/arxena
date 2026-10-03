import { type ThemeColor } from 'twenty-ui/theme';

const OUTREACH_STAGE_TAG_COLORS: Record<string, ThemeColor> = {
  QUEUED: 'gray',
  NEEDS_CONNECTION: 'orange',
  CONNECTION_SENT: 'sky',
  CONNECTION_ACCEPTED: 'blue',
  CONNECTION_IGNORED: 'gray',
  PROFILE_CHECKED: 'gray',
  WARM_PATH: 'violet',
  COMMENTED: 'violet',
  EMAIL_ENRICHING: 'gray',
  EMAIL_SENT: 'sky',
  INMAIL_SENT: 'sky',
  WHATSAPP_SENT: 'sky',
  FOLLOW_UP_1: 'purple',
  FOLLOWED_UP: 'purple',
  FOLLOWED_UP_1: 'purple',
  FOLLOW_UP_2: 'purple',
  FOLLOWED_UP_2: 'purple',
  FOLLOW_UP_3: 'purple',
  FOLLOWED_UP_3: 'purple',
  WAITING_REPLY: 'amber',
  DEFERRED: 'gray',
  STOPPED: 'gray',
  REPLIED: 'green',
  NEGOTIATING: 'turquoise',
  MEETING_BOOKED: 'green',
  BOOKED: 'green',
  FAILED_ENRICH: 'red',
  FAILED_NO_REPLY: 'red',
};

const OUTREACH_CONVERSATION_STAGE_TAG_COLORS: Record<string, ThemeColor> = {
  ACKNOWLEDGEMENT: 'sky',
  INTENT: 'green',
  FOLLOW_UP_MEETING: 'purple',
  MEETING_BOOKED: 'green',
  NOT_INTERESTED: 'red',
  SNOOZED: 'orange',
};

const WORKFLOW_RUN_STATUS_TAG_COLORS: Record<string, ThemeColor> = {
  NOT_STARTED: 'gray',
  ENQUEUED: 'sky',
  RUNNING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  STOPPING: 'gray',
  STOPPED: 'gray',
};

// Company status / ICP fit are free text from Ask AI, so fall back to a
// stable hashed color for values we do not recognise.
const FREE_TEXT_TAG_PALETTE: ThemeColor[] = [
  'blue',
  'turquoise',
  'purple',
  'sky',
  'amber',
  'pink',
  'violet',
  'orange',
];

const ICP_FIT_KEYWORD_COLORS: Array<{ keywords: string[]; color: ThemeColor }> =
  [
    {
      keywords: ['strong', 'high', 'good', 'great', 'excellent', 'yes'],
      color: 'green',
    },
    {
      keywords: ['medium', 'moderate', 'partial', 'maybe', 'mid'],
      color: 'amber',
    },
    { keywords: ['weak', 'low', 'poor', 'no', 'none'], color: 'red' },
  ];

export const getOutreachStageTagColor = (stage: string | null | undefined) =>
  OUTREACH_STAGE_TAG_COLORS[stage ?? ''] ?? 'gray';

export const getOutreachConversationStageTagColor = (
  conversationStage: string | null | undefined,
) => OUTREACH_CONVERSATION_STAGE_TAG_COLORS[conversationStage ?? ''] ?? 'gray';

export const getWorkflowRunStatusTagColor = (
  workflowRunStatus: string | null | undefined,
) => WORKFLOW_RUN_STATUS_TAG_COLORS[workflowRunStatus ?? ''] ?? 'gray';

export const getFreeTextTagColor = (value: string): ThemeColor => {
  let hash = 0;

  for (const character of value.toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return FREE_TEXT_TAG_PALETTE[Math.abs(hash) % FREE_TEXT_TAG_PALETTE.length];
};

export const getIcpFitTagColor = (icpFit: string): ThemeColor => {
  const normalizedFit = icpFit.trim().toLowerCase();

  const keywordMatch = ICP_FIT_KEYWORD_COLORS.find(({ keywords }) =>
    keywords.some((keyword) => normalizedFit.startsWith(keyword)),
  );

  return keywordMatch?.color ?? getFreeTextTagColor(icpFit);
};
