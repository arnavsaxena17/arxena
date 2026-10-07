import {
  BRIGHT_DATA_COMPANY_CITY_VARIANTS,
  BRIGHT_DATA_COUNTRY_ALIASES,
  BRIGHT_DATA_LUDICROUS_FIELDS,
  BRIGHT_DATA_PEOPLE_CITY_CANONICAL,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousQuery,
  type BrightDataLudicrousQueryIssue,
  type BrightDataLudicrousRangeBounds,
  type BrightDataLudicrousTextMode,
  type BrightDataLudicrousValidationResult,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

const MAX_QUERY_DEPTH = 8;
const MAX_IN_VALUES = 100;
const MAX_TEXT_VALUE_LENGTH = 300;

export const ludicrousAnd = (
  ...conditions: Array<BrightDataLudicrousQuery | null | undefined>
): BrightDataLudicrousQuery => {
  const present = conditions.filter(
    (condition): condition is BrightDataLudicrousQuery =>
      condition !== null && condition !== undefined,
  );

  return present.length === 1 ? present[0] : { and: present };
};

export const ludicrousOr = (
  ...conditions: BrightDataLudicrousQuery[]
): BrightDataLudicrousQuery =>
  conditions.length === 1 ? conditions[0] : { or: conditions };

export const ludicrousText = (
  field: string,
  value: string,
  mode: BrightDataLudicrousTextMode = 'all',
): BrightDataLudicrousQuery => ({ text: { [field]: { value, mode } } });

export const ludicrousEquals = (
  field: string,
  value: string | number,
): BrightDataLudicrousQuery => ({ equals: { [field]: value } });

export const ludicrousIn = (
  field: string,
  values: Array<string | number>,
): BrightDataLudicrousQuery =>
  values.length === 1
    ? { equals: { [field]: values[0] } }
    : { in: { [field]: values } };

export const ludicrousRange = (
  field: string,
  bounds: BrightDataLudicrousRangeBounds,
): BrightDataLudicrousQuery => ({ range: { [field]: bounds } });

const BOOLEAN_TOKEN_PATTERN = /\b(AND|OR|NOT)\b|[()"*]/;

// The engine treats OR/AND/parentheses/quotes as plain words, so a boolean
// string passed through verbatim silently returns 0 rows or garbage.
export const stripBooleanSyntax = (value: string): string =>
  value
    .replace(/\b(AND|OR|NOT)\b/g, ' ')
    .replace(/[()"*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Compile one title phrase per OR branch. Each branch is mode "all" (every
// word must appear, any order). A single "any" bag over many titles matched
// 2.3M rows at 21% coverage in testing, so we never emit one.
export const compileTitleGroups = ({
  field,
  titles,
  excludeWords,
}: {
  field: string;
  titles: string[];
  excludeWords?: string[];
}): BrightDataLudicrousQuery => {
  const uniqueTitles = [
    ...new Set(
      titles
        .map((title) => stripBooleanSyntax(title).toLowerCase())
        .filter((title) => title.length > 0),
    ),
  ];

  if (uniqueTitles.length === 0) {
    throw new Error('compileTitleGroups needs at least one title');
  }

  const includes = ludicrousOr(
    ...uniqueTitles.map((title) => ludicrousText(field, title, 'all')),
  );
  const excluded = (excludeWords ?? [])
    .map((word) => stripBooleanSyntax(word).toLowerCase())
    .filter((word) => word.length > 0);

  if (excluded.length === 0) {
    return includes;
  }

  return {
    and: [includes, { not: ludicrousText(field, excluded.join(' '), 'any') }],
  };
};

// Turns "(head OR vp) AND engineering" style strings into the AND-of-ORs tree
// the engine can run. Supports AND, OR, NOT, parentheses and quoted phrases.
export const compileBooleanTitleString = ({
  field,
  expression,
}: {
  field: string;
  expression: string;
}): BrightDataLudicrousQuery => {
  const tokens = expression.match(/\(|\)|"[^"]+"|[^\s()]+/g) ?? [];
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];

  const parseOr = (): BrightDataLudicrousQuery => {
    const branches = [parseAnd()];

    while (peek()?.toUpperCase() === 'OR') {
      take();
      branches.push(parseAnd());
    }

    return ludicrousOr(...branches);
  };

  const parseAnd = (): BrightDataLudicrousQuery => {
    const parts = [parseUnary()];

    while (
      peek() !== undefined &&
      peek() !== ')' &&
      peek().toUpperCase() !== 'OR'
    ) {
      if (peek().toUpperCase() === 'AND') {
        take();
      }

      parts.push(parseUnary());
    }

    return ludicrousAnd(...parts);
  };

  const parseUnary = (): BrightDataLudicrousQuery => {
    const token = peek();

    if (token === undefined) {
      throw new Error('Unexpected end of boolean expression');
    }

    if (token.toUpperCase() === 'NOT') {
      take();

      return { not: parseUnary() };
    }

    if (token === '(') {
      take();
      const inner = parseOr();

      if (take() !== ')') {
        throw new Error('Missing closing parenthesis in boolean expression');
      }

      return inner;
    }

    take();

    return ludicrousText(field, stripBooleanSyntax(token), 'all');
  };

  const result = parseOr();

  if (position < tokens.length) {
    throw new Error(`Unexpected token "${tokens[position]}" in expression`);
  }

  return result;
};

export const expressionHasBooleanSyntax = (value: string): boolean =>
  BOOLEAN_TOKEN_PATTERN.test(value);

type ValidationContext = {
  entity: BrightDataLudicrousEntity;
  issues: BrightDataLudicrousQueryIssue[];
  normalizations: string[];
};

const normalizeCountry = (
  rawValue: string | number,
  path: string,
  context: ValidationContext,
): string | number => {
  const value = String(rawValue).trim();
  const alias = BRIGHT_DATA_COUNTRY_ALIASES[value.toLowerCase()];

  if (alias !== undefined) {
    context.normalizations.push(`${path}: "${value}" -> "${alias}"`);

    return alias;
  }

  if (!/^[A-Za-z]{2}$/.test(value)) {
    context.issues.push({
      path,
      message: `"${value}" is not an ISO alpha-2 country code`,
    });

    return rawValue;
  }

  return value.toUpperCase();
};

const expandCompanyCities = (
  values: Array<string | number>,
  path: string,
  context: ValidationContext,
): Array<string | number> => {
  const expanded = new Set<string | number>();

  for (const value of values) {
    const variants =
      BRIGHT_DATA_COMPANY_CITY_VARIANTS[String(value).toLowerCase()];

    if (variants === undefined) {
      expanded.add(value);
      continue;
    }

    for (const variant of variants) {
      expanded.add(variant);
    }

    if (variants.length > 1 || variants[0] !== value) {
      context.normalizations.push(
        `${path}: "${value}" -> [${variants.join(', ')}]`,
      );
    }
  }

  return [...expanded];
};

const normalizeFieldValues = ({
  field,
  values,
  path,
  context,
}: {
  field: string;
  values: Array<string | number>;
  path: string;
  context: ValidationContext;
}): Array<string | number> => {
  if (
    field === 'headquarters_country_code' ||
    field === 'country_code' ||
    field === 'offices_country_codes'
  ) {
    return values.map((value) => normalizeCountry(value, path, context));
  }

  if (context.entity === 'company' && field === 'headquarters_city') {
    return expandCompanyCities(values, path, context);
  }

  if (context.entity === 'company' && field === 'offices_cities') {
    return expandCompanyCities(values, path, context);
  }

  if (context.entity === 'people' && field === 'city') {
    return values.map((value) => {
      const canonical =
        BRIGHT_DATA_PEOPLE_CITY_CANONICAL[String(value).toLowerCase()];

      if (canonical !== undefined && canonical !== value) {
        context.normalizations.push(`${path}: "${value}" -> "${canonical}"`);

        return canonical;
      }

      return value;
    });
  }

  const definition = BRIGHT_DATA_LUDICROUS_FIELDS[context.entity][field];
  const fixedValues = definition?.fixedValues;

  if (fixedValues === undefined) {
    return values;
  }

  return values.map((value) => {
    const match = fixedValues.find(
      (fixed) => String(fixed).toLowerCase() === String(value).toLowerCase(),
    );

    if (match === undefined) {
      context.issues.push({
        path,
        message: `"${value}" is not a valid ${field}; allowed: ${fixedValues.join(', ')}`,
      });

      return value;
    }

    if (match !== value) {
      context.normalizations.push(`${path}: "${value}" -> "${match}"`);
    }

    return match;
  });
};

const walk = (
  node: unknown,
  path: string,
  depth: number,
  context: ValidationContext,
): BrightDataLudicrousQuery => {
  if (depth > MAX_QUERY_DEPTH) {
    context.issues.push({ path, message: 'query nesting is too deep' });

    return node as BrightDataLudicrousQuery;
  }

  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    context.issues.push({ path, message: 'condition must be an object' });

    return node as BrightDataLudicrousQuery;
  }

  const entries = Object.entries(node);

  if (entries.length !== 1) {
    context.issues.push({
      path,
      message: 'each condition must have exactly one operator key',
    });

    return node as BrightDataLudicrousQuery;
  }

  const [operator, body] = entries[0];

  if (operator === 'and' || operator === 'or') {
    if (!Array.isArray(body) || body.length === 0) {
      context.issues.push({
        path: `${path}.${operator}`,
        message: `${operator} needs a non-empty array`,
      });

      return node as BrightDataLudicrousQuery;
    }

    return {
      [operator]: body.map((child, index) =>
        walk(child, `${path}.${operator}[${index}]`, depth + 1, context),
      ),
    } as BrightDataLudicrousQuery;
  }

  if (operator === 'not') {
    return {
      not: walk(body, `${path}.not`, depth + 1, context),
    };
  }

  if (
    operator !== 'equals' &&
    operator !== 'in' &&
    operator !== 'range' &&
    operator !== 'text'
  ) {
    context.issues.push({ path, message: `unknown operator "${operator}"` });

    return node as BrightDataLudicrousQuery;
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    context.issues.push({
      path: `${path}.${operator}`,
      message: 'operator body must be { field: value }',
    });

    return node as BrightDataLudicrousQuery;
  }

  const fieldEntries = Object.entries(body as Record<string, unknown>);

  if (fieldEntries.length !== 1) {
    context.issues.push({
      path: `${path}.${operator}`,
      message: 'operator body must name exactly one field',
    });

    return node as BrightDataLudicrousQuery;
  }

  const [field, rawValue] = fieldEntries[0];
  const fieldPath = `${path}.${operator}.${field}`;
  const definition = BRIGHT_DATA_LUDICROUS_FIELDS[context.entity][field];

  if (definition === undefined) {
    context.issues.push({
      path: fieldPath,
      message: `unknown ${context.entity} field "${field}"`,
    });

    return node as BrightDataLudicrousQuery;
  }

  if (!definition.operators.includes(operator)) {
    context.issues.push({
      path: fieldPath,
      message: `${field} does not accept ${operator}; use ${definition.operators.join(' or ')}`,
    });

    return node as BrightDataLudicrousQuery;
  }

  if (operator === 'equals') {
    const values = normalizeFieldValues({
      field,
      values: [rawValue as string | number],
      path: fieldPath,
      context,
    });

    // equals on a city with several spellings becomes an in-list
    return values.length > 1
      ? { in: { [field]: values } }
      : { equals: { [field]: values[0] } };
  }

  if (operator === 'in') {
    if (!Array.isArray(rawValue) || rawValue.length === 0) {
      context.issues.push({
        path: fieldPath,
        message: 'in needs a non-empty array',
      });

      return node as BrightDataLudicrousQuery;
    }

    if (rawValue.length > MAX_IN_VALUES) {
      context.issues.push({
        path: fieldPath,
        message: `in accepts at most ${MAX_IN_VALUES} values`,
      });
    }

    return {
      in: {
        [field]: normalizeFieldValues({
          field,
          values: rawValue,
          path: fieldPath,
          context,
        }),
      },
    };
  }

  if (operator === 'range') {
    const bounds = rawValue as Record<string, unknown>;
    const keys = Object.keys(bounds ?? {});

    if (
      keys.length === 0 ||
      keys.some((key) => !['>', '>=', '<', '<='].includes(key)) ||
      keys.some((key) => typeof bounds[key] !== 'number')
    ) {
      context.issues.push({
        path: fieldPath,
        message: 'range needs numeric bounds using >, >=, < or <=',
      });
    }

    return node as BrightDataLudicrousQuery;
  }

  // text
  if (typeof rawValue === 'string') {
    context.issues.push({
      path: fieldPath,
      message:
        'text without a mode uses the default top-bm25 which caps candidates at 100 before other filters; use mode "all" or "any"',
    });

    return node as BrightDataLudicrousQuery;
  }

  const textBody = rawValue as {
    value?: unknown;
    mode?: unknown;
    'top-k'?: unknown;
  };

  if (typeof textBody?.value !== 'string' || textBody.value.trim() === '') {
    context.issues.push({
      path: fieldPath,
      message: 'text needs a non-empty value',
    });

    return node as BrightDataLudicrousQuery;
  }

  if (textBody.value.length > MAX_TEXT_VALUE_LENGTH) {
    context.issues.push({
      path: fieldPath,
      message: `text value is longer than ${MAX_TEXT_VALUE_LENGTH} characters`,
    });
  }

  const hasTopK = typeof textBody['top-k'] === 'number';

  if (textBody.mode !== 'all' && textBody.mode !== 'any' && !hasTopK) {
    context.issues.push({
      path: fieldPath,
      message:
        'text needs mode "all" or "any" (or an explicit large top-k); default top-bm25 silently drops almost every match',
    });
  }

  let value = textBody.value;

  if (expressionHasBooleanSyntax(value)) {
    value = stripBooleanSyntax(value);
    context.normalizations.push(
      `${fieldPath}: removed boolean syntax (engine does not parse it)`,
    );
  }

  return {
    text: {
      [field]: { ...textBody, value } as {
        value: string;
        mode?: BrightDataLudicrousTextMode;
      },
    },
  };
};

export const validateAndNormalizeLudicrousQuery = ({
  entity,
  query,
}: {
  entity: BrightDataLudicrousEntity;
  query: unknown;
}): BrightDataLudicrousValidationResult => {
  const context: ValidationContext = { entity, issues: [], normalizations: [] };
  const normalized = walk(query, '$', 0, context);

  return {
    query: normalized,
    issues: context.issues,
    normalizations: context.normalizations,
  };
};

export const assertValidLudicrousQuery = ({
  entity,
  query,
}: {
  entity: BrightDataLudicrousEntity;
  query: unknown;
}): BrightDataLudicrousQuery => {
  const result = validateAndNormalizeLudicrousQuery({ entity, query });

  if (result.issues.length > 0) {
    throw new Error(
      `Invalid ludicrous query: ${result.issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join('; ')}`,
    );
  }

  return result.query;
};
