import { Button, IconButton } from 'twenty-ui';
import { IconPlus, IconTrash } from 'twenty-ui/icons';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import {
  createWorkflowFindRecordsFilterCondition,
  FIND_RECORDS_FILTER_OPERAND_OPTIONS,
  findRecordsFilterOperandRequiresValue,
  WorkflowFindRecordsFilterCondition,
} from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import styled from '@emotion/styled';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
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

type WorkflowFindRecordsFilterEditorProps = {
  objectNameSingular: string;
  conditions: WorkflowFindRecordsFilterCondition[];
  readonly?: boolean;
  onChange: (conditions: WorkflowFindRecordsFilterCondition[]) => void;
};

export const WorkflowFindRecordsFilterEditor = ({
  objectNameSingular,
  conditions,
  readonly,
  onChange,
}: WorkflowFindRecordsFilterEditorProps) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const fieldOptions = objectMetadataItem.fields
    .filter((field) => field.isActive)
    .map((field) => ({
      label: field.label,
      value: field.name,
    }));

  const handleAddCondition = () => {
    if (readonly === true) {
      return;
    }

    onChange([...conditions, createWorkflowFindRecordsFilterCondition()]);
  };

  const handleRemoveCondition = (conditionId: string) => {
    if (readonly === true) {
      return;
    }

    onChange(conditions.filter((condition) => condition.id !== conditionId));
  };

  const handleUpdateCondition = (
    conditionId: string,
    updates: Partial<WorkflowFindRecordsFilterCondition>,
  ) => {
    if (readonly === true) {
      return;
    }

    onChange(
      conditions.map((condition) =>
        condition.id === conditionId
          ? {
              ...condition,
              ...updates,
            }
          : condition,
      ),
    );
  };

  return (
    <StyledContainer>
      <StyledDescription>
        Define which records to find. Use workflow variables like{' '}
        {'{{trigger.recordId}}'} in values.
      </StyledDescription>

      {conditions.map((condition, index) => (
        <StyledFilterRow key={condition.id}>
          <StyledFilterRowHeader>
            <StyledFilterRowTitle>Condition {index + 1}</StyledFilterRowTitle>
            {readonly !== true && (
              <IconButton
                Icon={IconTrash}
                size="small"
                variant="tertiary"
                onClick={() => {
                  handleRemoveCondition(condition.id);
                }}
              />
            )}
          </StyledFilterRowHeader>

          <Select
            dropdownId={`workflow-find-records-filter-field-${condition.id}`}
            label="Field"
            fullWidth
            disabled={readonly}
            value={condition.fieldName}
            emptyOption={{ label: 'Select a field', value: '' }}
            options={fieldOptions}
            onChange={(fieldName) => {
              handleUpdateCondition(condition.id, { fieldName });
            }}
            withSearchInput
          />

          <Select
            dropdownId={`workflow-find-records-filter-operand-${condition.id}`}
            label="Operator"
            fullWidth
            disabled={readonly}
            value={condition.operand}
            options={FIND_RECORDS_FILTER_OPERAND_OPTIONS}
            onChange={(operand) => {
              handleUpdateCondition(condition.id, {
                operand,
                value:
                  operand === 'is'
                    ? 'NULL'
                    : findRecordsFilterOperandRequiresValue(operand)
                      ? condition.value
                      : '',
              });
            }}
          />

          {condition.operand === 'is' ? (
            <Select
              dropdownId={`workflow-find-records-filter-is-value-${condition.id}`}
              label="Null check"
              fullWidth
              disabled={readonly}
              value={condition.value}
              options={[
                { label: 'Is null', value: 'NULL' },
                { label: 'Is not null', value: 'NOT NULL' },
              ]}
              onChange={(value) => {
                handleUpdateCondition(condition.id, { value });
              }}
            />
          ) : (
            findRecordsFilterOperandRequiresValue(condition.operand) && (
              <FormTextFieldInput
                label="Value"
                placeholder={
                  condition.operand === 'in'
                    ? '["id-1", "id-2"] or {{step.result.ids}}'
                    : 'Enter value or insert a variable'
                }
                readonly={readonly}
                defaultValue={condition.value}
                onPersist={(value) => {
                  handleUpdateCondition(condition.id, { value });
                }}
                VariablePicker={WorkflowVariablePicker}
              />
            )
          )}
        </StyledFilterRow>
      ))}

      {readonly !== true && (
        <Button
          Icon={IconPlus}
          title="Add condition"
          variant="secondary"
          size="small"
          onClick={handleAddCondition}
        />
      )}
    </StyledContainer>
  );
};
