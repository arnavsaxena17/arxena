import { type DocumentNode } from 'graphql';

import { graphQLExtractTopLevelFields } from 'src/engine/api/graphql/direct-execution/utils/graphql-extract-top-level-fields.util';
import { operationUsesWorkspaceRecordInputTypes } from 'src/engine/api/graphql/direct-execution/utils/operation-uses-workspace-record-input-types.util';

const INTROSPECTION_FIELD_NAMES = new Set(['__schema', '__type']);

type TopLevelFieldsClassification = {
  hasIntrospectionFields: boolean;
  hasWorkspaceFields: boolean;
  hasCoreFields: boolean;
};

export const classifyTopLevelFields = (
  document: DocumentNode,
  operationName: string | undefined,
  workspaceResolverNames: Set<string>,
): TopLevelFieldsClassification => {
  const topLevelFields = graphQLExtractTopLevelFields(document, operationName);
  const usesWorkspaceRecordInputTypes = operationUsesWorkspaceRecordInputTypes(
    document,
    operationName,
  );

  // Named-operation lookup can miss on first load (stale operationName).
  // Still treat *FilterInput / *OrderByInput documents as workspace so they
  // never fall through to the core schema.
  if (topLevelFields.length === 0 && usesWorkspaceRecordInputTypes) {
    return {
      hasIntrospectionFields: false,
      hasWorkspaceFields: true,
      hasCoreFields: false,
    };
  }

  let hasIntrospectionFields = false;
  let hasWorkspaceFields = false;
  let hasCoreFields = false;

  for (const field of topLevelFields) {
    if (INTROSPECTION_FIELD_NAMES.has(field.name.value)) {
      hasIntrospectionFields = true;
    } else if (workspaceResolverNames.has(field.name.value)) {
      hasWorkspaceFields = true;
    } else if (usesWorkspaceRecordInputTypes) {
      // FindMany* queries name fields after object plurals (`dashboards`).
      // If the resolver-name cache is stale, those fields are missing from
      // the set and would otherwise fall through to the core schema (HTTP 400
      // Unknown type "DashboardFilterInput").
      hasWorkspaceFields = true;
    } else {
      hasCoreFields = true;
    }
  }

  return { hasIntrospectionFields, hasWorkspaceFields, hasCoreFields };
};
