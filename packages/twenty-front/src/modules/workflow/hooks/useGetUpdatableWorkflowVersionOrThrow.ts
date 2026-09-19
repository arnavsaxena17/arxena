import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useCreateDraftFromWorkflowVersion } from '@/workflow/hooks/useCreateDraftFromWorkflowVersion';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { lastDiscardedDraftIdState } from '@/workflow/states/lastDiscardedDraftIdState';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { useAtomValue } from 'jotai';
import { useRef } from 'react';
import { isDefined } from 'twenty-shared/utils';

type GetUpdatableWorkflowVersionOptions = {
  // Content-only edits (step/trigger settings) may update ACTIVE/EXPERIMENT
  // in place. Graph changes (nodes/edges) still fork a draft.
  contentOnly?: boolean;
};

const PUBLISHED_VERSION_STATUSES = new Set(['ACTIVE', 'EXPERIMENT']);

export const useGetUpdatableWorkflowVersionOrThrow = (instanceId?: string) => {
  const { createDraftFromWorkflowVersion } =
    useCreateDraftFromWorkflowVersion();
  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
    instanceId,
  );
  const workflow = useWorkflowWithCurrentVersion(workflowVisualizerWorkflowId);
  const lastDiscardedDraftId = useAtomValue(lastDiscardedDraftIdState);
  const lastEnsuredDraftIdRef = useRef<{
    workflowId: string;
    draftId: string;
  } | null>(null);

  const getUpdatableWorkflowVersion = async (
    options?: GetUpdatableWorkflowVersionOptions,
  ): Promise<string> => {
    if (!isDefined(workflowVisualizerWorkflowId) || !isDefined(workflow)) {
      throw new Error('Failed to get updatable workflow version');
    }

    if (
      lastEnsuredDraftIdRef.current?.workflowId !== workflowVisualizerWorkflowId
    ) {
      lastEnsuredDraftIdRef.current = null;
    }

    if (workflow.currentVersion.status === 'DRAFT') {
      lastEnsuredDraftIdRef.current = {
        workflowId: workflowVisualizerWorkflowId,
        draftId: workflow.currentVersion.id,
      };

      return workflow.currentVersion.id;
    }

    const existingDraftVersion = workflow.versions?.find(
      (version) => version.status === 'DRAFT',
    );

    if (isDefined(existingDraftVersion)) {
      lastEnsuredDraftIdRef.current = {
        workflowId: workflowVisualizerWorkflowId,
        draftId: existingDraftVersion.id,
      };

      return existingDraftVersion.id;
    }

    if (
      options?.contentOnly === true &&
      PUBLISHED_VERSION_STATUSES.has(workflow.currentVersion.status)
    ) {
      const rememberedDraft = lastEnsuredDraftIdRef.current;

      // Same-tick structural fork may not be reflected in workflow.versions yet
      if (
        isDefined(rememberedDraft) &&
        rememberedDraft.draftId !== lastDiscardedDraftId
      ) {
        return rememberedDraft.draftId;
      }

      return workflow.currentVersion.id;
    }

    const draftVersionId = await createDraftFromWorkflowVersion({
      workflowId: workflowVisualizerWorkflowId,
      workflowVersionIdToCopy: workflow.currentVersion.id,
    });

    if (!isDefined(draftVersionId)) {
      throw new Error('Failed to create draft version');
    }

    lastEnsuredDraftIdRef.current = {
      workflowId: workflowVisualizerWorkflowId,
      draftId: draftVersionId,
    };

    return draftVersionId;
  };

  return { getUpdatableWorkflowVersion };
};
