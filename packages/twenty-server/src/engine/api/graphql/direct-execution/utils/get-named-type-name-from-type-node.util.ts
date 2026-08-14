import { Kind, type TypeNode } from 'graphql';

export const getNamedTypeNameFromTypeNode = (typeNode: TypeNode): string => {
  if (typeNode.kind === Kind.NAMED_TYPE) {
    return typeNode.name.value;
  }

  return getNamedTypeNameFromTypeNode(typeNode.type);
};
