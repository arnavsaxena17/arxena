import { GraphQLISODateTime } from '@nestjs/graphql';

import { GraphQLFloat, GraphQLInt, type GraphQLScalarType } from 'graphql';
import { FIELD_FOR_TOTAL_COUNT_AGGREGATE_OPERATION } from 'twenty-shared/constants';
import { AggregateOperations, FieldMetadataType } from 'twenty-shared/types';
import {
  buildRawJsonPathAggregateFieldKey,
  capitalize,
  getKnownRawJsonPathKeysForField,
  isFieldMetadataDateKind,
  isRawJsonNumericPathKey,
} from 'twenty-shared/utils';

import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getSubfieldsForAggregateOperation } from 'src/engine/twenty-orm/utils/get-subfields-for-aggregate-operation.util';

export type AggregationField = {
  type: GraphQLScalarType;
  description: string;
  fromField: string;
  fromFieldType: FieldMetadataType;
  fromSubFields?: string[];
  subFieldForNumericOperation?: string;
  fromJsonPath?: string;
  aggregateOperation: AggregateOperations;
};

const addRawJsonPathAggregations = ({
  acc,
  field,
}: {
  acc: Record<string, AggregationField>;
  field: FlatFieldMetadata;
}) => {
  const jsonPaths = getKnownRawJsonPathKeysForField(field.name);

  if (!jsonPaths) {
    return;
  }

  for (const jsonPath of jsonPaths) {
    const countEmptyKey = buildRawJsonPathAggregateFieldKey({
      aggregateOperation: AggregateOperations.COUNT_EMPTY,
      fieldName: field.name,
      jsonPath,
    });
    const countNotEmptyKey = buildRawJsonPathAggregateFieldKey({
      aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
      fieldName: field.name,
      jsonPath,
    });
    const countUniqueValuesKey = buildRawJsonPathAggregateFieldKey({
      aggregateOperation: AggregateOperations.COUNT_UNIQUE_VALUES,
      fieldName: field.name,
      jsonPath,
    });
    const percentageEmptyKey = buildRawJsonPathAggregateFieldKey({
      aggregateOperation: AggregateOperations.PERCENTAGE_EMPTY,
      fieldName: field.name,
      jsonPath,
    });
    const percentageNotEmptyKey = buildRawJsonPathAggregateFieldKey({
      aggregateOperation: AggregateOperations.PERCENTAGE_NOT_EMPTY,
      fieldName: field.name,
      jsonPath,
    });

    acc[countEmptyKey] = {
      type: GraphQLInt,
      description: `Number of empty values for ${field.name}.${jsonPath}`,
      fromField: field.name,
      fromFieldType: FieldMetadataType.RAW_JSON,
      fromJsonPath: jsonPath,
      aggregateOperation: AggregateOperations.COUNT_EMPTY,
    };

    acc[countNotEmptyKey] = {
      type: GraphQLInt,
      description: `Number of non-empty values for ${field.name}.${jsonPath}`,
      fromField: field.name,
      fromFieldType: FieldMetadataType.RAW_JSON,
      fromJsonPath: jsonPath,
      aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
    };

    acc[countUniqueValuesKey] = {
      type: GraphQLInt,
      description: `Number of unique values for ${field.name}.${jsonPath}`,
      fromField: field.name,
      fromFieldType: FieldMetadataType.RAW_JSON,
      fromJsonPath: jsonPath,
      aggregateOperation: AggregateOperations.COUNT_UNIQUE_VALUES,
    };

    acc[percentageEmptyKey] = {
      type: GraphQLFloat,
      description: `Percentage of empty values for ${field.name}.${jsonPath}`,
      fromField: field.name,
      fromFieldType: FieldMetadataType.RAW_JSON,
      fromJsonPath: jsonPath,
      aggregateOperation: AggregateOperations.PERCENTAGE_EMPTY,
    };

    acc[percentageNotEmptyKey] = {
      type: GraphQLFloat,
      description: `Percentage of non-empty values for ${field.name}.${jsonPath}`,
      fromField: field.name,
      fromFieldType: FieldMetadataType.RAW_JSON,
      fromJsonPath: jsonPath,
      aggregateOperation: AggregateOperations.PERCENTAGE_NOT_EMPTY,
    };

    if (!isRawJsonNumericPathKey(jsonPath)) {
      continue;
    }

    for (const aggregateOperation of [
      AggregateOperations.MIN,
      AggregateOperations.MAX,
      AggregateOperations.AVG,
      AggregateOperations.SUM,
    ] as const) {
      const aggregateFieldKey = buildRawJsonPathAggregateFieldKey({
        aggregateOperation,
        fieldName: field.name,
        jsonPath,
      });

      acc[aggregateFieldKey] = {
        type: GraphQLFloat,
        description: `${aggregateOperation} of ${field.name}.${jsonPath}`,
        fromField: field.name,
        fromFieldType: FieldMetadataType.RAW_JSON,
        fromJsonPath: jsonPath,
        aggregateOperation,
      };
    }
  }
};

