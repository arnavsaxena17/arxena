import {
  computeDeterministicUuid,
  getFieldUniversalIdentifier,
  getObjectUniversalIdentifier,
  getPageLayoutTabUniversalIdentifier,
  getPageLayoutUniversalIdentifier,
  getPageLayoutWidgetUniversalIdentifier,
  type PageLayoutManifest,
  type PageLayoutTabManifest,
  type PageLayoutWidgetManifest,
} from 'twenty-shared/application';
import { CalendarStartDay } from 'twenty-shared/constants';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  AggregateOperations,
  ObjectRecordGroupByDateGranularity,
  PageLayoutTabLayoutMode,
  type PageLayoutWidgetUniversalConfiguration,
  type UniversalChartFilter,
} from 'twenty-shared/types';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';

export const OUTREACH_DASHBOARD_TITLE = 'Outreach';

export const OUTREACH_DASHBOARD_ID = 'c4e8b7a1-9d2f-4c6e-8b3a-1f0d5e7c9a24';

const APP = ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER;

const COMPANY = STANDARD_OBJECTS.company.universalIdentifier;
const OPPORTUNITY = STANDARD_OBJECTS.opportunity.universalIdentifier;

const CANDIDATE = getObjectUniversalIdentifier({
  applicationUniversalIdentifier: APP,
  nameSingular: 'candidate',
});

const CHAT_MESSAGE = getObjectUniversalIdentifier({
  applicationUniversalIdentifier: APP,
  nameSingular: 'whatsappMessage',
});

const arxenaField = (objectUniversalIdentifier: string, name: string) =>
  getFieldUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    objectUniversalIdentifier,
    name,
  });

const FIELDS = {
  companyId: STANDARD_OBJECTS.company.fields.id.universalIdentifier,
  companyCreatedAt: STANDARD_OBJECTS.company.fields.createdAt.universalIdentifier,
  projectIds: arxenaField(COMPANY, 'projectIds'),
  outreachFunnelStage: arxenaField(COMPANY, 'outreachFunnelStage'),
  peopleTargeted: arxenaField(COMPANY, 'peopleTargeted'),
  peopleReached: arxenaField(COMPANY, 'peopleReached'),
  coverageBucket: arxenaField(COMPANY, 'coverageBucket'),
  firstContactAt: arxenaField(COMPANY, 'firstContactAt'),
  firstContactChannel: arxenaField(COMPANY, 'firstContactChannel'),
  timeToFirstContactBucket: arxenaField(COMPANY, 'timeToFirstContactBucket'),
  timeToMeetingBucket: arxenaField(COMPANY, 'timeToMeetingBucket'),
  daysToFirstContact: arxenaField(COMPANY, 'daysToFirstContact'),
  daysToMeetingBooked: arxenaField(COMPANY, 'daysToMeetingBooked'),
  meetingBookedAt: arxenaField(COMPANY, 'meetingBookedAt'),
  meetingHeldAt: arxenaField(COMPANY, 'meetingHeldAt'),
  candidateId: arxenaField(CANDIDATE, 'id'),
  outreachSequenceStage: arxenaField(CANDIDATE, 'outreachSequenceStage'),
  firstOutboundAt: arxenaField(CANDIDATE, 'firstOutboundAt'),
  enrichStatus: arxenaField(CANDIDATE, 'enrichStatus'),
  candConversationStatus: arxenaField(CANDIDATE, 'candConversationStatus'),
  messagingChannel: arxenaField(CANDIDATE, 'messagingChannel'),
  linkedinFollowUpCount: arxenaField(CANDIDATE, 'linkedinFollowUpCount'),
  experimentVariant: arxenaField(CANDIDATE, 'experimentVariant'),
  convertedOnMessageKind: arxenaField(CANDIDATE, 'convertedOnMessageKind'),
  lastOutboundMessageKind: arxenaField(CANDIDATE, 'lastOutboundMessageKind'),
  candidateTimeToFirstContactBucket: arxenaField(
    CANDIDATE,
    'timeToFirstContactBucket',
  ),
  candidateTimeToMeetingBucket: arxenaField(CANDIDATE, 'timeToMeetingBucket'),
  candidateDaysToFirstContact: arxenaField(CANDIDATE, 'daysToFirstContact'),
  candidateDaysToMeetingBooked: arxenaField(CANDIDATE, 'daysToMeetingBooked'),
  candidateDaysFromConnectionToAccept: arxenaField(
    CANDIDATE,
    'daysFromConnectionToAccept',
  ),
  candidateDaysFromConnectionToMeeting: arxenaField(
    CANDIDATE,
    'daysFromConnectionToMeeting',
  ),
  opportunityId: STANDARD_OBJECTS.opportunity.fields.id.universalIdentifier,
  sourcedFromOutreach: arxenaField(OPPORTUNITY, 'sourcedFromOutreach'),
  chatMessageId: arxenaField(CHAT_MESSAGE, 'id'),
  chatMessageCreatedAt: arxenaField(CHAT_MESSAGE, 'createdAt'),
};

