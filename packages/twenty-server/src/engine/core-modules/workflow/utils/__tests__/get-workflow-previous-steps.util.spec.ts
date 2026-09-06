import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  getWorkflowPreviousSteps,
  getWorkflowStepsToHydrateForPrompt,
} from 'src/engine/core-modules/workflow/utils/get-workflow-previous-steps.util';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const buildFindStep = ({
  id,
  nextStepIds,
}: {
  id: string;
  nextStepIds?: string[];
}): WorkflowAction =>
  ({
    id,
    name: id,
    type: WorkflowActionType.FIND_RECORDS,
    valid: true,
    nextStepIds,
    settings: { input: { objectName: 'candidate' }, outputSchema: {} },
  }) as WorkflowAction;

describe('getWorkflowPreviousSteps', () => {
  it('should return ancestors in root-to-parent order for a linear branch', () => {
    const loadCandidate = buildFindStep({
      id: 'load-candidate',
      nextStepIds: ['fetch-profile'],
    });
    const fetchProfile = {
      ...buildFindStep({
        id: 'fetch-profile',
        nextStepIds: ['draft'],
      }),
      type: WorkflowActionType.LOGIC_FUNCTION,
    } as WorkflowAction;
    const draft = {
      ...buildFindStep({ id: 'draft' }),
      type: WorkflowActionType.AI_AGENT,
    } as WorkflowAction;

    expect(
      getWorkflowPreviousSteps({
        steps: [loadCandidate, fetchProfile, draft],
        currentStep: draft,
      }).map((step) => step.id),
    ).toEqual(['load-candidate', 'fetch-profile']);
  });

  it('should not include sibling IF_ELSE branches', () => {
    const router = {
      id: 'router',
      name: 'router',
      type: WorkflowActionType.IF_ELSE,
      valid: true,
      settings: {
        input: {
          stepFilterGroups: [],
          stepFilters: [],
          branches: [
            { id: 'accepted', nextStepIds: ['accept-find'] },
            { id: 'replied', nextStepIds: ['replied-find'] },
          ],
        },
        outputSchema: {},
      },
    } as unknown as WorkflowAction;
    const acceptFind = buildFindStep({
      id: 'accept-find',
      nextStepIds: ['draft-first'],
    });
    const repliedFind = buildFindStep({
      id: 'replied-find',
      nextStepIds: ['draft-reply'],
    });
    const draftFirst = {
      ...buildFindStep({ id: 'draft-first' }),
      type: WorkflowActionType.AI_AGENT,
    } as WorkflowAction;

    expect(
      getWorkflowPreviousSteps({
        steps: [router, acceptFind, repliedFind, draftFirst],
        currentStep: draftFirst,
      }).map((step) => step.id),
    ).toEqual(['router', 'accept-find']);
  });
});

describe('getWorkflowStepsToHydrateForPrompt', () => {
  it('should include prompt-referenced steps that are not ancestors', () => {
    const loadCandidate = buildFindStep({
      id: 'load-candidate',
      nextStepIds: ['fetch-profile'],
    });
    const fetchProfile = {
      ...buildFindStep({
        id: 'fetch-profile',
        nextStepIds: ['draft-first'],
      }),
      type: WorkflowActionType.LOGIC_FUNCTION,
    } as WorkflowAction;
    const draftFollowUp = {
      ...buildFindStep({ id: 'draft-follow-up' }),
      type: WorkflowActionType.AI_AGENT,
    } as WorkflowAction;

    expect(
      getWorkflowStepsToHydrateForPrompt({
        steps: [loadCandidate, fetchProfile, draftFollowUp],
        currentStep: draftFollowUp,
        prompt: `About: {{${fetchProfile.id}.about}}`,
      }).map((step) => step.id),
    ).toEqual(['load-candidate', 'fetch-profile']);
  });
});
