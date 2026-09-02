import {
  computeDeterministicUuid,
  getFieldUniversalIdentifier,
  getObjectUniversalIdentifier,
  getViewFieldUniversalIdentifier,
  getViewUniversalIdentifier,
  type ViewManifest,
} from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  ViewFilterOperand,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
import {
  OUTREACH_ACTIVE_WORKFLOW_RUN_STATUSES,
  OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES,
  OUTREACH_STAGE_C_BRANCH_STAGES,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-workflow-control.constants';

const APP = ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER;

const CANDIDATE = getObjectUniversalIdentifier({
  applicationUniversalIdentifier: APP,
  nameSingular: 'candidate',
});

const WORKFLOW_RUN = STANDARD_OBJECTS.workflowRun.universalIdentifier;

const arxenaField = (objectUniversalIdentifier: string, name: string) =>
  getFieldUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    objectUniversalIdentifier,
    name,
  });

const workflowRunField = (name: keyof typeof STANDARD_OBJECTS.workflowRun.fields) =>
  STANDARD_OBJECTS.workflowRun.fields[name].universalIdentifier;

const CANDIDATE_FIELDS = {
  name: arxenaField(CANDIDATE, 'name'),
  outreachSequenceStage: arxenaField(CANDIDATE, 'outreachSequenceStage'),
  candConversationStatus: arxenaField(CANDIDATE, 'candConversationStatus'),
  linkedinFollowUpCount: arxenaField(CANDIDATE, 'linkedinFollowUpCount'),
  messagingChannel: arxenaField(CANDIDATE, 'messagingChannel'),
  outreachAnalytics: arxenaField(CANDIDATE, 'outreachAnalytics'),
};

const WORKFLOW_RUN_FIELDS = {
  id: workflowRunField('id'),
  name: workflowRunField('name'),
  workflow: workflowRunField('workflow'),
  status: workflowRunField('status'),
  relatedRecordId: workflowRunField('relatedRecordId'),
  relatedObjectName: workflowRunField('relatedObjectName'),
  currentStepName: workflowRunField('currentStepName'),
  currentStepKind: workflowRunField('currentStepKind'),
  resumeAt: workflowRunField('resumeAt'),
  upcomingSteps: workflowRunField('upcomingSteps'),
  startedAt: workflowRunField('startedAt'),
  endedAt: workflowRunField('endedAt'),
};

type DashboardViewField = {
  fieldMetadataUniversalIdentifier: string;
  size?: number;
};

type DashboardViewFilter = {
  fieldMetadataUniversalIdentifier: string;
  operand: ViewFilterOperand;
  value: string;
};

type DashboardViewSort = {
  fieldMetadataUniversalIdentifier: string;
  direction: ViewSortDirection;
};

const buildDashboardWidgetView = ({
  name,
  objectUniversalIdentifier,
  fields,
  filters = [],
  sorts = [],
  position,
}: {
  name: string;
  objectUniversalIdentifier: string;
  fields: DashboardViewField[];
  filters?: DashboardViewFilter[];
  sorts?: DashboardViewSort[];
  position: number;
}): ViewManifest => {
  const viewUniversalIdentifier = getViewUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    objectUniversalIdentifier,
    name,
  });

  const filterGroupUniversalIdentifier = computeDeterministicUuid({
    entityNamespace: 'viewFilterGroup',
    value: `${viewUniversalIdentifier}:filters`,
    applicationUniversalIdentifier: APP,
  });

  return {
    universalIdentifier: viewUniversalIdentifier,
    name,
    objectUniversalIdentifier,
    type: ViewType.TABLE_WIDGET,
    icon: 'IconTable',
    visibility: ViewVisibility.WORKSPACE,
    position,
    fields: fields.map((field, fieldPosition) => ({
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: APP,
        viewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: field.fieldMetadataUniversalIdentifier,
      }),
      fieldMetadataUniversalIdentifier: field.fieldMetadataUniversalIdentifier,
      position: fieldPosition,
      isVisible: true,
      size: field.size ?? 150,
    })),
    ...(filters.length > 0
      ? {
          filterGroups: [
            {
              universalIdentifier: filterGroupUniversalIdentifier,
              logicalOperator: 'AND',
            },
          ],
          filters: filters.map((filter, filterPosition) => ({
            universalIdentifier: computeDeterministicUuid({
              entityNamespace: 'viewFilter',
              value: `${viewUniversalIdentifier}:${filter.fieldMetadataUniversalIdentifier}:${filterPosition}`,
              applicationUniversalIdentifier: APP,
            }),
            fieldMetadataUniversalIdentifier: filter.fieldMetadataUniversalIdentifier,
            operand: filter.operand,
            value: filter.value,
            viewFilterGroupUniversalIdentifier: filterGroupUniversalIdentifier,
            positionInViewFilterGroup: filterPosition,
          })),
        }
      : {}),
    ...(sorts.length > 0
      ? {
          sorts: sorts.map((sort, sortPosition) => ({
            universalIdentifier: computeDeterministicUuid({
              entityNamespace: 'viewSort',
              value: `${viewUniversalIdentifier}:${sort.fieldMetadataUniversalIdentifier}:${sortPosition}`,
              applicationUniversalIdentifier: APP,
            }),
            fieldMetadataUniversalIdentifier: sort.fieldMetadataUniversalIdentifier,
            direction: sort.direction,
          })),
        }
      : {}),
  };
};

