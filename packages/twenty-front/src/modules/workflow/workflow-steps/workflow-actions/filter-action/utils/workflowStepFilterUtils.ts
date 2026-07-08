import {
  WorkflowStepFilter,
  WorkflowStepFilterGroup,
} from '@/workflow/types/Workflow';
import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4 } from 'uuid';

export const createStepFilterGroup = ({
  id,
  logicalOperator = StepLogicalOperator.AND,
  positionInStepFilterGroup = 0,
}: {
  id?: string;
  logicalOperator?: StepLogicalOperator;
  positionInStepFilterGroup?: number;
}): WorkflowStepFilterGroup => ({
  id: id ?? v4(),
  logicalOperator,
  positionInStepFilterGroup,
});

export const createStepFilter = ({
  stepFilterGroupId,
  positionInStepFilterGroup,
}: {
  stepFilterGroupId: string;
  positionInStepFilterGroup: number;
}): WorkflowStepFilter => ({
  id: v4(),
  type: 'default',
  stepOutputKey: '',
  operand: ViewFilterOperand.IS,
  value: '',
  stepFilterGroupId,
  positionInStepFilterGroup,
  label: '',
  displayValue: '',
});

export const getStepFiltersInGroup = ({
  stepFilters,
  groupId,
}: {
  stepFilters: WorkflowStepFilter[];
  groupId: string;
}): WorkflowStepFilter[] =>
  stepFilters
    .filter((filter) => filter.stepFilterGroupId === groupId)
    .sort(
      (a, b) =>
        (a.positionInStepFilterGroup ?? 0) - (b.positionInStepFilterGroup ?? 0),
    );