type GridPosition = {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
};

const grid = (
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
): GridPosition => ({ row, column, rowSpan, columnSpan });

const chartBase = {
  timezone: 'UTC',
  firstDayOfTheWeek: CalendarStartDay.SUNDAY,
  displayDataLabel: false,
} as const;

const selectIsFilter = ({
  widgetTitle,
  fieldMetadataUniversalIdentifier,
  values,
}: {
  widgetTitle: string;
  fieldMetadataUniversalIdentifier: string;
  values: string[];
}): UniversalChartFilter => {
  const groupId = computeDeterministicUuid({
    entityNamespace: 'pageLayoutWidget',
    value: `gtmCommandDashboard:filterGroup:${widgetTitle}`,
    applicationUniversalIdentifier: APP,
  });

  return {
    recordFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
    recordFilters: [
      {
        fieldMetadataUniversalIdentifier,
        operand: 'IS',
        value: JSON.stringify(values),
        recordFilterGroupId: groupId,
      },
    ],
  };
};

const booleanIsTrueFilter = ({
  widgetTitle,
  fieldMetadataUniversalIdentifier,
}: {
  widgetTitle: string;
  fieldMetadataUniversalIdentifier: string;
}): UniversalChartFilter => {
  const groupId = computeDeterministicUuid({
    entityNamespace: 'pageLayoutWidget',
    value: `gtmCommandDashboard:filterGroup:${widgetTitle}`,
    applicationUniversalIdentifier: APP,
  });

  return {
    recordFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
    recordFilters: [
      {
        fieldMetadataUniversalIdentifier,
        operand: 'IS',
        value: 'true',
        recordFilterGroupId: groupId,
      },
    ],
  };
};

const isNotEmptyFilter = ({
  widgetTitle,
  fieldMetadataUniversalIdentifier,
}: {
  widgetTitle: string;
  fieldMetadataUniversalIdentifier: string;
}): UniversalChartFilter => {
  const groupId = computeDeterministicUuid({
    entityNamespace: 'pageLayoutWidget',
    value: `gtmCommandDashboard:filterGroup:${widgetTitle}`,
    applicationUniversalIdentifier: APP,
  });

  return {
    recordFilterGroups: [{ id: groupId, logicalOperator: 'AND' }],
    recordFilters: [
      {
        fieldMetadataUniversalIdentifier,
        operand: 'IS_NOT_EMPTY',
        value: '',
        recordFilterGroupId: groupId,
      },
    ],
  };
};

const widget = ({
  tabUniversalIdentifier,
  title,
  objectUniversalIdentifier,
  gridPosition,
  configuration,
}: {
  tabUniversalIdentifier: string;
  title: string;
  objectUniversalIdentifier: string;
  gridPosition: GridPosition;
  configuration: PageLayoutWidgetUniversalConfiguration;
}): PageLayoutWidgetManifest => ({
  universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    pageLayoutTabUniversalIdentifier: tabUniversalIdentifier,
    title,
  }),
  title,
  type: 'GRAPH',
  objectUniversalIdentifier,
  gridPosition,
  configuration,
});

const aggregate = ({
  tabUniversalIdentifier,
  title,
  objectUniversalIdentifier,
  aggregateFieldMetadataUniversalIdentifier,
  gridPosition,
  aggregateOperation = AggregateOperations.COUNT,
  filter,
}: {
  tabUniversalIdentifier: string;
  title: string;
  objectUniversalIdentifier: string;
  aggregateFieldMetadataUniversalIdentifier: string;
  gridPosition: GridPosition;
  aggregateOperation?: AggregateOperations;
  filter?: UniversalChartFilter;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    objectUniversalIdentifier,
    gridPosition,
    configuration: {
      configurationType: 'AGGREGATE_CHART',
      aggregateFieldMetadataUniversalIdentifier,
      aggregateOperation,
      ...chartBase,
      prefix: '',
      ...(filter ? { filter } : {}),
    },
  });

