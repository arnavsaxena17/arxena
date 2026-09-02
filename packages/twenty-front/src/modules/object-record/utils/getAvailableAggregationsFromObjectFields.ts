import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isHiddenSystemField } from '@/object-metadata/utils/isHiddenSystemField';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';
import { DateAggregateOperations } from '@/object-record/record-table/constants/DateAggregateOperations';
import { type ExtendedAggregateOperations } from '@/object-record/record-table/types/ExtendedAggregateOperations';
import { FIELD_FOR_TOTAL_COUNT_AGGREGATE_OPERATION } from 'twenty-shared/constants';
import {
  buildRawJsonPathAggregateFieldKey,
  capitalize,
  getKnownRawJsonPathKeysForField,
  isFieldMetadataDateKind,
  isRawJsonNumericPathKey,
} from 'twenty-shared/utils';
import { FieldMetadataType } from '~/generated-metadata/graphql';

type NameForAggregation = {
  [T in ExtendedAggregateOperations]?: string;
};

type Aggregations = {
  [key: string]: NameForAggregation;
};

const addRawJsonPathAggregations = ({
  aggregations,
  fieldName,
}: {
  aggregations: Aggregations;
  fieldName: string;
}) => {
  const jsonPaths = getKnownRawJsonPathKeysForField(fieldName);

  if (!jsonPaths) {
    return;
  }

  for (const jsonPath of jsonPaths) {
    const pathKey = `${fieldName}.${jsonPath}`;

    aggregations[pathKey] = {
      [AggregateOperations.COUNT_UNIQUE_VALUES]:
        buildRawJsonPathAggregateFieldKey({
          aggregateOperation: AggregateOperations.COUNT_UNIQUE_VALUES,
          fieldName,
          jsonPath,
        }),
      [AggregateOperations.COUNT_EMPTY]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.COUNT_EMPTY,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.COUNT_NOT_EMPTY]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.PERCENTAGE_EMPTY]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.PERCENTAGE_EMPTY,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.PERCENTAGE_NOT_EMPTY]:
        buildRawJsonPathAggregateFieldKey({
          aggregateOperation: AggregateOperations.PERCENTAGE_NOT_EMPTY,
          fieldName,
          jsonPath,
        }),
      [AggregateOperations.COUNT]: 'totalCount',
    };

    if (!isRawJsonNumericPathKey(jsonPath)) {
      continue;
    }

    aggregations[pathKey] = {
      ...aggregations[pathKey],
      [AggregateOperations.MIN]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.MIN,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.MAX]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.MAX,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.AVG]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.AVG,
        fieldName,
        jsonPath,
      }),
      [AggregateOperations.SUM]: buildRawJsonPathAggregateFieldKey({
        aggregateOperation: AggregateOperations.SUM,
        fieldName,
        jsonPath,
      }),
    };
  }
};

export const getAvailableAggregationsFromObjectFields = (
  fields: FieldMetadataItem[],
): Aggregations => {
  return fields.reduce<Record<string, NameForAggregation>>(
    (acc, field) => {
      if (isHiddenSystemField(field)) {
        return acc;
      }

      if (field.type === FieldMetadataType.RELATION) {
        acc[field.name] = {
          [AggregateOperations.COUNT]: 'totalCount',
        };
        return acc;
      }

      acc[field.name] = {
        [AggregateOperations.COUNT_UNIQUE_VALUES]: `countUniqueValues${capitalize(field.name)}`,
        [AggregateOperations.COUNT_EMPTY]: `countEmpty${capitalize(field.name)}`,
        [AggregateOperations.COUNT_NOT_EMPTY]: `countNotEmpty${capitalize(field.name)}`,
        [AggregateOperations.PERCENTAGE_EMPTY]: `percentageEmpty${capitalize(field.name)}`,
        [AggregateOperations.PERCENTAGE_NOT_EMPTY]: `percentageNotEmpty${capitalize(field.name)}`,
        [AggregateOperations.COUNT]: 'totalCount',
      };

      if (field.type === FieldMetadataType.NUMBER) {
        acc[field.name] = {
          ...acc[field.name],
          [AggregateOperations.MIN]: `min${capitalize(field.name)}`,
          [AggregateOperations.MAX]: `max${capitalize(field.name)}`,
          [AggregateOperations.AVG]: `avg${capitalize(field.name)}`,
          [AggregateOperations.SUM]: `sum${capitalize(field.name)}`,
        };
      }

      if (field.type === FieldMetadataType.CURRENCY) {
        acc[field.name] = {
          ...acc[field.name],
          [AggregateOperations.MIN]: `min${capitalize(field.name)}AmountMicros`,
          [AggregateOperations.MAX]: `max${capitalize(field.name)}AmountMicros`,
          [AggregateOperations.AVG]: `avg${capitalize(field.name)}AmountMicros`,
          [AggregateOperations.SUM]: `sum${capitalize(field.name)}AmountMicros`,
        };
      }

      if (field.type === FieldMetadataType.BOOLEAN) {
        acc[field.name] = {
          ...acc[field.name],
          [AggregateOperations.COUNT_TRUE]: `countTrue${capitalize(field.name)}`,
          [AggregateOperations.COUNT_FALSE]: `countFalse${capitalize(field.name)}`,
        };
      }

      if (isFieldMetadataDateKind(field.type) === true) {
        acc[field.name] = {
          ...acc[field.name],
          [DateAggregateOperations.EARLIEST]: `min${capitalize(field.name)}`,
          [DateAggregateOperations.LATEST]: `max${capitalize(field.name)}`,
        };
      }

      if (field.type === FieldMetadataType.RAW_JSON) {
        addRawJsonPathAggregations({
          aggregations: acc,
          fieldName: field.name,
        });
      }

      if (acc[field.name] === undefined) {
        acc[field.name] = {};
      }

      return acc;
    },
    {
      [FIELD_FOR_TOTAL_COUNT_AGGREGATE_OPERATION]: {
        [AggregateOperations.COUNT]: 'totalCount',
      },
    },
  );
};