const candidateTriggeredWorkflowRunFilters = (): DashboardViewFilter[] => [
  {
    fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.relatedObjectName,
    operand: ViewFilterOperand.CONTAINS,
    value: 'candidate',
  },
];

export const getOutreachDashboardWorkflowControlViewUniversalIdentifier = (
  viewName: string,
  objectUniversalIdentifier: string,
): string =>
  getViewUniversalIdentifier({
    applicationUniversalIdentifier: APP,
    objectUniversalIdentifier,
    name: viewName,
  });

export const buildOutreachDashboardViews = (): ViewManifest[] => [
  buildDashboardWidgetView({
    name: OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.hitlApprovalQueue,
    objectUniversalIdentifier: WORKFLOW_RUN,
    position: 200,
    fields: [
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.name, size: 180 },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.relatedRecordId,
        size: 180,
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.currentStepName,
        size: 220,
      },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status, size: 120 },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.startedAt, size: 160 },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.workflow, size: 200 },
    ],
    filters: [
      ...candidateTriggeredWorkflowRunFilters(),
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.currentStepKind,
        operand: ViewFilterOperand.IS,
        value: JSON.stringify(['FORM']),
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status,
        operand: ViewFilterOperand.IS,
        value: JSON.stringify([...OUTREACH_ACTIVE_WORKFLOW_RUN_STATUSES]),
      },
    ],
    sorts: [
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.startedAt,
        direction: ViewSortDirection.ASC,
      },
    ],
  }),
  buildDashboardWidgetView({
    name: OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.activeCandidateWorkflowRuns,
    objectUniversalIdentifier: WORKFLOW_RUN,
    position: 201,
    fields: [
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.relatedRecordId,
        size: 180,
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.currentStepName,
        size: 220,
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.currentStepKind,
        size: 140,
      },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.resumeAt, size: 160 },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.upcomingSteps,
        size: 220,
      },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status, size: 120 },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.startedAt, size: 160 },
    ],
    filters: [
      ...candidateTriggeredWorkflowRunFilters(),
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status,
        operand: ViewFilterOperand.IS,
        value: JSON.stringify([...OUTREACH_ACTIVE_WORKFLOW_RUN_STATUSES]),
      },
    ],
    sorts: [
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.resumeAt,
        direction: ViewSortDirection.ASC,
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.startedAt,
        direction: ViewSortDirection.ASC,
      },
    ],
  }),
  buildDashboardWidgetView({
    name: OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.failedWorkflowRuns,
    objectUniversalIdentifier: WORKFLOW_RUN,
    position: 202,
    fields: [
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.relatedRecordId,
        size: 180,
      },
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.currentStepName,
        size: 220,
      },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status, size: 120 },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.endedAt, size: 160 },
      { fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.workflow, size: 200 },
    ],
    filters: [
      ...candidateTriggeredWorkflowRunFilters(),
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.status,
        operand: ViewFilterOperand.IS,
        value: JSON.stringify(['FAILED']),
      },
    ],
    sorts: [
      {
        fieldMetadataUniversalIdentifier: WORKFLOW_RUN_FIELDS.endedAt,
        direction: ViewSortDirection.DESC,
      },
    ],
  }),
  buildDashboardWidgetView({
    name: OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.stageCCandidates,
    objectUniversalIdentifier: CANDIDATE,
    position: 203,
    fields: [
      { fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.name, size: 180 },
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.outreachSequenceStage,
        size: 180,
      },
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.candConversationStatus,
        size: 180,
      },
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.linkedinFollowUpCount,
        size: 140,
      },
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.messagingChannel,
        size: 140,
      },
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.outreachAnalytics,
        size: 200,
      },
    ],
    filters: [
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.outreachSequenceStage,
        operand: ViewFilterOperand.IS,
        value: JSON.stringify([...OUTREACH_STAGE_C_BRANCH_STAGES]),
      },
    ],
    sorts: [
      {
        fieldMetadataUniversalIdentifier: CANDIDATE_FIELDS.outreachSequenceStage,
        direction: ViewSortDirection.ASC,
      },
    ],
  }),
];
