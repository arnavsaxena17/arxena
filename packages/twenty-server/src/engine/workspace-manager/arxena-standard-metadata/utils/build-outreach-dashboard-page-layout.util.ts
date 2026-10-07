import {
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
import {
  AggregateOperations,
  ObjectRecordGroupByDateGranularity,
  PageLayoutTabLayoutMode,
  type PageLayoutWidgetUniversalConfiguration,
} from 'twenty-shared/types';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';

export const OUTREACH_DASHBOARD_TITLE = 'Outreach';

export const OUTREACH_DASHBOARD_ID = 'c4e8b7a1-9d2f-4c6e-8b3a-1f0d5e7c9a24';

const APP = ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER;

const CANDIDATE = getObjectUniversalIdentifier({
  applicationUniversalIdentifier: APP,
  nameSingular: 'candidate',
});

const candidateField = (name: string) =>
  getFieldUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    objectUniversalIdentifier: CANDIDATE,
    name,
  });

// Every widget counts candidates (people in a project) so the numbers match
// what the People tab shows; company-level rollups are intentionally left out.
const FIELDS = {
  candidateId: candidateField('id'),
  outreachAnalytics: candidateField('outreachAnalytics'),
  outreachSequenceStage: candidateField('outreachSequenceStage'),
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

const widget = ({
  tabUniversalIdentifier,
  title,
  gridPosition,
  configuration,
}: {
  tabUniversalIdentifier: string;
  title: string;
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
  objectUniversalIdentifier: CANDIDATE,
  gridPosition,
  configuration,
});

// Count of candidates whose outreachAnalytics.<milestone> timestamp is set
const milestoneCount = ({
  tabUniversalIdentifier,
  title,
  milestone,
  gridPosition,
}: {
  tabUniversalIdentifier: string;
  title: string;
  milestone: string;
  gridPosition: GridPosition;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    gridPosition,
    configuration: {
      configurationType: 'AGGREGATE_CHART',
      aggregateFieldMetadataUniversalIdentifier: FIELDS.outreachAnalytics,
      aggregateSubFieldName: milestone,
      aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
      ...chartBase,
      prefix: '',
    },
  });

// Weekly count of candidates reaching outreachAnalytics.<milestone>
const weeklyMilestone = ({
  tabUniversalIdentifier,
  title,
  milestone,
  gridPosition,
  color,
}: {
  tabUniversalIdentifier: string;
  title: string;
  milestone: string;
  gridPosition: GridPosition;
  color: string;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    gridPosition,
    configuration: {
      configurationType: 'LINE_CHART',
      aggregateFieldMetadataUniversalIdentifier: FIELDS.outreachAnalytics,
      aggregateSubFieldName: milestone,
      aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
      primaryAxisGroupByFieldMetadataUniversalIdentifier:
        FIELDS.outreachAnalytics,
      primaryAxisGroupBySubFieldName: milestone,
      primaryAxisDateGranularity: ObjectRecordGroupByDateGranularity.WEEK,
      primaryAxisOrderBy: 'FIELD_ASC',
      omitNullValues: true,
      axisNameDisplay: 'NONE',
      displayLegend: false,
      color,
      ...chartBase,
      displayDataLabel: true,
    },
  });

const candidatesBy = ({
  tabUniversalIdentifier,
  title,
  groupByFieldMetadataUniversalIdentifier,
  groupBySubFieldName,
  gridPosition,
  color,
}: {
  tabUniversalIdentifier: string;
  title: string;
  groupByFieldMetadataUniversalIdentifier: string;
  groupBySubFieldName?: string;
  gridPosition: GridPosition;
  color: string;
}) =>
  widget({
    tabUniversalIdentifier,
    title,
    gridPosition,
    configuration: {
      configurationType: 'BAR_CHART',
      aggregateFieldMetadataUniversalIdentifier: FIELDS.candidateId,
      aggregateOperation: AggregateOperations.COUNT,
      primaryAxisGroupByFieldMetadataUniversalIdentifier:
        groupByFieldMetadataUniversalIdentifier,
      ...(groupBySubFieldName
        ? { primaryAxisGroupBySubFieldName: groupBySubFieldName }
        : {}),
      primaryAxisOrderBy: 'FIELD_POSITION_ASC',
      // Hides people with no value (not enrolled / no reply yet)
      omitNullValues: true,
      axisNameDisplay: 'NONE',
      displayLegend: false,
      color,
      layout: 'HORIZONTAL',
      ...chartBase,
      displayDataLabel: true,
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
  widgets: (tabUniversalIdentifier: string) => PageLayoutWidgetManifest[];
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

// One tab, eight widgets: the four funnel milestones as numbers (in funnel
// order), two weekly trends, where people are now, and what got replies.
// Operational and debugging views live in Today and the person drawer.
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
          milestoneCount({
            tabUniversalIdentifier: tabId,
            title: 'People contacted',
            milestone: 'firstOutboundAt',
            gridPosition: grid(0, 0, 3, 3),
          }),
          milestoneCount({
            tabUniversalIdentifier: tabId,
            title: 'Connections accepted',
            milestone: 'connectionAcceptedAt',
            gridPosition: grid(0, 3, 3, 3),
          }),
          milestoneCount({
            tabUniversalIdentifier: tabId,
            title: 'Replies',
            milestone: 'firstReplyAt',
            gridPosition: grid(0, 6, 3, 3),
          }),
          milestoneCount({
            tabUniversalIdentifier: tabId,
            title: 'Meetings booked',
            milestone: 'meetingBookedAt',
            gridPosition: grid(0, 9, 3, 3),
          }),
          weeklyMilestone({
            tabUniversalIdentifier: tabId,
            title: 'People contacted per week',
            milestone: 'firstOutboundAt',
            gridPosition: grid(3, 0, 6, 6),
            color: 'blue',
          }),
          weeklyMilestone({
            tabUniversalIdentifier: tabId,
            title: 'Replies per week',
            milestone: 'firstReplyAt',
            gridPosition: grid(3, 6, 6, 6),
            color: 'orange',
          }),
          candidatesBy({
            tabUniversalIdentifier: tabId,
            title: 'Where people are now',
            groupByFieldMetadataUniversalIdentifier:
              FIELDS.outreachSequenceStage,
            gridPosition: grid(9, 0, 7, 6),
            color: 'purple',
          }),
          candidatesBy({
            tabUniversalIdentifier: tabId,
            title: 'What got replies',
            groupByFieldMetadataUniversalIdentifier: FIELDS.outreachAnalytics,
            groupBySubFieldName: 'convertedOnMessageKind',
            gridPosition: grid(9, 6, 7, 6),
            color: 'green',
          }),
        ],
      }),
    ],
  };
};
