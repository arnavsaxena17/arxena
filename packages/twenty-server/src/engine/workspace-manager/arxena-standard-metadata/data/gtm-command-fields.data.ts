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

export const GTM_FUNNEL_STAGE_OPTIONS = [
  selectOption('ADDED', 'Added', 'gray', 0),
  selectOption('REACHED', 'Reached', 'sky', 1),
  selectOption('COVERED', 'Covered', 'blue', 2),
  selectOption('REPLIED', 'Replied', 'turquoise', 3),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'green', 4),
  selectOption('MEETING_HELD', 'Meeting held', 'purple', 5),
  selectOption('OPPORTUNITY', 'Opportunity', 'orange', 6),
];

export const GTM_MESSAGE_CHANNEL_OPTIONS = [
  selectOption('WHATSAPP', 'WhatsApp', 'green', 0),
  selectOption('LINKEDIN', 'LinkedIn', 'blue', 1),
  selectOption('EMAIL', 'Email', 'sky', 2),
];

export const GTM_ICP_FIT_OPTIONS = [
  selectOption('HIGH', 'High', 'green', 0),
  selectOption('MEDIUM', 'Medium', 'orange', 1),
  selectOption('LOW', 'Low', 'red', 2),
];

export const GTM_COVERAGE_BUCKET_OPTIONS = [
  selectOption('ZERO', '0 people', 'red', 0),
  selectOption('ONE_TWO', '1–2 people', 'orange', 1),
  selectOption('THREE_PLUS', '3+ people', 'green', 2),
];

export const GTM_CHANNEL_OPTIONS = [
  selectOption('LINKEDIN_CONNECT', 'LinkedIn connect', 'blue', 0),
  selectOption('INMAIL', 'InMail', 'sky', 1),
  selectOption('COMMENT', 'Comment', 'turquoise', 2),
  selectOption('EMAIL', 'Email', 'purple', 3),
  selectOption('WHATSAPP', 'WhatsApp', 'green', 4),
  selectOption('OTHER', 'Other', 'gray', 5),
];

export const GTM_TIME_BUCKET_OPTIONS = [
  selectOption('UNDER_1D', '<1d', 'green', 0),
  selectOption('D1_3', '1–3d', 'turquoise', 1),
  selectOption('D3_7', '3–7d', 'blue', 2),
  selectOption('D7_14', '7–14d', 'orange', 3),
  selectOption('OVER_14D', '14d+', 'red', 4),
];

export const GTM_ATTENTION_REASON_OPTIONS = [
  selectOption('NONE', 'None', 'green', 0),
  selectOption('NO_REPLY', 'No reply', 'orange', 1),
  selectOption('CONNECT_IGNORE', 'Connect ignore', 'red', 2),
  selectOption('ENRICH_MISS', 'Enrich miss', 'purple', 3),
  selectOption('STUCK_STAGE', 'Stuck stage', 'yellow', 4),
  selectOption('NEEDS_CONNECTION', 'Needs channel connection', 'red', 5),
];

export const GTM_OUTREACH_SEND_MODE_OPTIONS = [
  selectOption('AUTO', 'Auto-send', 'green', 0),
  selectOption('APPROVAL', 'Send with approval', 'orange', 1),
];

export const GTM_OUTREACH_SEQUENCE_STAGE_OPTIONS = [
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
  selectOption('NEGOTIATING', 'Negotiating', 'purple', 12),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'green', 13),
  selectOption('DEFERRED', 'Deferred', 'gray', 14),
  selectOption('STOPPED', 'Stopped', 'red', 15),
  selectOption('FAILED_ENRICH', 'Failed enrich', 'red', 16),
  selectOption('FAILED_NO_REPLY', 'Failed no reply', 'red', 17),
];

export const GTM_ENRICH_STATUS_OPTIONS = [
  selectOption('NOT_STARTED', 'Not started', 'gray', 0),
  selectOption('RUNNING', 'Running', 'sky', 1),
  selectOption('FOUND', 'Found', 'green', 2),
  selectOption('FAILED', 'Failed', 'red', 3),
];