const bar = ({
  tabUniversalIdentifier,
  title,
  objectUniversalIdentifier,
  aggregateFieldMetadataUniversalIdentifier,
  primaryAxisGroupByFieldMetadataUniversalIdentifier,
  gridPosition,
  layout = 'HORIZONTAL',
  color = 'blue',
  aggregateOperation = AggregateOperations.COUNT,
}: {
  tabUniversalIdentifier: string;
  title: string;
  objectUniversalIdentifier: string;
  aggregateFieldMetadataUniversalIdentifier: string;
  primaryAxisGroupByFieldMetadataUniversalIdentifier: string;
  gridPosition: GridPosition;
  layout?: 'HORIZONTAL' | 'VERTICAL';
  color?: string;
  aggregateOperation?: AggregateOperations;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    objectUniversalIdentifier,
    gridPosition,
    configuration: {
      configurationType: 'BAR_CHART',
      aggregateFieldMetadataUniversalIdentifier,
      aggregateOperation,
      primaryAxisGroupByFieldMetadataUniversalIdentifier,
      primaryAxisOrderBy: 'FIELD_POSITION_ASC',
      axisNameDisplay: 'BOTH',
      displayLegend: false,
      color,
      layout,
      ...chartBase,
      displayDataLabel: true,
    },
  });

const pie = ({
  tabUniversalIdentifier,
  title,
  objectUniversalIdentifier,
  aggregateFieldMetadataUniversalIdentifier,
  groupByFieldMetadataUniversalIdentifier,
  gridPosition,
  color = 'orange',
}: {
  tabUniversalIdentifier: string;
  title: string;
  objectUniversalIdentifier: string;
  aggregateFieldMetadataUniversalIdentifier: string;
  groupByFieldMetadataUniversalIdentifier: string;
  gridPosition: GridPosition;
  color?: string;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    objectUniversalIdentifier,
    gridPosition,
    configuration: {
      configurationType: 'PIE_CHART',
      aggregateFieldMetadataUniversalIdentifier,
      aggregateOperation: AggregateOperations.COUNT,
      groupByFieldMetadataUniversalIdentifier,
      orderBy: 'FIELD_POSITION_ASC',
      showCenterMetric: true,
      displayLegend: true,
      color,
      ...chartBase,
    },
  });

const line = ({
  tabUniversalIdentifier,
  title,
  objectUniversalIdentifier,
  aggregateFieldMetadataUniversalIdentifier,
  primaryAxisGroupByFieldMetadataUniversalIdentifier,
  gridPosition,
  color = 'blue',
  aggregateOperation = AggregateOperations.COUNT,
  filter,
}: {
  tabUniversalIdentifier: string;
  title: string;
  objectUniversalIdentifier: string;
  aggregateFieldMetadataUniversalIdentifier: string;
  primaryAxisGroupByFieldMetadataUniversalIdentifier: string;
  gridPosition: GridPosition;
  color?: string;
  aggregateOperation?: AggregateOperations;
  filter?: UniversalChartFilter;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    objectUniversalIdentifier,
    gridPosition,
    configuration: {
      configurationType: 'LINE_CHART',
      aggregateFieldMetadataUniversalIdentifier,
      aggregateOperation,
      primaryAxisGroupByFieldMetadataUniversalIdentifier,
      primaryAxisDateGranularity: ObjectRecordGroupByDateGranularity.WEEK,
      primaryAxisOrderBy: 'FIELD_ASC',
      axisNameDisplay: 'BOTH',
      displayLegend: false,
      color,
      ...chartBase,
      displayDataLabel: true,
      ...(filter ? { filter } : {}),
    },
  });

const tab = ({
  pageLayoutUniversalIdentifier,
  title,
  position,
  icon,
  widgets,
}: {
  pageLayoutUniversalIdentifier: string;
  title: string;
  position: number;
  icon: string;
  widgets: (
    tabUniversalIdentifier: string,
  ) => PageLayoutWidgetManifest[];
}): PageLayoutTabManifest => {
  const tabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    pageLayoutUniversalIdentifier,
    title,
  });

  return {
    universalIdentifier: tabUniversalIdentifier,
    title,
    position,
    icon,
    layoutMode: PageLayoutTabLayoutMode.GRID,
    pageLayoutUniversalIdentifier,
    widgets: widgets(tabUniversalIdentifier),
  };
};

export const getOutreachDashboardPageLayoutUniversalIdentifier = () =>
  getPageLayoutUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    name: OUTREACH_DASHBOARD_TITLE,
  });

