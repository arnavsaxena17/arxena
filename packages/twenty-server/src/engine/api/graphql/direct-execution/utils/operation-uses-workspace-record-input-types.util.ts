import { type DocumentNode } from 'graphql';

import { findOperationDefinition } from 'src/engine/api/graphql/direct-execution/utils/find-operation-definition.util';
import { getNamedTypeNameFromTypeNode } from 'src/engine/api/graphql/direct-execution/utils/get-named-type-name-from-type-node.util';

const CORE_RECORD_INPUT_TYPE_NAMES = new Set(['ObjectRecordFilterInput']);

const isWorkspaceRecordInputTypeName = (typeName: string): boolean =>
  !CORE_RECORD_INPUT_TYPE_NAMES.has(typeName) &&
  (typeName.endsWith('FilterInput') || typeName.endsWith('OrderByInput'));

export const operationUsesWorkspaceRecordInputTypes = (
  document: DocumentNode,
  operationName: string | undefined,
): boolean => {
  const operationDefinition = findOperationDefinition(document, operationName);
  const variableDefinitions = operationDefinition?.variableDefinitions;

  if (!variableDefinitions) {
    return false;
  }

  return variableDefinitions.some((variableDefinition) =>
    isWorkspaceRecordInputTypeName(
      getNamedTypeNameFromTypeNode(variableDefinition.type),
    ),
  );
};
