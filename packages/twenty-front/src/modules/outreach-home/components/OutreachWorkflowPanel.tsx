import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachWorkflowDiagramEmbed } from '@/outreach-home/components/OutreachWorkflowDiagramEmbed';
import { OutreachWorkflowRunDiagramEmbed } from '@/outreach-home/components/OutreachWorkflowRunDiagramEmbed';
import { type OutreachWorkflowEmbedMode } from '@/outreach-home/hooks/useOutreachWorkflowEmbed';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
`;

const StyledCanvas = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  flex: 1;
  height: 100%;
  min-height: 420px;
  overflow: hidden;

  > * {
    height: 100%;
  }
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[6]};
`;

type OutreachWorkflowPanelProps = {
  isActive: boolean;
  mode: OutreachWorkflowEmbedMode;
  workflowId: string | null;
  workflowRunId: string | null;
  hasWorkflow: boolean;
  hasWorkflowRun: boolean;
  workflowsLoading: boolean;
  runsLoading: boolean;
};

export const OutreachWorkflowPanel = ({
  isActive,
  mode,
  workflowId,
  workflowRunId,
  hasWorkflow,
  hasWorkflowRun,
  workflowsLoading,
  runsLoading,
}: OutreachWorkflowPanelProps) => {
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const lastOpenedForActiveRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      lastOpenedForActiveRef.current = false;
      return;
    }

    if (lastOpenedForActiveRef.current) {
      return;
    }

    lastOpenedForActiveRef.current = true;
    // Keep the existing chat thread; do not auto-send a new kickoff.
    openAskAiPage({ resetNavigationStack: true });
  }, [isActive, openAskAiPage]);

  if (workflowsLoading) {
    return (
      <StyledEmpty>
        <Loader /> Loading workflows…
      </StyledEmpty>
    );
  }

  if (!hasWorkflow || !workflowId) {
    return (
      <StyledEmpty>
        <Loader /> Preparing default Stage B outreach workflow…
      </StyledEmpty>
    );
  }

  return (
    <StyledPanel>
      <StyledCanvas>
        {mode === 'run' && hasWorkflowRun && workflowRunId ? (
          runsLoading ? (
            <StyledEmpty>
              <Loader /> Loading run…
            </StyledEmpty>
          ) : (
            <OutreachWorkflowRunDiagramEmbed
              key={workflowRunId}
              workflowRunId={workflowRunId}
            />
          )
        ) : (
          <OutreachWorkflowDiagramEmbed key={workflowId} workflowId={workflowId} />
        )}
      </StyledCanvas>
    </StyledPanel>
  );
};
