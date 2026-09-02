import { GraphQLFloat, GraphQLInt } from 'graphql';
import { AggregateOperations, FieldMetadataType } from 'twenty-shared/types';
import { isDefined, parseRawJsonPathAggregateFieldKey } from 'twenty-shared/utils';

import { type GraphqlQuerySelectedFieldsResult } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields.parser';
import {
  type AggregationField,
  getAvailableAggregationsFromObjectFields,
} from 'src/engine/api/graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

export class GraphqlQuerySelectedFieldsAggregateParser {
  parse(
    // oxlint-disable-next-line typescript/no-explicit-any
    graphqlSelectedFields: Partial<Record<string, any>>,
    flatObjectMetadata: FlatObjectMetadata,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
    accumulator: GraphqlQuerySelectedFieldsResult,
  ): void {
    const fields = flatObjectMetadata.fieldIds
      .map((id) =>
        findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: id,
          flatEntityMaps: flatFieldMetadataMaps,
        }),
      )
      .filter(isDefined);

    const availableAggregations: Record<string, AggregationField> =
      getAvailableAggregationsFromObjectFields(fields);

    const rawJsonFieldNames = fields
      .filter((field) => field.type === FieldMetadataType.RAW_JSON)
      .map((field) => field.name);

    for (const selectedField of Object.keys(graphqlSelectedFields)) {
      const selectedAggregation = availableAggregations[selectedField];

      if (selectedAggregation) {
        accumulator.aggregate[selectedField] = selectedAggregation;
        continue;
      }

      const rawJsonPathAggregation = parseRawJsonPathAggregateFieldKey({
        aggregateFieldKey: selectedField,
        rawJsonFieldNames,
      });

      if (!rawJsonPathAggregation) {
        continue;
      }

      accumulator.aggregate[selectedField] = {
        type:
          rawJsonPathAggregation.aggregateOperation ===
            AggregateOperations.COUNT_NOT_EMPTY ||
          rawJsonPathAggregation.aggregateOperation ===
            AggregateOperations.COUNT_EMPTY ||
          rawJsonPathAggregation.aggregateOperation ===
            AggregateOperations.COUNT_UNIQUE_VALUES
            ? GraphQLInt
            : GraphQLFloat,
        description: `${rawJsonPathAggregation.aggregateOperation} on ${rawJsonPathAggregation.fromField}.${rawJsonPathAggregation.fromJsonPath}`,
        fromField: rawJsonPathAggregation.fromField,
        fromFieldType: rawJsonPathAggregation.fromFieldType,
        fromJsonPath: rawJsonPathAggregation.fromJsonPath,
        aggregateOperation: rawJsonPathAggregation.aggregateOperation,
      };
    }
  }
}
