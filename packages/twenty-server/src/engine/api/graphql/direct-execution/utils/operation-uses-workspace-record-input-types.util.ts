import { Kind, type DocumentNode, type VariableDefinitionNode } from 'graphql';

import { findOperationDefinition } from 'src/engine/api/graphql/direct-execution/utils/find-operation-definition.util';
import { getNamedTypeNameFromTypeNode } from 'src/engine/api/graphql/direct-execution/utils/get-named-type-name-from-type-node.util';

const CORE_RECORD_INPUT_TYPE_NAMES = new Set(['ObjectRecordFilterInput']);

const isWorkspaceRecordInputTypeName = (typeName: string): boolean =>
  !CORE_RECORD_INPUT_TYPE_NAMES.has(typeName) &&
  (typeName.endsWith('FilterInput') || typeName.endsWith('OrderByInput'));

const collectVariableDefinitions = (
  document: DocumentNode,
  operationName: string | undefined,
): readonly VariableDefinitionNode[] => {
  const operationDefinition = findOperationDefinition(document, operationName);

  if (operationDefinition?.variableDefinitions) {
    return operationDefinition.variableDefinitions;
  }

  return document.definitions.flatMap((definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? (definition.variableDefinitions ?? [])
      : [],
  );
};

export const operationUsesWorkspaceRecordInputTypes = (
  document: DocumentNode,
  operationName: string | undefined,
): boolean => {
  const variableDefinitions = collectVariableDefinitions(
    document,
    operationName,
  );

  if (variableDefinitions.length === 0) {
    return false;
  }

  return variableDefinitions.some((variableDefinition) =>
    isWorkspaceRecordInputTypeName(
      getNamedTypeNameFromTypeNode(variableDefinition.type),
    ),
  );
};