export const getAvailableAggregationsFromObjectFields = (
  fields: FlatFieldMetadata[],
): Record<string, AggregationField> => {
  return fields.reduce<Record<string, AggregationField>>(
    (acc, field) => {
      if (field.type === FieldMetadataType.RELATION) {
        return acc;
      }

      const fromSubFields = getSubfieldsForAggregateOperation(field.type);

      acc[`countUniqueValues${capitalize(field.name)}`] = {
        type: GraphQLInt,
        description: `Number of unique values for ${field.name}`,
        fromField: field.name,
        fromFieldType: field.type,
        fromSubFields,
        aggregateOperation: AggregateOperations.COUNT_UNIQUE_VALUES,
      };

      acc[`countEmpty${capitalize(field.name)}`] = {
        type: GraphQLInt,
        description: `Number of empty values for ${field.name}`,
        fromField: field.name,
        fromFieldType: field.type,
        fromSubFields,
        aggregateOperation: AggregateOperations.COUNT_EMPTY,
      };

      acc[`countNotEmpty${capitalize(field.name)}`] = {
        type: GraphQLInt,
        description: `Number of non-empty values for ${field.name}`,
        fromField: field.name,
        fromFieldType: field.type,
        fromSubFields,
        aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
      };

      acc[`percentageEmpty${capitalize(field.name)}`] = {
        type: GraphQLFloat,
        description: `Percentage of empty values for ${field.name}`,
        fromField: field.name,
        fromFieldType: field.type,
        fromSubFields,
        aggregateOperation: AggregateOperations.PERCENTAGE_EMPTY,
      };

      acc[`percentageNotEmpty${capitalize(field.name)}`] = {
        type: GraphQLFloat,
        description: `Percentage of non-empty values for ${field.name}`,
        fromField: field.name,
        fromFieldType: field.type,
        fromSubFields,
        aggregateOperation: AggregateOperations.PERCENTAGE_NOT_EMPTY,
      };

      if (isFieldMetadataDateKind(field.type)) {
        acc[`min${capitalize(field.name)}`] = {
          type: GraphQLISODateTime,
          description: `Earliest date contained in the field ${field.name}`,
          fromField: field.name,
          fromFieldType: field.type,
          aggregateOperation: AggregateOperations.MIN,
        };

        acc[`max${capitalize(field.name)}`] = {
          type: GraphQLISODateTime,
          description: `Latest date contained in the field ${field.name}`,
          fromField: field.name,
          fromFieldType: field.type,
          aggregateOperation: AggregateOperations.MAX,
        };
      }

      switch (field.type) {
        case FieldMetadataType.BOOLEAN:
          acc[`countTrue${capitalize(field.name)}`] = {
            type: GraphQLInt,
            description: `Count of true values in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.COUNT_TRUE,
          };

          acc[`countFalse${capitalize(field.name)}`] = {
            type: GraphQLInt,
            description: `Count of false values in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.COUNT_FALSE,
          };
          break;

        case FieldMetadataType.NUMBER:
          acc[`min${capitalize(field.name)}`] = {
            type: GraphQLFloat,
            description: `Minimum amount contained in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.MIN,
          };

          acc[`max${capitalize(field.name)}`] = {
            type: GraphQLFloat,
            description: `Maximum amount contained in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.MAX,
          };

          acc[`avg${capitalize(field.name)}`] = {
            type: GraphQLFloat,
            description: `Average amount contained in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.AVG,
          };

          acc[`sum${capitalize(field.name)}`] = {
            type: GraphQLFloat,
            description: `Sum of amounts contained in the field ${field.name}`,
            fromField: field.name,
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.SUM,
          };
          break;
        case FieldMetadataType.CURRENCY:
          acc[`min${capitalize(field.name)}AmountMicros`] = {
            type: GraphQLFloat,
            description: `Minimum amount contained in the field ${field.name}`,
            fromField: field.name,
            fromSubFields: getSubfieldsForAggregateOperation(field.type),
            subFieldForNumericOperation: 'amountMicros',
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.MIN,
          };

          acc[`max${capitalize(field.name)}AmountMicros`] = {
            type: GraphQLFloat,
            description: `Maximal amount contained in the field ${field.name}`,
            fromField: field.name,
            fromSubFields: getSubfieldsForAggregateOperation(field.type),
            subFieldForNumericOperation: 'amountMicros',
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.MAX,
          };

          acc[`sum${capitalize(field.name)}AmountMicros`] = {
            type: GraphQLFloat,
            description: `Sum of amounts contained in the field ${field.name}`,
            fromField: field.name,
            fromSubFields: getSubfieldsForAggregateOperation(field.type),
            subFieldForNumericOperation: 'amountMicros',
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.SUM,
          };

          acc[`avg${capitalize(field.name)}AmountMicros`] = {
            type: GraphQLFloat,
            description: `Average amount contained in the field ${field.name}`,
            fromField: field.name,
            fromSubFields: getSubfieldsForAggregateOperation(field.type),
            subFieldForNumericOperation: 'amountMicros',
            fromFieldType: field.type,
            aggregateOperation: AggregateOperations.AVG,
          };
          break;
        case FieldMetadataType.RAW_JSON:
          addRawJsonPathAggregations({ acc, field });
          break;
      }

      return acc;
    },
    {
      totalCount: {
        type: GraphQLInt,
        description: `Total number of records in the connection`,
        fromField: FIELD_FOR_TOTAL_COUNT_AGGREGATE_OPERATION,
        fromFieldType: FieldMetadataType.UUID,
        aggregateOperation: AggregateOperations.COUNT,
      },
    },
  );
};
