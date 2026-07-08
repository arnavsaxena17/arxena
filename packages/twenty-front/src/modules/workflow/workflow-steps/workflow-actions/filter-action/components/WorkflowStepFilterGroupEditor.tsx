import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import {
  WorkflowStepFilter,
  WorkflowStepFilterGroup,
} from '@/workflow/types/Workflow';
import {
  STEP_FILTER_OPERAND_OPTIONS,
  stepFilterOperandRequiresValue,
} from '@/workflow/workflow-steps/workflow-actions/filter-action/constants/StepFilterOperandOptions';
import {
  createStepFilter,
  createStepFilterGroup,
  getStepFiltersInGroup,
} from '@/workflow/workflow-steps/workflow-actions/filter-action/utils/workflowStepFilterUtils';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import styled from '@emotion/styled';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { Button, IconPlus, IconTrash, IconButton } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledFilterRow = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(3)};
  row-gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledFilterRowHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledFilterRowTitle = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

type WorkflowStepFilterGroupEditorProps = {
  stepFilters: WorkflowStepFilter[];
  stepFilterGroups: WorkflowStepFilterGroup[];
  groupId: string;
  readonly?: boolean;
  onChange: (next: {
    stepFilters: WorkflowStepFilter[];
    stepFilterGroups: WorkflowStepFilterGroup[];
  }) => void;
};

export const WorkflowStepFilterGroupEditor = ({
  stepFilters,
  stepFilterGroups,
  groupId,
  readonly,
  onChange,
}: WorkflowStepFilterGroupEditorProps) => {
  const group = stepFilterGroups.find(
    (currentGroup) => currentGroup.id === groupId,
  );
  const filtersInGroup = getStepFiltersInGroup({ stepFilters, groupId });

  const handleAddFilter = () => {
    if (readonly === true) {
      return;
    }

    const groupExists = stepFilterGroups.some(
      (currentGroup) => currentGroup.id === groupId,
    );

    const nextGroups = groupExists
      ? stepFilterGroups
      : [
          ...stepFilterGroups,
          createStepFilterGroup({
            id: groupId,
            positionInStepFilterGroup: stepFilterGroups.length,
          }),
        ];

    const newFilter = createStepFilter({
      stepFilterGroupId: groupId,
      positionInStepFilterGroup: filtersInGroup.length,
    });

    onChange({
      stepFilterGroups: nextGroups,
      stepFilters: [...stepFilters, newFilter],
    });
  };

  const handleRemoveFilter = (filterId: string) => {
    if (readonly === true) {
      return;
    }

    onChange({
      stepFilterGroups,
      stepFilters: stepFilters.filter((filter) => filter.id !== filterId),
    });
  };

  const handleUpdateFilter = (
    filterId: string,
    patch: Partial<WorkflowStepFilter>,
  ) => {
    if (readonly === true) {
      return;
    }

    onChange({
      stepFilterGroups,
      stepFilters: stepFilters.map((filter) =>
        filter.id === filterId ? { ...filter, ...patch } : filter,
      ),
    });
  };

  const handleChangeLogicalOperator = (logicalOperator: StepLogicalOperator) => {
    if (readonly === true) {
      return;
    }

    onChange({
      stepFilters,
      stepFilterGroups: stepFilterGroups.map((currentGroup) =>
        currentGroup.id === groupId
          ? { ...currentGroup, logicalOperator }
          : currentGroup,
      ),
    });
  };

  return (
    <StyledContainer>
      {filtersInGroup.length > 1 ? (
        <Select
          dropdownId={`step-filter-logical-operator-${groupId}`}
          value={group?.logicalOperator ?? StepLogicalOperator.AND}
          fullWidth
          options={[
            { label: 'All conditions (AND)', value: StepLogicalOperator.AND },
            { label: 'Any condition (OR)', value: StepLogicalOperator.OR },
          ]}
          onChange={(value) =>
            handleChangeLogicalOperator(value as StepLogicalOperator)
          }
          disabled={readonly}
        />
      ) : null}

      {filtersInGroup.map((filter, index) => (
        <StyledFilterRow key={filter.id}>
          <StyledFilterRowHeader>
            <StyledFilterRowTitle>{`Condition ${index + 1}`}</StyledFilterRowTitle>
            {readonly !== true ? (
              <IconButton
                Icon={IconTrash}
                size="small"
                ariaLabel="Remove condition"
                onClick={() => handleRemoveFilter(filter.id)}
              />
            ) : null}
          </StyledFilterRowHeader>

          <FormTextFieldInput
            label="Field"
            placeholder="Select a step output value"
            readonly={readonly}
            defaultValue={filter.stepOutputKey}
            onPersist={(stepOutputKey) =>
              handleUpdateFilter(filter.id, { stepOutputKey })
            }
            VariablePicker={WorkflowVariablePicker}
          />

          <Select
            dropdownId={`step-filter-operand-${filter.id}`}
            label="Condition"
            fullWidth
            value={filter.operand}
            options={STEP_FILTER_OPERAND_OPTIONS}
            onChange={(operand) =>
              handleUpdateFilter(filter.id, {
                operand: operand as ViewFilterOperand,
              })
            }
            disabled={readonly}
          />

          {stepFilterOperandRequiresValue(filter.operand) ? (
            <FormTextFieldInput
              label="Value"
              placeholder="Enter a value or select a variable"
              readonly={readonly}
              defaultValue={filter.value}
              onPersist={(value) => handleUpdateFilter(filter.id, { value })}
              VariablePicker={WorkflowVariablePicker}
            />
          ) : null}
        </StyledFilterRow>
      ))}

      {readonly !== true ? (
        <Button
          Icon={IconPlus}
          title="Add condition"
          variant="secondary"
          size="small"
          onClick={handleAddFilter}
        />
      ) : null}
    </StyledContainer>
  );
};
