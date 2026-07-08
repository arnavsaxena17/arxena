import {
  WorkflowIfElseAction,
  WorkflowIfElseBranch,
  WorkflowStepFilter,
  WorkflowStepFilterGroup,
} from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { WorkflowStepFilterGroupEditor } from '@/workflow/workflow-steps/workflow-actions/filter-action/components/WorkflowStepFilterGroupEditor';
import { createStepFilterGroup } from '@/workflow/workflow-steps/workflow-actions/filter-action/utils/workflowStepFilterUtils';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { isDefined } from 'twenty-shared';
import { Button, IconPlus, IconTrash, IconButton, useIcons } from 'twenty-ui';
import { v4 } from 'uuid';

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0 0 ${({ theme }) => theme.spacing(4)} 0;
`;

const StyledBranch = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  row-gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledBranchHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledBranchTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledElseBranch = styled.div`
  border: 1px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

type WorkflowEditActionFormIfElseProps = {
  action: WorkflowIfElseAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowIfElseAction) => void;
      };
};

const getBranchTitle = (branchIndex: number): string =>
  branchIndex === 0 ? 'If' : 'Else if';

export const WorkflowEditActionFormIfElse = ({
  action,
  actionOptions,
}: WorkflowEditActionFormIfElseProps) => {
  const theme = useTheme();
  const { getIcon } = useIcons();

  const branches = action.settings.input.branches ?? [];
  const stepFilters = action.settings.input.stepFilters ?? [];
  const stepFilterGroups = action.settings.input.stepFilterGroups ?? [];

  const conditionalBranches = branches.filter((branch) =>
    isDefined(branch.filterGroupId),
  );
  const elseBranch = branches.find(
    (branch) => !isDefined(branch.filterGroupId),
  );

  const headerTitle = isDefined(action.name) ? action.name : 'If/Else';
  const headerIcon = getActionIcon(action.type);

  const persist = ({
    nextBranches,
    nextStepFilters,
    nextStepFilterGroups,
  }: {
    nextBranches: WorkflowIfElseBranch[];
    nextStepFilters: WorkflowStepFilter[];
    nextStepFilterGroups: WorkflowStepFilterGroup[];
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
          branches: nextBranches,
          stepFilters: nextStepFilters,
          stepFilterGroups: nextStepFilterGroups,
        },
      },
    });
  };

  const handleAddBranch = () => {
    if (actionOptions.readonly === true) {
      return;
    }

    const newGroup = createStepFilterGroup({
      positionInStepFilterGroup: stepFilterGroups.length,
    });

    const newBranch: WorkflowIfElseBranch = {
      id: v4(),
      nextStepIds: [],
      filterGroupId: newGroup.id,
    };

    const nextGroups = [...stepFilterGroups, newGroup];

    if (isDefined(elseBranch)) {
      persist({
        nextBranches: [...conditionalBranches, newBranch, elseBranch],
        nextStepFilters: stepFilters,
        nextStepFilterGroups: nextGroups,
      });

      return;
    }

    const newElseBranch: WorkflowIfElseBranch = {
      id: v4(),
      nextStepIds: [],
    };

    persist({
      nextBranches: [...conditionalBranches, newBranch, newElseBranch],
      nextStepFilters: stepFilters,
      nextStepFilterGroups: nextGroups,
    });
  };

  const handleRemoveBranch = (branch: WorkflowIfElseBranch) => {
    if (actionOptions.readonly === true || !isDefined(branch.filterGroupId)) {
      return;
    }

    const remainingConditionalBranches = conditionalBranches.filter(
      (currentBranch) => currentBranch.id !== branch.id,
    );

    const nextBranches =
      remainingConditionalBranches.length > 0 && isDefined(elseBranch)
        ? [...remainingConditionalBranches, elseBranch]
        : remainingConditionalBranches;

    persist({
      nextBranches,
      nextStepFilters: stepFilters.filter(
        (filter) => filter.stepFilterGroupId !== branch.filterGroupId,
      ),
      nextStepFilterGroups: stepFilterGroups.filter(
        (group) => group.id !== branch.filterGroupId,
      ),
    });
  };

  const handleGroupChange = (next: {
    stepFilters: WorkflowStepFilter[];
    stepFilterGroups: WorkflowStepFilterGroup[];
  }) => {
    persist({
      nextBranches: branches,
      nextStepFilters: next.stepFilters,
      nextStepFilterGroups: next.stepFilterGroups,
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
        headerType="If/Else"
        disabled={actionOptions.readonly}
      />
      <WorkflowStepBody>
        <StyledDescription>
          Routes the workflow into different branches depending on whether the
          configured conditions match. The Else branch runs when no condition
          matches.
        </StyledDescription>

        {conditionalBranches.map((branch, branchIndex) => (
          <StyledBranch key={branch.id}>
            <StyledBranchHeader>
              <StyledBranchTitle>
                {getBranchTitle(branchIndex)}
              </StyledBranchTitle>
              {actionOptions.readonly !== true ? (
                <IconButton
                  Icon={IconTrash}
                  size="small"
                  ariaLabel="Remove branch"
                  onClick={() => handleRemoveBranch(branch)}
                />
              ) : null}
            </StyledBranchHeader>

            {isDefined(branch.filterGroupId) ? (
              <WorkflowStepFilterGroupEditor
                stepFilters={stepFilters}
                stepFilterGroups={stepFilterGroups}
                groupId={branch.filterGroupId}
                readonly={actionOptions.readonly}
                onChange={handleGroupChange}
              />
            ) : null}
          </StyledBranch>
        ))}

        {isDefined(elseBranch) ? (
          <StyledElseBranch>
            Else - runs when none of the conditions above match.
          </StyledElseBranch>
        ) : null}

        {actionOptions.readonly !== true ? (
          <Button
            Icon={IconPlus}
            title="Add branch"
            variant="secondary"
            size="small"
            onClick={handleAddBranch}
          />
        ) : null}
      </WorkflowStepBody>
    </>
  );
};
