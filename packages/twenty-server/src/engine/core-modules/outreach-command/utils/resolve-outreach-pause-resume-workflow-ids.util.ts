import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  readProjectExperimentConfig,
  type OutreachExperimentConfig,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import {
  SEEDED_OUTREACH_WORKFLOW,
  seededOutreachWorkflowNameAliases,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

// Stage B (Per Enrolled Candidate) + Stage C (Enrolled Person Updated) only.
export const OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES = [
  ...seededOutreachWorkflowNameAliases(
    SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
  ),
  ...seededOutreachWorkflowNameAliases(
    SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
  ),
] as const;

/** @deprecated Use OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES */
export const OUTREACH_PAUSE_RESUME_SEEDED_WORKFLOW_NAMES =
  OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES;

export type OutreachSequencerStage = 'perCandidate' | 'candidateUpdated';

export const resolveOutreachSequencerStageFromName = (
  workflowName?: string | null,
): OutreachSequencerStage | null => {
  if (!isNonEmptyString(workflowName)) {
    return null;
  }

  const perCandidateNames = seededOutreachWorkflowNameAliases(
    SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
  );

  if (perCandidateNames.includes(workflowName)) {
    return 'perCandidate';
  }

  const candidateUpdatedNames = seededOutreachWorkflowNameAliases(
    SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
  );

  if (candidateUpdatedNames.includes(workflowName)) {
    return 'candidateUpdated';
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

  const perCandidateWorkflowId =
    parsedExperiment?.workflows?.perCandidate?.workflowId;
  const candidateUpdatedWorkflowId =
    parsedExperiment?.workflows?.candidateUpdated?.workflowId;

  if (isNonEmptyString(perCandidateWorkflowId)) {
    workflowIds.add(perCandidateWorkflowId);
  }

  if (isNonEmptyString(candidateUpdatedWorkflowId)) {
    workflowIds.add(candidateUpdatedWorkflowId);
  }

  return [...workflowIds];
};

/** @deprecated Use collectOutreachSequencerWorkflowIdsFromProject */
export const collectOutreachPauseResumeWorkflowIdsFromProject =
  collectOutreachSequencerWorkflowIdsFromProject;

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

  for (const workflow of workflowsMatchedByName) {
    if (isDefined(workflow.id) && isNonEmptyString(workflow.id)) {
      workflowIds.add(workflow.id);
    }
  }

  return workflowIds;
};

/** @deprecated Use mergeOutreachSequencerWorkflowIds */
export const mergeOutreachPauseResumeWorkflowIds =
  mergeOutreachSequencerWorkflowIds;
