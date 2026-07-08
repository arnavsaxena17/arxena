import { type StepFilter, type StepFilterGroup } from 'twenty-shared';

import { resolveInput } from 'src/modules/workflow/workflow-executor/utils/variable-resolver.util';
import { evaluateFilterConditions } from 'src/modules/workflow/workflow-executor/workflow-actions/filter/utils/evaluate-filter-conditions.util';

export const evaluateStepFilters = ({
  stepFilters,
  stepFilterGroups,
  context,
}: {
  stepFilters: StepFilter[];
  stepFilterGroups: StepFilterGroup[];
  context: Record<string, unknown>;
}): boolean => {
  const resolvedFilters = stepFilters.map((filter) => ({
    ...filter,
    rightOperand: resolveInput(filter.value, context),
    leftOperand: resolveInput(filter.stepOutputKey, context),
  }));

  return evaluateFilterConditions({
    filterGroups: stepFilterGroups,
    filters: resolvedFilters,
  });
};