export const buildOutreachDashboardPageLayout = (): PageLayoutManifest => {
  const pageLayoutUniversalIdentifier =
    getOutreachDashboardPageLayoutUniversalIdentifier();

  return {
    universalIdentifier: pageLayoutUniversalIdentifier,
    name: OUTREACH_DASHBOARD_TITLE,
    type: 'DASHBOARD',
    tabs: [
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Overview',
        position: 0,
        icon: 'IconLayoutDashboard',
        widgets: (tabId) => [
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Target companies',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.projectIds,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 0, 3, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'People enrolled',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.outreachSequenceStage,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 3, 3, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Connection requests sent',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.firstOutboundAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 6, 3, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Meetings booked',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.meetingBookedAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 9, 3, 3),
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Funnel: Added → Opportunity',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachFunnelStage,
            gridPosition: grid(3, 0, 6, 6),
            layout: 'HORIZONTAL',
            color: 'blue',
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Candidates by outreach sequence stage',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachSequenceStage,
            gridPosition: grid(3, 6, 6, 6),
            layout: 'HORIZONTAL',
            color: 'purple',
          }),
          line({
            tabUniversalIdentifier: tabId,
            title: 'Companies added (weekly)',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.projectIds,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.companyCreatedAt,
            gridPosition: grid(9, 0, 5, 6),
            color: 'turquoise',
            filter: isNotEmptyFilter({
              widgetTitle: 'Companies added (weekly)',
              fieldMetadataUniversalIdentifier: FIELDS.projectIds,
            }),
          }),
          line({
            tabUniversalIdentifier: tabId,
            title: 'First contacts (weekly)',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.firstContactAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.firstContactAt,
            gridPosition: grid(9, 6, 5, 6),
            color: 'purple',
            filter: isNotEmptyFilter({
              widgetTitle: 'First contacts (weekly)',
              fieldMetadataUniversalIdentifier: FIELDS.projectIds,
            }),
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Account coverage',
        position: 1,
        icon: 'IconBuildingSkyscraper',
        widgets: (tabId) => [
          pie({
            tabUniversalIdentifier: tabId,
            title: 'Coverage buckets',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            groupByFieldMetadataUniversalIdentifier: FIELDS.coverageBucket,
            gridPosition: grid(0, 0, 6, 6),
            color: 'blue',
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg people targeted',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.peopleTargeted,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(0, 6, 3, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg people reached',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.peopleReached,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(0, 9, 3, 3),
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'People reached by funnel stage',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.peopleReached,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachFunnelStage,
            gridPosition: grid(3, 6, 6, 6),
            layout: 'VERTICAL',
            color: 'green',
            aggregateOperation: AggregateOperations.SUM,
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Workflow stage health',
        position: 2,
        icon: 'IconRoute',
        widgets: (tabId) => [
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Candidates by outreach sequence stage',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachSequenceStage,
            gridPosition: grid(0, 0, 8, 12),
            layout: 'HORIZONTAL',
            color: 'purple',
          }),
          pie({
            tabUniversalIdentifier: tabId,
            title: 'Enrich failures / status',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            groupByFieldMetadataUniversalIdentifier: FIELDS.enrichStatus,
            gridPosition: grid(8, 0, 6, 6),
            color: 'red',
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Conversation health',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.candConversationStatus,
            gridPosition: grid(8, 6, 6, 6),
            layout: 'VERTICAL',
            color: 'turquoise',
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Channel mix',
        position: 3,
        icon: 'IconMessage',
        widgets: (tabId) => [
          pie({
            tabUniversalIdentifier: tabId,
            title: 'Candidates by messaging channel',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            groupByFieldMetadataUniversalIdentifier: FIELDS.messagingChannel,
            gridPosition: grid(0, 0, 6, 6),
            color: 'blue',
          }),
          pie({
            tabUniversalIdentifier: tabId,
            title: 'First contact channel (companies)',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            groupByFieldMetadataUniversalIdentifier: FIELDS.firstContactChannel,
            gridPosition: grid(0, 6, 6, 6),
            color: 'green',
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'LinkedIn follow-up count',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.linkedinFollowUpCount,
            gridPosition: grid(6, 0, 6, 6),
            layout: 'VERTICAL',
            color: 'orange',
          }),
          line({
            tabUniversalIdentifier: tabId,
            title: 'WhatsApp / LinkedIn messages over time',
            objectUniversalIdentifier: CHAT_MESSAGE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.chatMessageId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.chatMessageCreatedAt,
            gridPosition: grid(6, 6, 6, 6),
            color: 'turquoise',
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Speed',
        position: 4,
        icon: 'IconClockHour4',
        widgets: (tabId) => [
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Time to first contact',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.candidateTimeToFirstContactBucket,
            gridPosition: grid(0, 0, 6, 6),
            layout: 'VERTICAL',
            color: 'blue',
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Time to meeting booked',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.candidateTimeToMeetingBucket,
            gridPosition: grid(0, 6, 6, 6),
            layout: 'VERTICAL',
            color: 'purple',
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg days → first contact',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.candidateDaysToFirstContact,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(6, 0, 4, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg days → meeting',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.candidateDaysToMeetingBooked,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(6, 3, 4, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg days → connection accept',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.candidateDaysFromConnectionToAccept,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(6, 6, 4, 3),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Avg days → connection to meeting',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.candidateDaysFromConnectionToMeeting,
            aggregateOperation: AggregateOperations.AVG,
            gridPosition: grid(6, 9, 4, 3),
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Outcomes',
        position: 5,
        icon: 'IconTrophy',
        widgets: (tabId) => [
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Meetings booked',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.meetingBookedAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 0, 3, 4),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Meetings held',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.meetingHeldAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 4, 3, 4),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'GTM opportunities',
            objectUniversalIdentifier: OPPORTUNITY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.opportunityId,
            gridPosition: grid(0, 8, 3, 4),
            filter: booleanIsTrueFilter({
              widgetTitle: 'GTM opportunities',
              fieldMetadataUniversalIdentifier: FIELDS.sourcedFromOutreach,
            }),
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Covered and later funnel stages',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachFunnelStage,
            gridPosition: grid(3, 0, 6, 12),
            layout: 'HORIZONTAL',
            color: 'green',
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Covered',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            gridPosition: grid(9, 0, 3, 4),
            filter: selectIsFilter({
              widgetTitle: 'Covered',
              fieldMetadataUniversalIdentifier: FIELDS.outreachFunnelStage,
              values: [
                'COVERED',
                'REPLIED',
                'MEETING_BOOKED',
                'MEETING_HELD',
                'OPPORTUNITY',
              ],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Responded',
            objectUniversalIdentifier: COMPANY,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.companyId,
            gridPosition: grid(9, 4, 3, 4),
            filter: selectIsFilter({
              widgetTitle: 'Responded',
              fieldMetadataUniversalIdentifier: FIELDS.outreachFunnelStage,
              values: [
                'REPLIED',
                'MEETING_BOOKED',
                'MEETING_HELD',
                'OPPORTUNITY',
              ],
            }),
          }),
        ],
      }),
      tab({
        pageLayoutUniversalIdentifier,
        title: 'Experiments',
        position: 6,
        icon: 'IconAB',
        widgets: (tabId) => [
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Enrolled A',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            gridPosition: grid(0, 0, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Enrolled A',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['A'],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Enrolled B',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            gridPosition: grid(0, 2, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Enrolled B',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['B'],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Sent A',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.firstOutboundAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 4, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Sent A',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['A'],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Sent B',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.firstOutboundAt,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 6, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Sent B',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['B'],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Converted A',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.convertedOnMessageKind,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 8, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Converted A',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['A'],
            }),
          }),
          aggregate({
            tabUniversalIdentifier: tabId,
            title: 'Converted B',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier:
              FIELDS.convertedOnMessageKind,
            aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
            gridPosition: grid(0, 10, 3, 2),
            filter: selectIsFilter({
              widgetTitle: 'Converted B',
              fieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
              values: ['B'],
            }),
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Stage by experiment variant',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachSequenceStage,
            gridPosition: grid(3, 0, 6, 8),
            layout: 'VERTICAL',
            color: 'purple',
          }),
          pie({
            tabUniversalIdentifier: tabId,
            title: 'Variant split (sanity)',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            groupByFieldMetadataUniversalIdentifier: FIELDS.experimentVariant,
            gridPosition: grid(3, 8, 6, 4),
            color: 'turquoise',
          }),
          bar({
            tabUniversalIdentifier: tabId,
            title: 'Converted on message kind',
            objectUniversalIdentifier: CANDIDATE,
            aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              FIELDS.convertedOnMessageKind,
            gridPosition: grid(9, 0, 6, 12),
            layout: 'HORIZONTAL',
            color: 'orange',
          }),
        ],
      }),
    ],
  };
};
