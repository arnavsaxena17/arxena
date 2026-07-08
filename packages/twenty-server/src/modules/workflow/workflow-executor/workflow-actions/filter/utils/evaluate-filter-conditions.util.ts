import {
  isNonEmptyArray,
  isNonEmptyString,
  isObject,
  isString,
} from '@sniptt/guards';
import {
  isDefined,
  type StepFilter,
  type StepFilterGroup,
  ViewFilterOperand,
} from 'twenty-shared';

export type ResolvedFilter = Omit<
  StepFilter,
  'value' | 'stepOutputKey'
> & {
  rightOperand: unknown;
  leftOperand: unknown;
};

const parseBooleanFromValue = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
};

const isNotEmptyTextOrArray = (value: unknown): boolean => {
  return isNonEmptyString(value) || isNonEmptyArray(value);
};

const contains = (leftValue: unknown, rightValue: unknown): boolean => {
  if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
    return leftValue.some((item) => rightValue.includes(item));
  }

  if (
    (Array.isArray(leftValue) || isString(leftValue)) &&
    isString(rightValue)
  ) {
    try {
      const parsedRightValue = JSON.parse(rightValue as string);

      if (Array.isArray(parsedRightValue)) {
        return parsedRightValue.some((item) =>
          (leftValue as unknown[]).includes(item),
        );
      }

      return (leftValue as string).includes(parsedRightValue);
    } catch {
      return (leftValue as string).includes(rightValue);
    }
  }

  return String(leftValue).includes(String(rightValue));
};

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (isString(value) || typeof value === 'number') {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const isSameCalendarDay = (left: Date, right: Date): boolean => {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
};

const evaluateDateFilter = (filter: ResolvedFilter): boolean => {
  if (filter.operand === ViewFilterOperand.IS_EMPTY) {
    return !isDefined(filter.leftOperand) || filter.leftOperand === '';
  }

  if (filter.operand === ViewFilterOperand.IS_NOT_EMPTY) {
    return isDefined(filter.leftOperand) && filter.leftOperand !== '';
  }

  const leftDate = parseDateValue(filter.leftOperand);

  if (!isDefined(leftDate)) {
    return false;
  }

  const now = new Date();

  switch (filter.operand) {
    case ViewFilterOperand.IS: {
      const rightDate = parseDateValue(filter.rightOperand);

      return isDefined(rightDate) && isSameCalendarDay(leftDate, rightDate);
    }
    case ViewFilterOperand.IS_IN_PAST:
      return leftDate.getTime() < now.getTime();
    case ViewFilterOperand.IS_IN_FUTURE:
      return leftDate.getTime() > now.getTime();
    case ViewFilterOperand.IS_TODAY:
      return isSameCalendarDay(leftDate, now);
    case ViewFilterOperand.IS_BEFORE: {
      const rightDate = parseDateValue(filter.rightOperand);

      return (
        isDefined(rightDate) && leftDate.getTime() < rightDate.getTime()
      );
    }
    case ViewFilterOperand.IS_AFTER: {
      const rightDate = parseDateValue(filter.rightOperand);

      return (
        isDefined(rightDate) && leftDate.getTime() > rightDate.getTime()
      );
    }
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for date filter`,
      );
  }
};

const evaluateNumberFilter = (filter: ResolvedFilter): boolean => {
  const leftValue = filter.leftOperand;
  const rightValue = filter.rightOperand;

  switch (filter.operand) {
    case ViewFilterOperand.GREATER_THAN_OR_EQUAL:
      return Number(leftValue) >= Number(rightValue);
    case ViewFilterOperand.LESS_THAN_OR_EQUAL:
      return Number(leftValue) <= Number(rightValue);
    case ViewFilterOperand.IS_EMPTY:
      return !isDefined(filter.leftOperand) || filter.leftOperand === '';
    case ViewFilterOperand.IS_NOT_EMPTY:
      return isDefined(filter.leftOperand) && filter.leftOperand !== '';
    case ViewFilterOperand.IS:
      return Number(leftValue) === Number(rightValue);
    case ViewFilterOperand.IS_NOT:
      return Number(leftValue) !== Number(rightValue);
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for number filter`,
      );
  }
};

const evaluateRelationFilter = (filter: ResolvedFilter): boolean => {
  const leftValue =
    isObject(filter.leftOperand) && 'id' in filter.leftOperand
      ? (filter.leftOperand as { id: unknown }).id
      : filter.leftOperand;

  const rightValue =
    isObject(filter.rightOperand) && 'id' in filter.rightOperand
      ? (filter.rightOperand as { id: unknown }).id
      : filter.rightOperand;

  switch (filter.operand) {
    case ViewFilterOperand.IS:
      return leftValue === rightValue;
    case ViewFilterOperand.IS_NOT:
      return leftValue !== rightValue;
    case ViewFilterOperand.IS_EMPTY:
      return !isNonEmptyString(leftValue);
    case ViewFilterOperand.IS_NOT_EMPTY:
      return isNonEmptyString(leftValue);
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for relation filter`,
      );
  }
};

const evaluateBooleanFilter = (filter: ResolvedFilter): boolean => {
  switch (filter.operand) {
    case ViewFilterOperand.IS:
      return (
        parseBooleanFromValue(filter.leftOperand) ===
        parseBooleanFromValue(filter.rightOperand)
      );
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for boolean filter`,
      );
  }
};

