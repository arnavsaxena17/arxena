import {
  WorkflowFilterAction,
  WorkflowStepFilter,
  WorkflowStepFilterGroup,
} from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { WorkflowStepFilterGroupEditor } from '@/workflow/workflow-steps/workflow-actions/filter-action/components/WorkflowStepFilterGroupEditor';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { isDefined } from 'twenty-shared';
import { useIcons } from 'twenty-ui';
import { v4 } from 'uuid';

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0 0 ${({ theme }) => theme.spacing(4)} 0;
`;

type WorkflowEditActionFormFilterProps = {
  action: WorkflowFilterAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowFilterAction) => void;
      };
};

export const WorkflowEditActionFormFilter = ({
  action,
  actionOptions,
}: WorkflowEditActionFormFilterProps) => {
  const theme = useTheme();
  const { getIcon } = useIcons();

  const stepFilters = action.settings.input.stepFilters ?? [];
  const stepFilterGroups = action.settings.input.stepFilterGroups ?? [];

  const [rootGroupId] = useState(() => stepFilterGroups[0]?.id ?? v4());

  const headerTitle = isDefined(action.name) ? action.name : 'Filter';
  const headerIcon = getActionIcon(action.type);

  const handleChange = (next: {
    stepFilters: WorkflowStepFilter[];
    stepFilterGroups: WorkflowStepFilterGroup[];
  }) => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          ...action.settings.input,
          stepFilters: next.stepFilters,
          stepFilterGroups: next.stepFilterGroups,
        },
      },
    });
  };

  return (
    <>
      <WorkflowStepHeader
        onTitleChange={(newName: string) => {
          if (actionOptions.readonly === true) {
            return;
          }

          actionOptions.onActionUpdate({
            ...action,
            name: newName,
          });
        }}
        Icon={getIcon(headerIcon)}
        iconColor={theme.color.gray}
        initialTitle={headerTitle}
        headerType="Filter"
        disabled={actionOptions.readonly}
      />
      <WorkflowStepBody>
        <StyledDescription>
          The workflow continues only when the incoming data matches the
          configured conditions. Otherwise this branch stops.
        </StyledDescription>
        <WorkflowStepFilterGroupEditor
          stepFilters={stepFilters}
          stepFilterGroups={stepFilterGroups}
          groupId={rootGroupId}
          readonly={actionOptions.readonly}
          onChange={handleChange}
        />
      </WorkflowStepBody>
    </>
  );
};
