import { msg } from '@lingui/core/macro';
import { type RawJsonFilter } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';

const RAW_JSON_PATH_FILTER_OPERATORS = new Set([
  'eq',
  'neq',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'isEmpty',
  'isNotEmpty',
]);

export const getRawJsonPathFilterOperator = (
  filterValue: RawJsonFilter,
): { operator: string; value: unknown } => {
  if (!isDefined(filterValue.path)) {
    throw new GraphqlQueryRunnerException(
      'RAW_JSON path filter requires a path',
      GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
      { userFriendlyMessage: msg`Invalid RAW_JSON path filter` },
    );
  }

  const operatorEntries = Object.entries(filterValue).filter(
    ([operator]) => operator !== 'path' && operator !== 'like' && operator !== 'is',
  );

  if (operatorEntries.length !== 1) {
    throw new GraphqlQueryRunnerException(
      'RAW_JSON path filter must have exactly one operator besides path',
      GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
      { userFriendlyMessage: msg`Invalid RAW_JSON path filter` },
    );
  }

  const [[operator, value]] = operatorEntries;

  if (!RAW_JSON_PATH_FILTER_OPERATORS.has(operator)) {
    throw new GraphqlQueryRunnerException(
      `Operator "${operator}" is not supported for RAW_JSON path filters`,
      GraphqlQueryRunnerExceptionCode.UNSUPPORTED_OPERATOR,
    );
  }

  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    return {
      operator: operator === 'isEmpty' ? 'isEmpty' : 'isNotEmpty',
      value: null,
    };
  }

  return { operator, value };
};
