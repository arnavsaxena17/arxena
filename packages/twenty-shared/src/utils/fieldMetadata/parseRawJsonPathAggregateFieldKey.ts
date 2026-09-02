import { AggregateOperations, FieldMetadataType } from '@/types';
import { capitalize } from '@/utils/strings/capitalize';
import { isAllowedRawJsonPathKey } from '@/utils/fieldMetadata/isAllowedRawJsonPathKey';

const RAW_JSON_PATH_AGGREGATE_OPERATION_PREFIXES: {
  prefix: string;
  operation: AggregateOperations;
}[] = [
  { prefix: 'countUniqueValues', operation: AggregateOperations.COUNT_UNIQUE_VALUES },
  { prefix: 'countNotEmpty', operation: AggregateOperations.COUNT_NOT_EMPTY },
  { prefix: 'countEmpty', operation: AggregateOperations.COUNT_EMPTY },
  {
    prefix: 'percentageNotEmpty',
    operation: AggregateOperations.PERCENTAGE_NOT_EMPTY,
  },
  { prefix: 'percentageEmpty', operation: AggregateOperations.PERCENTAGE_EMPTY },
  { prefix: 'countTrue', operation: AggregateOperations.COUNT_TRUE },
  { prefix: 'countFalse', operation: AggregateOperations.COUNT_FALSE },
  { prefix: 'avg', operation: AggregateOperations.AVG },
  { prefix: 'min', operation: AggregateOperations.MIN },
  { prefix: 'max', operation: AggregateOperations.MAX },
  { prefix: 'sum', operation: AggregateOperations.SUM },
];

export type ParsedRawJsonPathAggregateFieldKey = {
  fromField: string;
  fromFieldType: FieldMetadataType.RAW_JSON;
  fromJsonPath: string;
  aggregateOperation: AggregateOperations;
};

export const parseRawJsonPathAggregateFieldKey = ({
  aggregateFieldKey,
  rawJsonFieldNames,
}: {
  aggregateFieldKey: string;
  rawJsonFieldNames: string[];
}): ParsedRawJsonPathAggregateFieldKey | null => {
  for (const rawJsonFieldName of rawJsonFieldNames) {
    const fieldSuffix = capitalize(rawJsonFieldName);

    for (const { prefix, operation } of RAW_JSON_PATH_AGGREGATE_OPERATION_PREFIXES) {
      const operationPrefix = `${prefix}${fieldSuffix}`;

      if (!aggregateFieldKey.startsWith(operationPrefix)) {
        continue;
      }

      const jsonPathCapitalized = aggregateFieldKey.slice(operationPrefix.length);

      if (jsonPathCapitalized.length === 0) {
        continue;
      }

      const jsonPath =
        jsonPathCapitalized.charAt(0).toLowerCase() +
        jsonPathCapitalized.slice(1);

      if (!isAllowedRawJsonPathKey(jsonPath)) {
        continue;
      }

      return {
        fromField: rawJsonFieldName,
        fromFieldType: FieldMetadataType.RAW_JSON,
        fromJsonPath: jsonPath,
        aggregateOperation: operation,
      };
    }
  }

  return null;
};
