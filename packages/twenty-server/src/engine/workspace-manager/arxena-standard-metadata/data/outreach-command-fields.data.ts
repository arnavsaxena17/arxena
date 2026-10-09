import {
  MessagingChannel,
  MESSAGING_CHANNEL_LABELS,
  MESSAGING_CHANNEL_SELECT_VALUES,
  OUTREACH_CONVERSATION_STAGE_LABELS,
  OUTREACH_CONVERSATION_STAGES,
} from 'twenty-shared/arx';

import { type ArxenaFieldWithObject } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';

const selectOption = (
  value: string,
  label: string,
  color: string,
  position: number,
) => ({
  value,
  label,
  color,
  position,
});

export const OUTREACH_FUNNEL_STAGE_OPTIONS = [
  selectOption('ADDED', 'Added', 'gray', 0),
  selectOption('REACHED', 'Reached', 'sky', 1),
  selectOption('COVERED', 'Covered', 'blue', 2),
  selectOption('REPLIED', 'Replied', 'turquoise', 3),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'green', 4),
  selectOption('MEETING_HELD', 'Meeting held', 'purple', 5),
  selectOption('OPPORTUNITY', 'Opportunity', 'orange', 6),
];

export const OUTREACH_MESSAGE_CHANNEL_OPTIONS = [
  selectOption('WHATSAPP', 'WhatsApp', 'green', 0),
  selectOption('LINKEDIN', 'LinkedIn', 'blue', 1),
  selectOption('EMAIL', 'Email', 'sky', 2),
];

export const ICP_FIT_OPTIONS = [
  selectOption('HIGH', 'High', 'green', 0),
  selectOption('MEDIUM', 'Medium', 'orange', 1),
  selectOption('LOW', 'Low', 'red', 2),
];

export const OUTREACH_COVERAGE_BUCKET_OPTIONS = [
  selectOption('ZERO', '0 people', 'red', 0),
  selectOption('ONE_TWO', '1–2 people', 'orange', 1),
  selectOption('THREE_PLUS', '3+ people', 'green', 2),
];

export const OUTREACH_CHANNEL_OPTIONS = [
  selectOption('LINKEDIN_CONNECT', 'LinkedIn connect', 'blue', 0),
  selectOption('INMAIL', 'InMail', 'sky', 1),
  selectOption('COMMENT', 'Comment', 'turquoise', 2),
  selectOption('EMAIL', 'Email', 'purple', 3),
  selectOption('WHATSAPP', 'WhatsApp', 'green', 4),
  selectOption('OTHER', 'Other', 'gray', 5),
];

// Sticky preferred outbound channel for Candidate Sequencer (reply routing).
export const OUTREACH_PREFERRED_CHANNEL_OPTIONS = [
  selectOption('LINKEDIN', 'LinkedIn', 'blue', 0),
  selectOption('EMAIL', 'Email', 'purple', 1),
  selectOption('WHATSAPP', 'WhatsApp', 'green', 2),
];

export const OUTREACH_TIME_BUCKET_OPTIONS = [
  selectOption('UNDER_1D', '<1d', 'green', 0),
  selectOption('D1_3', '1–3d', 'turquoise', 1),
  selectOption('D3_7', '3–7d', 'blue', 2),
  selectOption('D7_14', '7–14d', 'orange', 3),
  selectOption('OVER_14D', '14d+', 'red', 4),
];

export const OUTREACH_ATTENTION_REASON_OPTIONS = [
  selectOption('NONE', 'None', 'green', 0),
  selectOption('NO_REPLY', 'No reply', 'orange', 1),
  selectOption('CONNECT_IGNORE', 'Connect ignore', 'red', 2),
  selectOption('ENRICH_MISS', 'Enrich miss', 'purple', 3),
  selectOption('STUCK_STAGE', 'Stuck stage', 'yellow', 4),
  selectOption('NEEDS_CONNECTION', 'Needs channel connection', 'red', 5),
];