const evaluateDefaultFilter = (filter: ResolvedFilter): boolean => {
  const leftValue = filter.leftOperand;
  const rightValue = filter.rightOperand;

  switch (filter.operand) {
    case ViewFilterOperand.IS:
      return leftValue == rightValue;
    case ViewFilterOperand.IS_NOT:
      return leftValue != rightValue;
    case ViewFilterOperand.IS_EMPTY:
      return !isNotEmptyTextOrArray(leftValue);
    case ViewFilterOperand.IS_NOT_EMPTY:
      return isNotEmptyTextOrArray(leftValue);
    case ViewFilterOperand.CONTAINS:
      return contains(leftValue, rightValue);
    case ViewFilterOperand.DOES_NOT_CONTAIN:
      return !contains(leftValue, rightValue);
    case ViewFilterOperand.GREATER_THAN_OR_EQUAL:
      return Number(leftValue) >= Number(rightValue);
    case ViewFilterOperand.LESS_THAN_OR_EQUAL:
      return Number(leftValue) <= Number(rightValue);
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for ${filter.type} filter type`,
      );
  }
};

const evaluateTextAndArrayFilter = (filter: ResolvedFilter): boolean => {
  switch (filter.operand) {
    case ViewFilterOperand.CONTAINS:
      return contains(filter.leftOperand, filter.rightOperand);
    case ViewFilterOperand.DOES_NOT_CONTAIN:
      return !contains(filter.leftOperand, filter.rightOperand);
    case ViewFilterOperand.IS:
      return contains(filter.leftOperand, filter.rightOperand);
    case ViewFilterOperand.IS_NOT:
      return !contains(filter.leftOperand, filter.rightOperand);
    case ViewFilterOperand.IS_EMPTY:
      return !isNotEmptyTextOrArray(filter.leftOperand);
    case ViewFilterOperand.IS_NOT_EMPTY:
      return isNotEmptyTextOrArray(filter.leftOperand);
    default:
      throw new Error(
        `Operand ${filter.operand} not supported for this filter type`,
      );
  }
};

const evaluateFilter = (filter: ResolvedFilter): boolean => {
  switch (filter.type) {
    case 'NUMBER':
    case 'NUMERIC':
    case 'number':
    case 'RATING':
    case 'CURRENCY':
      return evaluateNumberFilter(filter);
    case 'DATE':
    case 'DATE_TIME':
      return evaluateDateFilter(filter);
    case 'BOOLEAN':
    case 'boolean':
      return evaluateBooleanFilter(filter);
    case 'RELATION':
      return evaluateRelationFilter(filter);
    case 'TEXT':
    case 'MULTI_SELECT':
    case 'SELECT':
    case 'EMAILS':
    case 'PHONES':
    case 'ADDRESS':
    case 'LINKS':
    case 'ARRAY':
    case 'array':
    case 'RAW_JSON':
    case 'UUID':
      return evaluateTextAndArrayFilter(filter);
    default:
      return evaluateDefaultFilter(filter);
  }
};

const evaluateFilterGroup = (
  groupId: string,
  filterGroups: StepFilterGroup[],
  filters: ResolvedFilter[],
): boolean => {
  const group = filterGroups.find((g) => g.id === groupId);

  if (!group) {
    throw new Error(`Filter group with id ${groupId} not found`);
  }

  const childGroups = filterGroups
    .filter((g) => g.parentStepFilterGroupId === groupId)
    .sort(
      (a, b) =>
        (a.positionInStepFilterGroup || 0) -
        (b.positionInStepFilterGroup || 0),
    );

  const groupFilters = filters.filter((f) => f.stepFilterGroupId === groupId);

  const filterResults = groupFilters.map((filter) => evaluateFilter(filter));

  const childGroupResults = childGroups.map((childGroup) =>
    evaluateFilterGroup(childGroup.id, filterGroups, filters),
  );

  const allResults = [...filterResults, ...childGroupResults];

  if (allResults.length === 0) {
    return true;
  }

  switch (group.logicalOperator) {
    case 'AND':
      return allResults.every((result) => result);
    case 'OR':
      return allResults.some((result) => result);
    default:
      throw new Error(`Unknown logical operator: ${group.logicalOperator}`);
  }
};

export const evaluateFilterConditions = ({
  filterGroups = [],
  filters = [],
}: {
  filterGroups?: StepFilterGroup[];
  filters?: ResolvedFilter[];
}): boolean => {
  if (filterGroups.length === 0 && filters.length === 0) {
    return true;
  }

  if (filterGroups.length > 0) {
    const groupIds = new Set(filterGroups.map((g) => g.id));

    for (const filter of filters) {
      if (!groupIds.has(filter.stepFilterGroupId)) {
        throw new Error(
          `Filter group with id ${filter.stepFilterGroupId} not found`,
        );
      }
    }
  }

  const rootGroups = filterGroups.filter((g) => !g.parentStepFilterGroupId);

  if (rootGroups.length === 0 && filters.length > 0) {
    return filters.map((filter) => evaluateFilter(filter)).every(Boolean);
  }

  return rootGroups
    .map((rootGroup) =>
      evaluateFilterGroup(rootGroup.id, filterGroups, filters),
    )
    .every(Boolean);
};
