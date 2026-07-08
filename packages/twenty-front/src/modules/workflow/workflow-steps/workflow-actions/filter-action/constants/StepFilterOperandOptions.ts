import { ViewFilterOperand } from 'twenty-shared';

export const STEP_FILTER_OPERAND_OPTIONS: Array<{
  label: string;
  value: ViewFilterOperand;
}> = [
  { label: 'Is', value: ViewFilterOperand.IS },
  { label: 'Is not', value: ViewFilterOperand.IS_NOT },
  { label: 'Contains', value: ViewFilterOperand.CONTAINS },
  { label: 'Does not contain', value: ViewFilterOperand.DOES_NOT_CONTAIN },
  {
    label: 'Greater than or equal',
    value: ViewFilterOperand.GREATER_THAN_OR_EQUAL,
  },
  { label: 'Less than or equal', value: ViewFilterOperand.LESS_THAN_OR_EQUAL },
  { label: 'Is empty', value: ViewFilterOperand.IS_EMPTY },
  { label: 'Is not empty', value: ViewFilterOperand.IS_NOT_EMPTY },
];

export const STEP_FILTER_OPERANDS_WITHOUT_VALUE: ViewFilterOperand[] = [
  ViewFilterOperand.IS_EMPTY,
  ViewFilterOperand.IS_NOT_EMPTY,
];

export const stepFilterOperandRequiresValue = (
  operand: ViewFilterOperand,
): boolean => !STEP_FILTER_OPERANDS_WITHOUT_VALUE.includes(operand);