export const OUTREACH_SEND_MODE_OPTIONS = [
  selectOption('AUTO', 'Auto-send', 'green', 0),
  selectOption('APPROVAL', 'Send with approval', 'orange', 1),
];

export const OUTREACH_STATUS_OPTIONS = [
  selectOption('LIVE', 'Live', 'green', 0),
  selectOption('PAUSED', 'Paused', 'orange', 1),
];

export const OUTREACH_EXPERIMENT_VARIANT_OPTIONS = [
  selectOption('A', 'Variant A', 'blue', 0),
  selectOption('B', 'Variant B', 'purple', 1),
];

export const OUTREACH_OUTBOUND_MESSAGE_KIND_OPTIONS = [
  selectOption('CONNECT_NOTE', 'Connection note', 'blue', 0),
  selectOption('OPENER', 'Opener', 'sky', 1),
  selectOption('FU1', 'Follow-up 1', 'turquoise', 2),
  selectOption('FU2', 'Follow-up 2', 'green', 3),
  selectOption('FU3', 'Follow-up 3', 'orange', 4),
  selectOption('EMAIL', 'Email', 'purple', 5),
];

export const OUTREACH_SEQUENCE_STAGE_OPTIONS = [
  selectOption('QUEUED', 'Queued', 'gray', 0),
  selectOption('NEEDS_CONNECTION', 'Needs connection', 'red', 1),
  selectOption('CONNECTION_SENT', 'Connection sent', 'sky', 2),
  selectOption('CONNECTION_ACCEPTED', 'Connection accepted', 'blue', 3),
  selectOption('CONNECTION_IGNORED', 'Connection ignored', 'red', 18),
  selectOption('PROFILE_CHECKED', 'Profile checked', 'turquoise', 4),
  selectOption('WARM_PATH', 'Warm path', 'purple', 5),
  selectOption('COMMENTED', 'Commented', 'orange', 6),
  selectOption('EMAIL_ENRICHING', 'Enriching email', 'yellow', 7),
  selectOption('EMAIL_SENT', 'Email sent', 'blue', 8),
  selectOption('INMAIL_SENT', 'InMail sent', 'sky', 9),
  selectOption('WHATSAPP_SENT', 'WhatsApp sent', 'green', 10),
  selectOption('REPLIED', 'Replied', 'turquoise', 11),
  selectOption('WAITING_REPLY', 'Waiting for reply', 'sky', 19),
  selectOption('NEGOTIATING', 'Negotiating', 'purple', 12),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'green', 13),
  selectOption('DEFERRED', 'Deferred', 'gray', 14),
  selectOption('STOPPED', 'Stopped', 'red', 15),
  selectOption('FAILED_ENRICH', 'Failed enrich', 'red', 16),
  selectOption('FAILED_NO_REPLY', 'Failed no reply', 'red', 17),
];

const CONVERSATION_STAGE_COLORS: Record<string, string> = {
  NONE: 'gray',
  ACKNOWLEDGEMENT: 'sky',
  INTENT: 'turquoise',
  FOLLOW_UP_MEETING: 'orange',
  MEETING_BOOKED: 'green',
  NOT_INTERESTED: 'red',
  SNOOZED: 'gray',
};

export const OUTREACH_CONVERSATION_STAGE_OPTIONS =
  OUTREACH_CONVERSATION_STAGES.map((value, position) =>
    selectOption(
      value,
      OUTREACH_CONVERSATION_STAGE_LABELS[value],
      CONVERSATION_STAGE_COLORS[value] ?? 'gray',
      position,
    ),
  );

export const OUTREACH_ENRICH_STATUS_OPTIONS = [
  selectOption('NOT_STARTED', 'Not started', 'gray', 0),
  selectOption('RUNNING', 'Running', 'sky', 1),
  selectOption('FOUND', 'Found', 'green', 2),
  selectOption('FAILED', 'Failed', 'red', 3),
];