export const GTM_MESSAGING_CHANNEL_OPTIONS = [
  selectOption('BAILEYS', 'Baileys', 'green', 0),
  selectOption('WHATSAPP_UNIPILE', 'WhatsApp Unipile', 'green', 1),
  selectOption('WHATSAPP_WEB', 'WhatsApp Web', 'turquoise', 2),
  selectOption('WHATSAPP_OFFICIAL', 'WhatsApp Official', 'blue', 3),
  selectOption('LINKEDIN', 'LinkedIn', 'sky', 4),
  selectOption('LINKEDIN_PREMIUM', 'LinkedIn Premium', 'blue', 5),
  selectOption('LINKEDIN_INMAIL', 'LinkedIn InMail', 'purple', 6),
  selectOption('LINKEDIN_SOCK', 'LinkedIn Sock', 'orange', 7),
  selectOption('LINKEDIN_CONNECT', 'LinkedIn Connect', 'blue', 8),
  selectOption('COMMENT', 'Comment', 'turquoise', 9),
  selectOption('EMAIL', 'Email', 'purple', 10),
];

export const GTM_MEETING_OUTCOME_OPTIONS = [
  selectOption('BOOKED', 'Booked', 'sky', 0),
  selectOption('HELD', 'Held', 'green', 1),
  selectOption('NO_SHOW', 'No show', 'orange', 2),
  selectOption('CANCELED', 'Canceled', 'red', 3),
];

