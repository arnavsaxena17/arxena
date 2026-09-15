import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  readProjectExperimentConfig,
  type OutreachExperimentConfig,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

// Candidate Sequencer only — Stage B/C were deactivated at cutover.
export const OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES = [
  SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
] as const;

export type OutreachSequencerStage = 'candidateSequencer';

export const resolveOutreachSequencerStageFromName = (
  workflowName?: string | null,
): OutreachSequencerStage | null => {
  if (!isNonEmptyString(workflowName)) {
    return null;
  }

  // Local compressed-delay copies are named "... (30 seconds)" / "... (3 minutes)".
  const normalizedName = workflowName.replace(/\s*\([^)]*\)\s*$/, '').trim();

  if (
    workflowName === SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name ||
    normalizedName === SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name
  ) {
    return 'candidateSequencer';
  }

  return null;
};

export const isOutreachSequencerWorkflowName = (
  workflowName?: string | null,
): boolean => resolveOutreachSequencerStageFromName(workflowName) !== null;

export const collectOutreachSequencerWorkflowIdsFromProject = ({
  outreachWorkflowId,
  outreachConfig,
  experimentConfig,
}: {
  outreachWorkflowId?: string | null;
  outreachConfig?: unknown;
  experimentConfig?: string | null;
}): string[] => {
  const workflowIds = new Set<string>();

  if (isNonEmptyString(outreachWorkflowId)) {
    workflowIds.add(outreachWorkflowId);
  }

  const parsedExperiment: OutreachExperimentConfig | null =
    readProjectExperimentConfig({
      outreachConfig,
      experimentConfig,
    });

  const candidateSequencerWorkflowId =
    parsedExperiment?.workflows?.candidateSequencer?.workflowId;

  if (isNonEmptyString(candidateSequencerWorkflowId)) {
    workflowIds.add(candidateSequencerWorkflowId);
  }

  return [...workflowIds];
};

export const isOutreachSequencerWorkflow = ({
  workflowId,
  workflowName,
  outreachWorkflowId,
  outreachConfig,
  experimentConfig,
}: {
  workflowId?: string | null;
  workflowName?: string | null;
  outreachWorkflowId?: string | null;
  outreachConfig?: unknown;
  experimentConfig?: string | null;
}): boolean => {
  if (isOutreachSequencerWorkflowName(workflowName)) {
    return true;
  }

  if (!isNonEmptyString(workflowId)) {
    return false;
  }

  const projectWorkflowIds = collectOutreachSequencerWorkflowIdsFromProject({
    outreachWorkflowId,
    outreachConfig,
    experimentConfig,
  });

  return projectWorkflowIds.includes(workflowId);
};

export const isOutreachPauseResumeWorkflowRun = ({
  workflowId,
  allowedWorkflowIds,
}: {
  workflowId?: string | null;
  allowedWorkflowIds: ReadonlySet<string>;
}): boolean =>
  isNonEmptyString(workflowId) && allowedWorkflowIds.has(workflowId);

export const filterOutreachPauseResumeWorkflowRuns = <
  TRun extends { workflowId?: string | null },
>({
  runs,
  allowedWorkflowIds,
}: {
  runs: TRun[];
  allowedWorkflowIds: ReadonlySet<string>;
}): TRun[] => {
  if (allowedWorkflowIds.size === 0) {
    return [];
  }

  return runs.filter((run) =>
    isOutreachPauseResumeWorkflowRun({
      workflowId: run.workflowId,
      allowedWorkflowIds,
    }),
  );
};

export const mergeOutreachSequencerWorkflowIds = ({
  projectWorkflowIds,
  workflowsMatchedByName,
}: {
  projectWorkflowIds: string[];
  workflowsMatchedByName: Array<{ id?: string | null }>;
}): Set<string> => {
  const workflowIds = new Set(projectWorkflowIds);

  // Name match is bootstrap fallback only when the project has no pin yet.
  if (workflowIds.size > 0) {
    return workflowIds;
  }

  for (const workflow of workflowsMatchedByName) {
    if (isDefined(workflow.id) && isNonEmptyString(workflow.id)) {
      workflowIds.add(workflow.id);
    }
  }

  return workflowIds;
};