const MESSAGING_CHANNEL_OPTION_COLORS: Record<MessagingChannel, string> = {
  [MessagingChannel.BAILEYS]: 'green',
  [MessagingChannel.WHATSAPP_UNIPILE]: 'green',
  [MessagingChannel.WHATSAPP_WEB]: 'turquoise',
  [MessagingChannel.WHATSAPP_OFFICIAL]: 'blue',
  [MessagingChannel.LINKEDIN_INMAIL]: 'purple',
  [MessagingChannel.LINKEDIN_SOCK]: 'orange',
  [MessagingChannel.LINKEDIN_CONNECT]: 'blue',
  [MessagingChannel.COMMENT]: 'turquoise',
  [MessagingChannel.EMAIL]: 'purple',
};

export const OUTREACH_MESSAGING_CHANNEL_OPTIONS =
  MESSAGING_CHANNEL_SELECT_VALUES.map((value, position) =>
    selectOption(
      value,
      MESSAGING_CHANNEL_LABELS[value],
      MESSAGING_CHANNEL_OPTION_COLORS[value],
      position,
    ),
  );

export const OUTREACH_MEETING_OUTCOME_OPTIONS = [
  selectOption('BOOKED', 'Booked', 'sky', 0),
  selectOption('HELD', 'Held', 'green', 1),
  selectOption('NO_SHOW', 'No show', 'orange', 2),
  selectOption('CANCELED', 'Canceled', 'red', 3),
];

