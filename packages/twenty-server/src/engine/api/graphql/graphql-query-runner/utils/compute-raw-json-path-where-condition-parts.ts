import { randomBytes } from 'crypto';

import { type ObjectLiteral } from 'typeorm';

import { isAllowedRawJsonPathKey } from 'twenty-shared/utils';

import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';
import { formatRawJsonPathColumnExpression } from 'src/engine/twenty-orm/utils/format-raw-json-path-column.util';

type WhereConditionParts = {
  sql: string;
  params: ObjectLiteral;
};

export const computeRawJsonPathWhereConditionParts = ({
  operator,
  objectNameSingular,
  fieldName,
  jsonPath,
  value,
}: {
  operator: string;
  objectNameSingular: string;
  fieldName: string;
  jsonPath: string;
  // oxlint-disable-next-line typescript/no-explicit-any
  value: any;
}): WhereConditionParts => {
  if (!isAllowedRawJsonPathKey(jsonPath)) {
    throw new GraphqlQueryRunnerException(
      `Invalid RAW_JSON path "${jsonPath}"`,
      GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
    );
  }

  const paramSuffix = randomBytes(5).toString('hex');
  const fieldReference = formatRawJsonPathColumnExpression({
    objectNameSingular,
    fieldName,
    jsonPath,
  });
  const numericFieldReference = `NULLIF(${fieldReference}, '')::double precision`;

  switch (operator) {
    case 'eq':
      return {
        sql: `${fieldReference} = :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: String(value) },
      };
    case 'neq':
      return {
        sql: `${fieldReference} != :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: String(value) },
      };
    case 'in':
      return {
        sql: `${fieldReference} IN (:...${fieldName}${paramSuffix})`,
        params: {
          [`${fieldName}${paramSuffix}`]: Array.isArray(value)
            ? value.map(String)
            : [String(value)],
        },
      };
    case 'gt':
      return {
        sql: `${numericFieldReference} > :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: value },
      };
    case 'gte':
      return {
        sql: `${numericFieldReference} >= :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: value },
      };
    case 'lt':
      return {
        sql: `${numericFieldReference} < :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: value },
      };
    case 'lte':
      return {
        sql: `${numericFieldReference} <= :${fieldName}${paramSuffix}`,
        params: { [`${fieldName}${paramSuffix}`]: value },
      };
    case 'isEmpty':
      return {
        sql: `(${fieldReference} IS NULL OR ${fieldReference} = '')`,
        params: {},
      };
    case 'isNotEmpty':
      return {
        sql: `(${fieldReference} IS NOT NULL AND ${fieldReference} <> '')`,
        params: {},
      };
    default:
      throw new GraphqlQueryRunnerException(
        `Operator "${operator}" is not supported for RAW_JSON path filters`,
        GraphqlQueryRunnerExceptionCode.UNSUPPORTED_OPERATOR,
      );
  }
};
