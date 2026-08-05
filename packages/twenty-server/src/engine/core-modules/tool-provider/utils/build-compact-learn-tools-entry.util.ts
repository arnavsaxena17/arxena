import { isDefined } from 'twenty-shared/utils';

const FILTER_OPERATOR_KEYS = new Set([
  'eq',
  'neq',
  'like',
  'ilike',
  'startsWith',
  'endsWith',
  'is',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
]);

type JsonSchemaNode = {
  $ref?: string;
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  $defs?: Record<string, JsonSchemaNode>;
};

export type CompactLearnToolsResultEntry = {
  name: string;
  description?: string;
  inputArgKeys?: string[];
  compositeFilterHints?: Record<string, string>;
  schemaNote?: string;
};

const resolveSchemaNode = (
  node: JsonSchemaNode | undefined,
  defs: Record<string, JsonSchemaNode>,
): JsonSchemaNode | undefined => {
  if (!isDefined(node)) {
    return undefined;
  }

  if (!isDefined(node.$ref)) {
    return node;
  }

  const match = /^#\/\$defs\/(.+)$/.exec(node.$ref);

  if (!isDefined(match?.[1])) {
    return node;
  }

  return defs[match[1]] ?? node;
};

const listObjectPropertyKeys = (
  node: JsonSchemaNode | undefined,
  defs: Record<string, JsonSchemaNode>,
): string[] => {
  const resolved = resolveSchemaNode(node, defs);

  if (!isDefined(resolved?.properties)) {
    return [];
  }

  return Object.keys(resolved.properties);
};

const isCompositeFilterField = (
  node: JsonSchemaNode | undefined,
  defs: Record<string, JsonSchemaNode>,
): string[] => {
  const resolved = resolveSchemaNode(node, defs);

  if (!isDefined(resolved?.properties)) {
    return [];
  }

  const subFieldNames: string[] = [];

  for (const [subFieldName, subFieldSchema] of Object.entries(
    resolved.properties,
  )) {
    if (FILTER_OPERATOR_KEYS.has(subFieldName)) {
      // Scalar filter operators at the field root (TEXT/UUID) — not composite
      return [];
    }

    const nestedKeys = listObjectPropertyKeys(subFieldSchema, defs);
    const hasFilterOperators = nestedKeys.some((key) =>
      FILTER_OPERATOR_KEYS.has(key),
    );

    if (hasFilterOperators) {
      subFieldNames.push(subFieldName);
    }
  }

  return subFieldNames;
};

const buildCompositeFilterHint = (
  fieldName: string,
  subFieldNames: string[],
): string => {
  const subFieldList = subFieldNames.join('|');

  if (fieldName === 'name' && subFieldNames.includes('firstName')) {
    return (
      `use { ${fieldName}: { ${subFieldList}: { ilike: "%…%" } } }; ` +
      `never { ${fieldName}: { ilike } }, fullName, or top-level firstName/lastName`
    );
  }

  return `use { ${fieldName}: { ${subFieldList}: { ilike|eq: … } } }; never put operators on the ${fieldName} root`;
};

// Shrink a learned tool entry so learn_tools can stay under the inline spill
// budget while still teaching arg names and composite filter shapes.
export const buildCompactLearnToolsEntry = (toolInfo: {
  name: string;
  description?: string;
  inputSchema?: object;
}): CompactLearnToolsResultEntry => {
  const compactEntry: CompactLearnToolsResultEntry = {
    name: toolInfo.name,
  };

  if (isDefined(toolInfo.description)) {
    compactEntry.description = toolInfo.description;
  }

  const inputSchema = toolInfo.inputSchema as JsonSchemaNode | undefined;

  if (!isDefined(inputSchema)) {
    return compactEntry;
  }

  const defs = inputSchema.$defs ?? {};
  const propertyEntries = Object.entries(inputSchema.properties ?? {});

  if (propertyEntries.length > 0) {
    compactEntry.inputArgKeys = propertyEntries.map(([key]) => key);
  }

  compactEntry.schemaNote =
    'Full inputSchema spilled — use inputArgKeys / compositeFilterHints, or read spilledTools.outputRef';

  const compositeFilterHints: Record<string, string> = {};

  for (const [fieldName, fieldSchema] of propertyEntries) {
    if (fieldName === 'and' || fieldName === 'or' || fieldName === 'not') {
      continue;
    }

    const subFieldNames = isCompositeFilterField(fieldSchema, defs);

    if (subFieldNames.length === 0) {
      continue;
    }

    compositeFilterHints[fieldName] = buildCompositeFilterHint(
      fieldName,
      subFieldNames,
    );
  }

  if (Object.keys(compositeFilterHints).length > 0) {
    compactEntry.compositeFilterHints = compositeFilterHints;
  }

  return compactEntry;
};
