import {
  type DocumentNode,
  type OperationDefinitionNode,
  GraphQLError,
  Kind,
} from 'graphql';

export const findOperationDefinition = (
  document: DocumentNode,
  operationName: string | undefined,
): OperationDefinitionNode | undefined => {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );

  if (operationName) {
    const namedOperation = operations.find(
      (operation) => operation.name?.value === operationName,
    );

    if (namedOperation) {
      return namedOperation;
    }

    // Apollo can send a stale operationName on first load while the document
    // only contains one operation (FindManyDashboards / FindManyOrgCharts).
    if (operations.length === 1) {
      return operations[0];
    }

    return undefined;
  }

  if (operations.length > 1) {
    throw new GraphQLError(
      'Must provide operation name when document contains multiple operations.',
    );
  }

  return operations[0];
};