export const getOutreachCommandFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  // Company — account spine rollups
  {
    objectName: 'company',
    field: {
      description: 'Ordered outreach funnel stage for bar charts',
      icon: 'IconFilter',
      label: 'Funnel Stage',
      name: 'outreachFunnelStage',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: OUTREACH_FUNNEL_STAGE_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'ICP segment label for filtering',
      icon: 'IconTags',
      label: 'ICP Segment',
      name: 'icpSegment',
      objectMetadataId: objectsNameIdMap.company,
      type: 'TEXT',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'ICP fit score band',
      icon: 'IconChartBar',
      label: 'ICP Fit',
      name: 'icpFit',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: ICP_FIT_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      // Harvest / command membership. Project.companyId stays the job employer;
      // do not use Company.project or a second relation for this list.
      description:
        'Project ids this company is tagged to (harvest and outreach projects)',
      icon: 'IconKey',
      label: 'Project Ids',
      name: 'projectIds',
      objectMetadataId: objectsNameIdMap.company,
      type: 'ARRAY',
    },
  },
  {
    objectName: 'company',
    field: {
      // Same bag the candidate has: AI filter / enrichment columns write one key
      // per column here, next to aiColumns (header label, type, status).
      description:
        'AI filter and enrichment column values, one key per column',
      icon: 'IconBraces',
      label: 'Other fields',
      name: 'otherFields',
      objectMetadataId: objectsNameIdMap.company,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'LinkedIn company numeric id or Unipile account id',
      icon: 'IconId',
      isUnique: true,
      label: 'LinkedIn Id',
      name: 'linkedinId',
      objectMetadataId: objectsNameIdMap.company,
      type: 'TEXT',
    },
  },
  {
    objectName: 'company',
    field: {
      description:
        'Outreach analytics JSON: timestamps, coverage, channels, and derived metrics',
      icon: 'IconChartDots',
      label: 'Outreach Analytics',
      name: 'outreachAnalytics',
      objectMetadataId: objectsNameIdMap.company,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Why this account needs attention',
      icon: 'IconAlertTriangle',
      label: 'Attention Reason',
      name: 'attentionReason',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: OUTREACH_ATTENTION_REASON_OPTIONS,
    },
  },
  // Candidate — execution spine
  {
    objectName: 'candidate',
    field: {
      description: 'Outreach sequence stage (separate from ATS hiring status)',
      icon: 'IconRoute',
      label: 'Outreach Sequence Stage',
      name: 'outreachSequenceStage',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: OUTREACH_SEQUENCE_STAGE_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Operator conversation outcome (intent, meeting, not interested) separate from sequence cadence',
      icon: 'IconMessage',
      label: 'Outreach Conversation Stage',
      name: 'outreachConversationStage',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: OUTREACH_CONVERSATION_STAGE_OPTIONS,
      defaultValue: "'NONE'",
    },
  },

  {
    objectName: 'candidate',
    field: {
      description: 'Email/phone enrichment status',
      icon: 'IconDatabaseSearch',
      label: 'Enrich Status',
      name: 'enrichStatus',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: OUTREACH_ENRICH_STATUS_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'Channel for pending outbound draft',
      icon: 'IconSend',
      label: 'Pending Channel',
      name: 'pendingChannel',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: OUTREACH_CHANNEL_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'LinkedIn no-reply follow-ups sent (cap 3)',
      icon: 'IconRepeat',
      label: 'LinkedIn Follow-up Count',
      name: 'linkedinFollowUpCount',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Sticky A/B experiment arm assigned at enroll (hash of LinkedIn profile id)',
      icon: 'IconAB',
      label: 'Experiment Variant',
      name: 'experimentVariant',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: OUTREACH_EXPERIMENT_VARIANT_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Outreach analytics JSON: timestamps, speed metrics, message attribution, and deferred resume (resumeAt / stageBeforeDefer)',
      icon: 'IconChartDots',
      label: 'Outreach Analytics',
      name: 'outreachAnalytics',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'RAW_JSON',
    },
  },

  {
    objectName: 'candidate',
    field: {
      description:
        'Workspace member (UUID) who owns this candidate; every send and reply uses that member seat when Pin outreach sender is on',
      icon: 'IconUserCheck',
      label: 'Outreach Sender Member',
      name: 'outreachWorkspaceMemberId',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'When the sender member was pinned',
      icon: 'IconCalendarEvent',
      label: 'Outreach Assigned At',
      name: 'outreachAssignedAt',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'How the sender was chosen: manual, bulk, round_robin, least_loaded, warm, fallback',
      icon: 'IconInfoCircle',
      label: 'Outreach Assignment Reason',
      name: 'outreachAssignmentReason',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Workspace member (UUID) who made the assignment, empty when automatic',
      icon: 'IconUser',
      label: 'Outreach Assigned By',
      name: 'outreachAssignedById',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Warm overlap suggestion awaiting confirmation (workspace member UUID)',
      icon: 'IconBulb',
      label: 'Outreach Suggested Member',
      name: 'outreachSuggestedMemberId',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Warm overlap scores and reasons per member for the suggestion',
      icon: 'IconJson',
      label: 'Outreach Suggestion Reasons',
      name: 'outreachSuggestionReasons',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Step 1 qualify/enrich JSON (go, score, hooks, segment) for connection notes and openers',
      icon: 'IconJson',
      label: 'Outreach Prospect Enrichment',
      name: 'outreachProspectEnrichment',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'RAW_JSON',
    },
  },

  {
    objectName: 'person',
    field: {
      description:
        'Unipile LinkedIn provider id (ACoAA…). Distinct from linkedinLink.',
      icon: 'IconId',
      label: 'LinkedIn Profile Id',
      name: 'linkedinProfileId',
      objectMetadataId: objectsNameIdMap.person,
      type: 'TEXT',
    },
  },
  {
    objectName: 'person',
    field: {
      description:
        'Sales Navigator provider id (ACwAA…) for InMail send and SN inbox webhook match. Distinct from classic linkedinProfileId.',
      icon: 'IconId',
      label: 'Sales Navigator Provider Id',
      name: 'salesNavigatorProviderId',
      objectMetadataId: objectsNameIdMap.person,
      type: 'TEXT',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Global do-not-contact — blocks all outreach projects',
      icon: 'IconBan',
      label: 'Do Not Contact',
      name: 'doNotContact',
      objectMetadataId: objectsNameIdMap.person,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Location Name',
      icon: 'IconLocation',
      label: 'Location Name',
      name: 'locationName',
      objectMetadataId: objectsNameIdMap.person,
      type: 'TEXT',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Job Company Name (denormalized employer string)',
      icon: 'IconBuilding',
      label: 'Job Company Name',
      name: 'jobCompanyName',
      objectMetadataId: objectsNameIdMap.person,
      type: 'TEXT',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Hiring Naukri URL',
      icon: 'IconLink',
      label: 'hiringNaukriUrl',
      name: 'hiringNaukriUrl',
      objectMetadataId: objectsNameIdMap.person,
      type: 'LINKS',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Resdex Naukri URL',
      icon: 'IconLink',
      label: 'resdexNaukriUrl',
      name: 'resdexNaukriUrl',
      objectMetadataId: objectsNameIdMap.person,
      type: 'LINKS',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Cached LinkedIn profile JSON from Unipile (identity cache)',
      icon: 'IconBrandLinkedin',
      label: 'LinkedIn Profile',
      name: 'linkedinProfile',
      objectMetadataId: objectsNameIdMap.person,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'person',
    field: {
      description:
        'Cached LinkedIn posts fetched for this person (normalized posts + mostRecentPost)',
      icon: 'IconNews',
      label: 'LinkedIn Posts',
      name: 'linkedinPosts',
      objectMetadataId: objectsNameIdMap.person,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'person',
    field: {
      description:
        'Sticky preferred outbound channel until the prospect explicitly switches back',
      icon: 'IconArrowsExchange',
      label: 'Outreach Preferred Channel',
      name: 'outreachPreferredChannel',
      objectMetadataId: objectsNameIdMap.person,
      type: 'SELECT',
      options: OUTREACH_PREFERRED_CHANNEL_OPTIONS,
    },
  },

  // Project — light run scope
  {
    objectName: 'project',
    field: {
      description: 'Pinned outreach Workflow B id for Outreach',
      icon: 'IconGitBranch',
      label: 'Outreach Workflow Id',
      name: 'outreachWorkflowId',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Auto-send vs human approval before outbound',
      icon: 'IconUserCheck',
      label: 'Outreach Send Mode',
      name: 'outreachSendMode',
      objectMetadataId: objectsNameIdMap.project,
      type: 'SELECT',
      options: OUTREACH_SEND_MODE_OPTIONS,
    },
  },
  {
    objectName: 'project',
    field: {
      description:
        'Whether outbound outreach is live or paused for this project',
      icon: 'IconPlayerPause',
      label: 'Outreach Status',
      name: 'outreachStatus',
      objectMetadataId: objectsNameIdMap.project,
      type: 'SELECT',
      options: OUTREACH_STATUS_OPTIONS,
      defaultValue: "'LIVE'",
    },
  },
  {
    objectName: 'project',
    field: {
      description:
        'Outreach project config JSON: send window, ICP override, personas cap, experiments',
      icon: 'IconSettingsAutomation',
      label: 'Outreach Config',
      name: 'outreachConfig',
      objectMetadataId: objectsNameIdMap.project,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'project',
    field: {
      description:
        'People and companies table column width, order, and visibility for Outreach',
      icon: 'IconTable',
      label: 'Outreach Table Layout',
      name: 'outreachTableLayout',
      objectMetadataId: objectsNameIdMap.project,
      type: 'RAW_JSON',
    },
  },

  // Opportunity — outreach attribution
  {
    objectName: 'opportunity',
    field: {
      description: 'Opportunity created from outreach',
      icon: 'IconTargetArrow',
      label: 'Sourced From Outreach',
      name: 'sourcedFromOutreach',
      objectMetadataId: objectsNameIdMap.opportunity,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'opportunity',
    field: {
      description: 'Project id for outcomes filtering',
      icon: 'IconKey',
      label: 'Project Id',
      name: 'projectId',
      objectMetadataId: objectsNameIdMap.opportunity,
      type: 'TEXT',
    },
  },

  // Message object (chatMessage)
  {
    objectName: 'chatMessage',
    field: {
      description:
        'Channel for this transcript row (one row per candidate × channel)',
      icon: 'IconMessage',
      label: 'Channel',
      name: 'channel',
      objectMetadataId: objectsNameIdMap.chatMessage,
      type: 'SELECT',
      options: OUTREACH_MESSAGE_CHANNEL_OPTIONS,
    },
  },
  {
    objectName: 'chatMessage',
    field: {
      description: 'Provider chat id (Unipile chat id, WhatsApp thread, etc.)',
      icon: 'IconHash',
      label: 'External Chat Id',
      name: 'externalChatId',
      objectMetadataId: objectsNameIdMap.chatMessage,
      type: 'TEXT',
    },
  },

  // CalendarEvent — outreach meeting attribution
  {
    objectName: 'calendarEvent',
    field: {
      description: 'Meeting created from outreach',
      icon: 'IconTargetArrow',
      label: 'Outreach Sourced',
      name: 'outreachSourced',
      objectMetadataId: objectsNameIdMap.calendarEvent,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'calendarEvent',
    field: {
      description: 'Outreach meeting outcome',
      icon: 'IconCalendarCheck',
      label: 'Meeting Outcome',
      name: 'meetingOutcome',
      objectMetadataId: objectsNameIdMap.calendarEvent,
      type: 'SELECT',
      options: OUTREACH_MEETING_OUTCOME_OPTIONS,
    },
  },

  // Decision — one pending FORM step
  {
    objectName: 'decision',
    field: {
      description: 'Sentence shown on Today',
      icon: 'IconAbc',
      label: 'Title',
      name: 'title',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'What the user should do',
      icon: 'IconBulb',
      label: 'Recommendation',
      name: 'recommendation',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Workflow step name that opened this approval',
      icon: 'IconInfoCircle',
      label: 'Reason',
      name: 'reason',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Which kind of approval this FORM step is',
      icon: 'IconCategory',
      label: 'Kind',
      name: 'kind',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'SELECT',
      options: [
        selectOption('CONNECTION_NOTE', 'Connection note', 'blue', 0),
        selectOption('COMMENT_DRAFT', 'Comment draft', 'turquoise', 1),
        selectOption('MESSAGE_DRAFT', 'Message draft', 'sky', 2),
        selectOption('REPLY_DRAFT', 'Reply draft', 'orange', 3),
        selectOption('MEETING_ACTION', 'Meeting action', 'green', 4),
      ],
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Needs you now, or a batch approval',
      icon: 'IconFlag',
      label: 'Urgency',
      name: 'urgency',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'SELECT',
      options: [
        selectOption('NOW', 'Now', 'red', 0),
        selectOption('APPROVE', 'Approve', 'orange', 1),
      ],
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Whether the approval is still waiting',
      icon: 'IconCircleDot',
      label: 'Status',
      name: 'status',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'SELECT',
      options: [
        selectOption('OPEN', 'Open', 'orange', 0),
        selectOption('DONE', 'Done', 'green', 1),
        selectOption('DISMISSED', 'Dismissed', 'gray', 2),
        selectOption('CANCELLED', 'Cancelled', 'red', 3),
      ],
      defaultValue: "'OPEN'",
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'How the open approval was closed',
      icon: 'IconCheck',
      label: 'Resolution',
      name: 'resolution',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'SELECT',
      options: [
        selectOption('APPROVED', 'Approved', 'green', 0),
        selectOption('EDITED', 'Edited', 'blue', 1),
        selectOption('REJECTED', 'Rejected', 'red', 2),
      ],
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Idempotency key workflowRunId:stepId',
      icon: 'IconKey',
      isUnique: true,
      label: 'Source Key',
      name: 'sourceKey',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Pending FORM step id on the workflow run',
      icon: 'IconHash',
      label: 'Step Id',
      name: 'stepId',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Draft body shown for approval',
      icon: 'IconNotes',
      label: 'Draft Body',
      name: 'draftBody',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
  {
    objectName: 'decision',
    field: {
      description: 'Body the user sent, when it differed from the draft',
      icon: 'IconPencil',
      label: 'Edited Body',
      name: 'editedBody',
      objectMetadataId: objectsNameIdMap.decision,
      type: 'TEXT',
    },
  },
];