export const getGtmCommandFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  // Company — account spine rollups
  {
    objectName: 'company',
    field: {
      description: 'Ordered GTM funnel stage for bar charts',
      icon: 'IconFilter',
      label: 'GTM Funnel Stage',
      name: 'gtmFunnelStage',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_FUNNEL_STAGE_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'ICP segment label for GTM filtering',
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
      options: GTM_ICP_FIT_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      // Harvest / command membership. Project.companyId stays the job employer;
      // do not use Company.project or a second GTM relation for this list.
      description:
        'GTM Project ids this company is tagged to (harvest and command runs)',
      icon: 'IconKey',
      label: 'GTM Run Key',
      name: 'gtmRunKey',
      objectMetadataId: objectsNameIdMap.company,
      type: 'ARRAY',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'LinkedIn company numeric id or Unipile account id',
      icon: 'IconId',
      label: 'LinkedIn Id',
      name: 'linkedinId',
      objectMetadataId: objectsNameIdMap.company,
      type: 'TEXT',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'ICP people targeted on this account',
      icon: 'IconUsers',
      label: 'People Targeted',
      name: 'peopleTargeted',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'People with at least one outbound touch',
      icon: 'IconUserCheck',
      label: 'People Reached',
      name: 'peopleReached',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Coverage bucket for account coverage charts',
      icon: 'IconChartPie',
      label: 'Coverage Bucket',
      name: 'coverageBucket',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_COVERAGE_BUCKET_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Channels used against this account',
      icon: 'IconMessage',
      label: 'Channels Used',
      name: 'channelsUsed',
      objectMetadataId: objectsNameIdMap.company,
      type: 'MULTI_SELECT',
      options: GTM_CHANNEL_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'First outbound contact timestamp',
      icon: 'IconClock',
      label: 'First Contact At',
      name: 'firstContactAt',
      objectMetadataId: objectsNameIdMap.company,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'First inbound reply timestamp',
      icon: 'IconMessageReply',
      label: 'First Reply At',
      name: 'firstReplyAt',
      objectMetadataId: objectsNameIdMap.company,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Meeting invite created from outreach',
      icon: 'IconCalendarPlus',
      label: 'Meeting Booked At',
      name: 'meetingBookedAt',
      objectMetadataId: objectsNameIdMap.company,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Meeting marked held / completed',
      icon: 'IconCalendarCheck',
      label: 'Meeting Held At',
      name: 'meetingHeldAt',
      objectMetadataId: objectsNameIdMap.company,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Days from company added to first contact',
      icon: 'IconHourglass',
      label: 'Days To First Contact',
      name: 'daysToFirstContact',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Days from company added to meeting booked',
      icon: 'IconHourglassHigh',
      label: 'Days To Meeting Booked',
      name: 'daysToMeetingBooked',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Time-to-first-contact histogram bucket',
      icon: 'IconChartBar',
      label: 'Time To First Contact Bucket',
      name: 'timeToFirstContactBucket',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_TIME_BUCKET_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Time-to-meeting histogram bucket',
      icon: 'IconChartBar',
      label: 'Time To Meeting Bucket',
      name: 'timeToMeetingBucket',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_TIME_BUCKET_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Channel of first outbound touch',
      icon: 'IconSend',
      label: 'First Contact Channel',
      name: 'firstContactChannel',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_CHANNEL_OPTIONS,
    },
  },
  {
    objectName: 'company',
    field: {
      description: 'Coverage score 0–100',
      icon: 'IconPercentage',
      label: 'Coverage Score',
      name: 'coverageScore',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
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
      options: GTM_ATTENTION_REASON_OPTIONS,
    },
  },
  // Candidate — execution spine
  {
    objectName: 'candidate',
    field: {
      description:
        'GTM outreach sequence stage (separate from ATS hiring status)',
      icon: 'IconRoute',
      label: 'Outreach Sequence Stage',
      name: 'outreachSequenceStage',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: GTM_OUTREACH_SEQUENCE_STAGE_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description:
        'Unipile LinkedIn provider id (ACoAA…) for SEND_*. Distinct from linkedinUrl.',
      icon: 'IconId',
      label: 'LinkedIn Profile Id',
      name: 'linkedinProfileId',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
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
      options: GTM_ENRICH_STATUS_OPTIONS,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'Last outbound touch timestamp',
      icon: 'IconSend',
      label: 'Last Outbound At',
      name: 'lastOutboundAt',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'Last inbound reply timestamp',
      icon: 'IconMessageReply',
      label: 'Last Inbound At',
      name: 'lastInboundAt',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'First outbound touch timestamp',
      icon: 'IconPlayerPlay',
      label: 'First Outbound At',
      name: 'firstOutboundAt',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'DATE_TIME',
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
      options: GTM_CHANNEL_OPTIONS,
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
  // Person — cross-project memory / compliance
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
      description: 'Global do-not-contact — blocks all GTM projects',
      icon: 'IconBan',
      label: 'Do Not Contact',
      name: 'doNotContact',
      objectMetadataId: objectsNameIdMap.person,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },

  // Project — light run scope
  {
    objectName: 'project',
    field: {
      description: 'Pinned outreach Workflow B id for GTM Command',
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
      options: GTM_OUTREACH_SEND_MODE_OPTIONS,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Max ICP personas to enroll per company',
      icon: 'IconUsersGroup',
      label: 'Max Personas Per Company',
      name: 'maxPersonasPerCompany',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 2,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Optional run override ICP JSON (buyerTitles and locations)',
      icon: 'IconJson',
      label: 'ICP Spec',
      name: 'icpSpec',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  // {
  //   objectName: 'project',
  //   field: {
  //     description: 'Compliance copy injected into LLM outreach prompts',
  //     icon: 'IconScale',
  //     label: 'Compliance Copy',
  //     name: 'complianceCopy',
  //     objectMetadataId: objectsNameIdMap.project,
  //     type: 'TEXT',
  //   },
  // },

  // Opportunity — GTM attribution
  {
    objectName: 'opportunity',
    field: {
      description: 'Opportunity created from GTM outreach',
      icon: 'IconTargetArrow',
      label: 'Sourced From GTM',
      name: 'sourcedFromGtm',
      objectMetadataId: objectsNameIdMap.opportunity,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'opportunity',
    field: {
      description: 'GTM run key for outcomes filtering',
      icon: 'IconKey',
      label: 'GTM Run Key',
      name: 'gtmRunKey',
      objectMetadataId: objectsNameIdMap.opportunity,
      type: 'TEXT',
    },
  },

  // Message object (chatMessage)
  {
    objectName: 'chatMessage',
    field: {
      description: 'Channel for this transcript row (one row per candidate × channel)',
      icon: 'IconMessage',
      label: 'Channel',
      name: 'channel',
      objectMetadataId: objectsNameIdMap.chatMessage,
      type: 'SELECT',
      options: GTM_MESSAGE_CHANNEL_OPTIONS,
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

  // CalendarEvent — GTM meeting attribution
  {
    objectName: 'calendarEvent',
    field: {
      description: 'Meeting created from GTM outreach',
      icon: 'IconTargetArrow',
      label: 'GTM Sourced',
      name: 'gtmSourced',
      objectMetadataId: objectsNameIdMap.calendarEvent,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'calendarEvent',
    field: {
      description: 'GTM meeting outcome',
      icon: 'IconCalendarCheck',
      label: 'Meeting Outcome',
      name: 'meetingOutcome',
      objectMetadataId: objectsNameIdMap.calendarEvent,
      type: 'SELECT',
      options: GTM_MEETING_OUTCOME_OPTIONS,
    },
  },
];
