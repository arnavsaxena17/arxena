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
  description?: string;
  enum?: unknown[];
  const?: unknown;
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  nullable?: boolean;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  $defs?: Record<string, JsonSchemaNode>;
};

export type CompactLearnToolsResultEntry = {
  name: string;
  description?: string;
  inputArgKeys?: string[];
  // One line per argument with its type, nested keys and enum values, so the
  // model can build a valid call after the full schema is spilled
  inputShape?: string;
  compositeFilterHints?: Record<string, string>;
  schemaNote?: string;
};

const MAX_SHAPE_CHARACTERS = 1800;
const MAX_NESTING_DEPTH = 2;
const MAX_ARGUMENT_HINT_CHARACTERS = 70;

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

const listLiterals = (node: JsonSchemaNode): string[] | undefined => {
  const values = node.enum ?? (isDefined(node.const) ? [node.const] : undefined);

  if (!isDefined(values) || values.length === 0) {
    return undefined;
  }

  return values.map((value) =>
    typeof value === 'string' ? `"${value}"` : String(value),
  );
};

const renderScalarType = (
  node: JsonSchemaNode,
  defs: Record<string, JsonSchemaNode>,
  depth: number,
  describe: boolean,
): string => {
  const literals = listLiterals(node);

  if (isDefined(literals)) {
    return literals.join('|');
  }

  const union = node.anyOf ?? node.oneOf;

  if (isDefined(union)) {
    const parts = union
      .filter((member) => member.type !== 'null')
      .map((member) => renderScalarType(member, defs, depth, false));
    const unique = [...new Set(parts)];

    return unique.length > 0 ? unique.join('|') : 'any';
  }

  if (node.type === 'array') {
    const itemText = isDefined(node.items)
      ? renderScalarType(node.items, defs, depth, false)
      : 'any';

    return itemText.includes('|') || itemText.includes(' ') && !itemText.startsWith('{')
      ? `(${itemText})[]`
      : `${itemText}[]`;
  }

  if (node.type === 'object' || isDefined(node.properties)) {
    return renderObjectType(node, defs, depth + 1, describe);
  }

  const base = node.type ?? 'any';

  if (describe && isDefined(node.description)) {
    const full = node.description.replace(/\s+/g, ' ');
    const hint =
      full.length > MAX_ARGUMENT_HINT_CHARACTERS
        ? `${full.slice(0, MAX_ARGUMENT_HINT_CHARACTERS).replace(/\s+\S*$/, '')}…`
        : full;

    return `${base} — ${hint}`;
  }

  return base;
};

const renderObjectType = (
  node: JsonSchemaNode,
  defs: Record<string, JsonSchemaNode>,
  depth: number,
  describe: boolean,
): string => {
  const resolved = resolveSchemaNode(node, defs);

  if (!isDefined(resolved?.properties) || depth > MAX_NESTING_DEPTH) {
    return 'object';
  }

  const required = new Set(resolved.required ?? []);
  const fields = Object.entries(resolved.properties).map(
    ([fieldName, fieldSchema]) => {
      const typeText = renderScalarType(
        resolveSchemaNode(fieldSchema, defs) ?? fieldSchema,
        defs,
        depth,
        false,
      );

      return `${fieldName}${required.has(fieldName) ? '' : '?'}: ${typeText}`;
    },
  );

  return `{${fields.join(', ')}}`;
};

// A teachable one-liner for a spilled schema: every argument, its type, the
// keys of nested objects, array item shapes and enum values.
export const renderInputShape = (inputSchema: unknown): string | undefined => {
  const schema = inputSchema as JsonSchemaNode | undefined;

  if (!isDefined(schema?.properties)) {
    return undefined;
  }

  const defs = schema.$defs ?? {};
  const required = new Set(schema.required ?? []);

  const arguments_ = Object.entries(schema.properties).map(
    ([argumentName, argumentSchema]) => {
      const resolved =
        resolveSchemaNode(argumentSchema, defs) ?? argumentSchema;
      const typeText = renderScalarType(resolved, defs, 0, true);

      return `${argumentName}${required.has(argumentName) ? '' : '?'}: ${typeText}`;
    },
  );

  const shape = arguments_.join('; ');

  return shape.length > MAX_SHAPE_CHARACTERS
    ? `${shape.slice(0, MAX_SHAPE_CHARACTERS)}…`
    : shape;
};

// Shrink a learned tool entry so learn_tools can stay under the inline spill
// budget while still teaching arg names, shapes and composite filter shapes.
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

  const inputShape = renderInputShape(inputSchema);

  if (isDefined(inputShape)) {
    compactEntry.inputShape = inputShape;
  }

  compactEntry.schemaNote =
    'Full inputSchema spilled; inputShape above is the call contract — pass exactly these keys and types, and read spilledTools.outputRef only when you need a long description';

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
