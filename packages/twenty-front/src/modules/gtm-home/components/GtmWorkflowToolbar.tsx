import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type GtmWorkflowEmbedMode } from '@/gtm-home/hooks/useGtmWorkflowEmbed';

const StyledModeToggle = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  align-items: center;
`;

const StyledSelect = styled.select`
  appearance: none;
  min-width: 160px;
  max-width: 240px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type GtmWorkflowToolbarProps = {
  mode: GtmWorkflowEmbedMode;
  onModeChange: (mode: GtmWorkflowEmbedMode) => void;
  hasWorkflowRun: boolean;
  workflowId: string | null;
  workflowOptions: Array<{ id: string; label: string }>;
  isSelectingWorkflow: boolean;
  onSelectWorkflow: (workflowId: string) => void;
};

export const GtmWorkflowToolbar = ({
  mode,
  onModeChange,
  hasWorkflowRun,
  workflowId,
  workflowOptions,
  isSelectingWorkflow,
  onSelectWorkflow,
}: GtmWorkflowToolbarProps) => {
  const navigate = useNavigate();

  if (!workflowId) {
    return null;
  }

  return (
    <StyledModeToggle>
      <Button
        title="Definition"
        size="small"
        variant={mode === 'definition' ? 'primary' : 'secondary'}
        onClick={() => onModeChange('definition')}
      />
      <Button
        title="Latest run"
        size="small"
        variant={mode === 'run' ? 'primary' : 'secondary'}
        onClick={() => onModeChange('run')}
        disabled={!hasWorkflowRun}
      />
      <Button
        title="Open"
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
      {mode === 'definition' && (
        <StyledSelect
          aria-label="Active outreach workflow"
          value={workflowId}
          disabled={isSelectingWorkflow || workflowOptions.length === 0}
          onChange={(event) => {
            const nextWorkflowId = event.target.value;

            if (!nextWorkflowId || nextWorkflowId === workflowId) {
              return;
            }

            onSelectWorkflow(nextWorkflowId);
          }}
        >
          {workflowOptions.length === 0 ? (
            <option value="">No active workflows</option>
          ) : (
            workflowOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))
          )}
        </StyledSelect>
      )}
    </StyledModeToggle>
  );
};
