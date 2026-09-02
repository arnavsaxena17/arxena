import { AggregateOperations } from '@/types';
import { capitalize } from '@/utils/strings/capitalize';

export const buildRawJsonPathAggregateFieldKey = ({
  aggregateOperation,
  fieldName,
  jsonPath,
}: {
  aggregateOperation: AggregateOperations;
  fieldName: string;
  jsonPath: string;
}): string => {
  switch (aggregateOperation) {
    case AggregateOperations.COUNT:
      return 'totalCount';
    case AggregateOperations.COUNT_UNIQUE_VALUES:
      return `countUniqueValues${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.COUNT_EMPTY:
      return `countEmpty${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.COUNT_NOT_EMPTY:
      return `countNotEmpty${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.PERCENTAGE_EMPTY:
      return `percentageEmpty${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.PERCENTAGE_NOT_EMPTY:
      return `percentageNotEmpty${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.MIN:
      return `min${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.MAX:
      return `max${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.AVG:
      return `avg${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.SUM:
      return `sum${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.COUNT_TRUE:
      return `countTrue${capitalize(fieldName)}${capitalize(jsonPath)}`;
    case AggregateOperations.COUNT_FALSE:
      return `countFalse${capitalize(fieldName)}${capitalize(jsonPath)}`;
  }
};
