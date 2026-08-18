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

export const GTM_STATUS_OPTIONS = [
  selectOption('WATCH', 'Watch', 'gray', 0),
  selectOption('RESEARCHING', 'Researching', 'sky', 1),
  selectOption('TARGET', 'Target', 'blue', 2),
  selectOption('REACHED', 'Reached', 'turquoise', 3),
  selectOption('COVERED', 'Covered', 'green', 4),
  selectOption('REPLIED', 'Replied', 'purple', 5),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'orange', 6),
  selectOption('MEETING_HELD', 'Meeting held', 'yellow', 7),
  selectOption('OPPORTUNITY', 'Opportunity', 'red', 8),
  selectOption('DISQUALIFIED', 'Disqualified', 'gray', 9),
];

export const GTM_FUNNEL_STAGE_OPTIONS = [
  selectOption('ADDED', 'Added', 'gray', 0),
  selectOption('REACHED', 'Reached', 'sky', 1),
  selectOption('COVERED', 'Covered', 'blue', 2),
  selectOption('REPLIED', 'Replied', 'turquoise', 3),
  selectOption('MEETING_BOOKED', 'Meeting booked', 'green', 4),
  selectOption('MEETING_HELD', 'Meeting held', 'purple', 5),
  selectOption('OPPORTUNITY', 'Opportunity', 'orange', 6),
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

export const GTM_CONNECTION_STATUS_OPTIONS = [
  selectOption('NONE', 'None', 'gray', 0),
  selectOption('SENT', 'Sent', 'sky', 1),
  selectOption('ACCEPTED', 'Accepted', 'green', 2),
  selectOption('IGNORED', 'Ignored', 'red', 3),
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
      description: 'GTM account status for command dashboard',
      icon: 'IconTargetArrow',
      label: 'GTM Status',
      name: 'gtmStatus',
      objectMetadataId: objectsNameIdMap.company,
      type: 'SELECT',
      options: GTM_STATUS_OPTIONS,
    },
  },
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
      // Multi-run scope tag (= Project.id). Not a CRM relation — Project.companyId
      // is only the project's primary company, not the GTM target list.
      description:
        'GTM run scope; set to the owning Project id (legacy slug still accepted)',
      icon: 'IconKey',
      label: 'GTM Run Key',
      name: 'gtmRunKey',
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
  {
    objectName: 'company',
    field: {
      description: 'Days since last outbound or inbound touch',
      icon: 'IconCalendarDue',
      label: 'Days Since Last Touch',
      name: 'daysSinceLastTouch',
      objectMetadataId: objectsNameIdMap.company,
      type: 'NUMBER',
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
      description: 'Unipile LinkedIn provider / public identifier for SEND_*',
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
      description: 'Which Projective Tech follow-up was last sent (0–5)',
      icon: 'IconListNumbers',
      label: 'Follow Up Index',
      name: 'followUpIndex',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'Cached Unipile LinkedIn profile JSON for AI draft',
      icon: 'IconBrandLinkedin',
      label: 'LinkedIn Profile Snapshot',
      name: 'linkedinProfileSnapshot',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'LinkedIn connection request status',
      icon: 'IconUserPlus',
      label: 'Connection Status',
      name: 'connectionStatus',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'SELECT',
      options: GTM_CONNECTION_STATUS_OPTIONS,
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
      description: 'When enrichment completed or last attempted',
      icon: 'IconClock',
      label: 'Enriched At',
      name: 'enrichedAt',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'DATE_TIME',
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
      description: 'Draft body waiting for approval or auto-send',
      icon: 'IconMessage',
      label: 'Pending Message Body',
      name: 'pendingMessageBody',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
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
      description: 'Why outreach stopped for this candidate run',
      icon: 'IconHandStop',
      label: 'Stopped Reason',
      name: 'stoppedReason',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'Priority score vs other ICP personas at the same company',
      icon: 'IconSortDescending',
      label: 'Persona Priority Score',
      name: 'personaPriorityScore',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'LinkedIn connection degree copied from Person at enroll',
      icon: 'IconTopologyStar',
      label: 'Connection Degree',
      name: 'connectionDegree',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'candidate',
    field: {
      description: 'GTM run key shared with Project for filters',
      icon: 'IconKey',
      label: 'GTM Run Key',
      name: 'gtmRunKey',
      objectMetadataId: objectsNameIdMap.candidate,
      type: 'TEXT',
    },
  },

  // Person — cross-project memory / compliance
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
  {
    objectName: 'person',
    field: {
      description: 'When the person unsubscribed from outreach',
      icon: 'IconMailOff',
      label: 'Unsubscribed At',
      name: 'unsubscribedAt',
      objectMetadataId: objectsNameIdMap.person,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'When the person said not interested',
      icon: 'IconThumbDown',
      label: 'Not Interested At',
      name: 'notInterestedAt',
      objectMetadataId: objectsNameIdMap.person,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Email bounce count across runs',
      icon: 'IconMailX',
      label: 'Bounce Count',
      name: 'bounceCount',
      objectMetadataId: objectsNameIdMap.person,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Out-of-office until this timestamp',
      icon: 'IconBeach',
      label: 'OOO Until',
      name: 'oooUntil',
      objectMetadataId: objectsNameIdMap.person,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'person',
    field: {
      description: 'Cached LinkedIn connection degree (1 / 2 / 3)',
      icon: 'IconTopologyStar',
      label: 'LinkedIn Connection Degree',
      name: 'linkedinConnectionDegree',
      objectMetadataId: objectsNameIdMap.person,
      type: 'NUMBER',
    },
  },

  // Project — light run scope
  {
    objectName: 'project',
    field: {
      description: 'GTM run key for dashboard filters',
      icon: 'IconKey',
      label: 'GTM Run Key',
      name: 'gtmRunKey',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'ICP segment for this GTM/recruiting run',
      icon: 'IconTags',
      label: 'ICP Segment',
      name: 'icpSegment',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
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
      description: 'Use InMail when LinkedIn connect is ignored',
      icon: 'IconMailForward',
      label: 'InMail Fallback Enabled',
      name: 'inMailFallbackEnabled',
      objectMetadataId: objectsNameIdMap.project,
      type: 'BOOLEAN',
      defaultValue: false,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'IANA timezone for send windows',
      icon: 'IconWorld',
      label: 'Send Timezone',
      name: 'sendTimezone',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Send window start HH:mm in sendTimezone',
      icon: 'IconClockHour4',
      label: 'Send Window Start',
      name: 'sendWindowStart',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Send window end HH:mm in sendTimezone',
      icon: 'IconClockHour9',
      label: 'Send Window End',
      name: 'sendWindowEnd',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Daily LinkedIn connection request cap',
      icon: 'IconUserPlus',
      label: 'Max Connects Per Day',
      name: 'maxConnectsPerDay',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 25,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Daily LinkedIn comment cap',
      icon: 'IconMessageCircle',
      label: 'Max Comments Per Day',
      name: 'maxCommentsPerDay',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 20,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Daily outbound email cap',
      icon: 'IconMail',
      label: 'Max Emails Per Day',
      name: 'maxEmailsPerDay',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 50,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Weekly LinkedIn connection request cap',
      icon: 'IconUserPlus',
      label: 'Max Connects Per Week',
      name: 'maxConnectsPerWeek',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 100,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Connects sent this ISO week (throttle counter)',
      icon: 'IconCounter',
      label: 'LinkedIn Connects This Week',
      name: 'linkedinConnectsThisWeek',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'When the weekly LinkedIn connect counter started',
      icon: 'IconCalendarWeek',
      label: 'LinkedIn Connects Week Started At',
      name: 'linkedinConnectsWeekStartedAt',
      objectMetadataId: objectsNameIdMap.project,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Minimum minutes between LinkedIn connection requests on a seat',
      icon: 'IconClockHour4',
      label: 'Min Connect Gap Minutes',
      name: 'minConnectGapMinutes',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 60,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Minimum minutes between LinkedIn DMs / InMails on a seat',
      icon: 'IconClockHour3',
      label: 'Min Message Gap Minutes',
      name: 'minMessageGapMinutes',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 15,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Connects sent today (throttle counter)',
      icon: 'IconCounter',
      label: 'LinkedIn Connects Today',
      name: 'linkedinConnectsToday',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Comments posted today (throttle counter)',
      icon: 'IconCounter',
      label: 'Comments Today',
      name: 'commentsToday',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Emails sent today (throttle counter)',
      icon: 'IconCounter',
      label: 'Emails Today',
      name: 'emailsToday',
      objectMetadataId: objectsNameIdMap.project,
      type: 'NUMBER',
      defaultValue: 0,
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Approved ICP JSON (std_function / std_grade targets)',
      icon: 'IconJson',
      label: 'ICP Spec',
      name: 'icpSpec',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description: 'Compliance copy injected into LLM outreach prompts',
      icon: 'IconScale',
      label: 'Compliance Copy',
      name: 'complianceCopy',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },

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
