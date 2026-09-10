import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { workflowDiagramComponentState } from '@/workflow/workflow-diagram/states/workflowDiagramComponentState';
import { getOrganizedDiagram } from '@/workflow/workflow-diagram/utils/getOrganizedDiagram';
import { useTidyUpWorkflowVersion } from '@/workflow/workflow-version/hooks/useTidyUpWorkflowVersion';
import { isDefined } from 'twenty-shared/utils';

export const useTidyUp = () => {
  const [workflowDiagram, setWorkflowDiagram] = useAtomComponentState(
    workflowDiagramComponentState,
  );

  const { tidyUpWorkflowVersion } = useTidyUpWorkflowVersion();
  const workflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );

  const tidyUpLocally = () => {
    if (!isDefined(workflowDiagram)) {
      return;
    }

    setWorkflowDiagram(getOrganizedDiagram(workflowDiagram));
  };

  const tidyUp = async () => {
    if (!isDefined(workflowDiagram) || !isDefined(workflowVersionId)) {
      return;
    }

    // Layout-only: update the current version in place (no draft fork)
    const tidiedUpDiagram = await tidyUpWorkflowVersion(
      workflowVersionId,
      workflowDiagram,
    );

    if (isDefined(tidiedUpDiagram)) {
      setWorkflowDiagram(tidiedUpDiagram);
    }
  };

  return { tidyUp, tidyUpLocally };
};
