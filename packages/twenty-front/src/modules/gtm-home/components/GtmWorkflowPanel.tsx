import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@linaria/react';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
import { GtmWorkflowDiagramEmbed } from '@/gtm-home/components/GtmWorkflowDiagramEmbed';
import { GtmWorkflowRunDiagramEmbed } from '@/gtm-home/components/GtmWorkflowRunDiagramEmbed';
import {
  type GtmWorkflowEmbedMode,
  useGtmWorkflowEmbed,
} from '@/gtm-home/hooks/useGtmWorkflowEmbed';
import {
  buildGtmCommandContextPrompt,
  gtmCommandContextState,
} from '@/gtm-home/states/gtmCommandContextState';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  height: 100%;
  min-height: 480px;
`;

const StyledToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledModeToggle = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHint = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledContext = styled.pre`
  margin: 0;
  padding: ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  white-space: pre-wrap;
  max-height: 140px;
  overflow: auto;
`;

const StyledCanvas = styled.div`
  flex: 1;
  min-height: 420px;
  height: 100%;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
  background: ${themeCssVariables.background.primary};

  > * {
    height: 100%;
  }
`;

const StyledEmpty = styled.div`
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
`;

type GtmWorkflowPanelProps = {
  isActive: boolean;
};

export const GtmWorkflowPanel = ({ isActive }: GtmWorkflowPanelProps) => {
  const navigate = useNavigate();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();
  const commandContext = useAtomStateValue(gtmCommandContextState);
  const {
    workflowId,
    workflowRunId,
    hasWorkflow,
    hasWorkflowRun,
    workflowsLoading,
    runsLoading,
    projectOutreachWorkflowId,
  } = useGtmWorkflowEmbed();

  const [mode, setMode] = useState<GtmWorkflowEmbedMode>('definition');
  const contextPrompt = buildGtmCommandContextPrompt(commandContext);

  const openAskAiWithRunContext = () => {
    openAskAiPageWithPreprompt({
      mode: 'PREFILL',
      text: contextPrompt,
    });
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    // Keep the existing chat thread; do not auto-send a new kickoff.
    openAskAiPage({ resetNavigationStack: true });
  }, [isActive, openAskAiPage]);

  useEffect(() => {
    if (mode === 'run' && !hasWorkflowRun && hasWorkflow) {
      setMode('definition');
    }
  }, [hasWorkflow, hasWorkflowRun, mode]);

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
        No outreach workflow bound for this GTM run yet.
        <br />
        Seed with{' '}
        <code>setup-gtm-outreach-workflow.ts</code> (sets Project.outreachWorkflowId),
        open a workflow under Workflows, or pass <code>?workflowId=…</code>.
        <br />
        <Button
          title="Open Workflows"
          variant="secondary"
          size="small"
          onClick={() =>
            navigate(
              getAppPath(AppPath.RecordIndexPage, {
                objectNamePlural: 'workflows',
              }),
            )
          }
        />
      </StyledEmpty>
    );
  }

  return (
    <StyledPanel>
      <StyledToolbar>
        <StyledModeToggle>
          <Button
            title="Definition"
            size="small"
            variant={mode === 'definition' ? 'primary' : 'secondary'}
            onClick={() => setMode('definition')}
          />
          <Button
            title="Latest run"
            size="small"
            variant={mode === 'run' ? 'primary' : 'secondary'}
            onClick={() => setMode('run')}
            disabled={!hasWorkflowRun}
          />
          <Button
            title="Ask AI"
            size="small"
            variant="secondary"
            onClick={openAskAiWithRunContext}
          />
          <Button
            title="Open full workflow"
            size="small"
            variant="secondary"
            onClick={() =>
              navigate(
                getAppPath(AppPath.RecordShowPage, {
                  objectNameSingular: 'workflow',
                  objectRecordId: workflowId,
                }),
              )
            }
          />
        </StyledModeToggle>
        <StyledHint>
          {mode === 'definition'
            ? `Editing run graph${projectOutreachWorkflowId ? ' (Project-bound)' : ''}. Click a node to edit; Ask AI uses the context below.`
            : 'Run status on nodes. Click a node for step input/output in the right drawer.'}
        </StyledHint>
      </StyledToolbar>
      <StyledContext>{contextPrompt}</StyledContext>
      <StyledCanvas>
        {mode === 'run' && hasWorkflowRun && workflowRunId ? (
          runsLoading ? (
            <StyledEmpty>
              <Loader /> Loading run…
            </StyledEmpty>
          ) : (
            <GtmWorkflowRunDiagramEmbed workflowRunId={workflowRunId} />
          )
        ) : (
          <GtmWorkflowDiagramEmbed workflowId={workflowId} />
        )}
      </StyledCanvas>
    </StyledPanel>
  );
};
