import { findMatchingBranch } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/utils/find-matching-branch.util';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';

import {
  buildFreeTrialLeadWorkflowDefinition,
  FREE_TRIAL_LEAD_WORKFLOW_NAME,
} from '../free-trial-lead-workflow-definition';

type IfElseInput = {
  stepFilterGroups: Array<{ id: string; logicalOperator: string }>;
  stepFilters: Array<{
    id: string;
    type: string;
    stepOutputKey: string;
    operand: ViewFilterOperand;
    value: string;
    stepFilterGroupId: string;
  }>;
  branches: Array<{ id: string; nextStepIds: string[]; filterGroupId?: string }>;
};

describe('Free trial lead workflow definition', () => {
  const connectedAccountId = '00000000-0000-4000-8000-000000000001';

  it('builds an opportunity.created workflow with Calendly meeting IF/ELSE branching', () => {
    const definition = buildFreeTrialLeadWorkflowDefinition({
      connectedAccountId,
    });

    console.log('free trial workflow name', FREE_TRIAL_LEAD_WORKFLOW_NAME);
    console.log('free trial workflow step count', definition.steps.length);

    expect(definition.trigger).toMatchObject({
      type: 'DATABASE_EVENT',
      settings: {
        eventName: 'opportunity.created',
      },
    });

    const stepTypes = definition.steps.map((step) => step.type);

    expect(stepTypes).toEqual([
      'DELAY',
      'FIND_RECORDS',
      'FIND_RECORDS',
      'IF_ELSE',
      'AI_AGENT',
      'SEND_EMAIL',
      'AI_AGENT',
      'SEND_EMAIL',
    ]);

    const refreshOpportunityStep = definition.steps.find(
      (step) => step.name === 'Refresh Opportunity',
    );

    expect(refreshOpportunityStep).toMatchObject({
      type: 'FIND_RECORDS',
      settings: {
        input: {
          objectName: 'opportunity',
        },
      },
    });

    const ifElseStep = definition.steps.find((step) => step.type === 'IF_ELSE');

    expect(
      (ifElseStep?.settings as { input: { stepFilters: Array<{ operand: string }> } })
        .input.stepFilters[0],
    ).toMatchObject({
      type: 'date',
      operand: ViewFilterOperand.IS_NOT_EMPTY,
    });
  });

  it('routes to the thank-you branch when meetingScheduledAt is set', () => {
    const definition = buildFreeTrialLeadWorkflowDefinition({
      connectedAccountId,
    });

    const ifElseStep = definition.steps.find((step) => step.type === 'IF_ELSE');

    if (!ifElseStep) {
      throw new Error('Expected IF_ELSE step');
    }

    const input = (ifElseStep.settings as { input: IfElseInput }).input;

    const resolvedFilters = input.stepFilters.map((filter) => ({
      ...filter,
      leftOperand: '2026-07-09T10:00:00.000Z',
      rightOperand: filter.value,
    }));

    const matchingBranch = findMatchingBranch({
      branches: input.branches,
      stepFilterGroups: input.stepFilterGroups.map((group) => ({
        ...group,
        logicalOperator: group.logicalOperator as StepLogicalOperator,
      })),
      resolvedFilters,
    });

    console.log('matching branch when meeting is scheduled', matchingBranch);

    expect(matchingBranch.nextStepIds).toEqual([
      definition.stepIds.llmThankYou,
    ]);
  });

  it('routes to the scheduling reminder branch when meetingScheduledAt is empty', () => {
    const definition = buildFreeTrialLeadWorkflowDefinition({
      connectedAccountId,
    });

    const ifElseStep = definition.steps.find((step) => step.type === 'IF_ELSE');

    if (!ifElseStep) {
      throw new Error('Expected IF_ELSE step');
    }

    const input = (ifElseStep.settings as { input: IfElseInput }).input;

    const resolvedFilters = input.stepFilters.map((filter) => ({
      ...filter,
      leftOperand: null,
      rightOperand: filter.value,
    }));

    const matchingBranch = findMatchingBranch({
      branches: input.branches,
      stepFilterGroups: input.stepFilterGroups.map((group) => ({
        ...group,
        logicalOperator: group.logicalOperator as StepLogicalOperator,
      })),
      resolvedFilters,
    });

    console.log('matching branch when meeting is not scheduled', matchingBranch);

    expect(matchingBranch.nextStepIds).toEqual([
      definition.stepIds.llmScheduleReminder,
    ]);
  });
});
