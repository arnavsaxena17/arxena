export type SalesNavCompanySearchPayload = {
  api: 'sales_navigator';
  category: 'companies';
  keywords?: string;
  location?: { include: string[]; exclude?: string[] };
  industry?: { include: string[]; exclude?: string[] };
  headcount?: { min?: number; max?: number }[];
};

export type ParsedSalesNavCompanyUrl = {
  payload: SalesNavCompanySearchPayload;
  // Filter types in the URL that the payload cannot express; the caller
  // should fall back to passing the raw URL to Unipile when this is non-empty
  unsupportedFilters: string[];
};

type FilterValue = { id: string; text: string; excluded: boolean };

// Sales Navigator company-headcount codes, used when the text label is absent
const HEADCOUNT_BY_CODE: Record<string, { min?: number; max?: number }> = {
  B: { min: 1, max: 10 },
  C: { min: 11, max: 50 },
  D: { min: 51, max: 200 },
  E: { min: 201, max: 500 },
  F: { min: 501, max: 1000 },
  G: { min: 1001, max: 5000 },
  H: { min: 5001, max: 10000 },
  I: { min: 10001 },
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Splits on a separator at paren depth 0 so nested List(...) stay intact
const splitTopLevel = (input: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of input) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;

    if (character === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  if (current !== '') parts.push(current);

  return parts;
};

const unwrapList = (input: string): string => {
  const trimmed = input.trim();
  const inner =
    trimmed.startsWith('List(') && trimmed.endsWith(')')
      ? trimmed.slice(5, -1)
      : trimmed;

  return inner;
};

const readFields = (entry: string): Record<string, string> => {
  const body = entry.trim().replace(/^\(/, '').replace(/\)$/, '');
  const fields: Record<string, string> = {};

  for (const part of splitTopLevel(body, ',')) {
    const separatorIndex = part.indexOf(':');

    if (separatorIndex > 0) {
      fields[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
    }
  }

  return fields;
};

const parseValues = (valuesRaw: string): FilterValue[] =>
  splitTopLevel(unwrapList(valuesRaw), ',').map((entry) => {
    const fields = readFields(entry);

    return {
      id: safeDecode(fields.id ?? ''),
      text: safeDecode(fields.text ?? ''),
      excluded: fields.selectionType === 'EXCLUDED',
    };
  });

const toHeadcountRange = (
  value: FilterValue,
): { min?: number; max?: number } | undefined => {
  const label = value.text.replace(/,/g, '').trim();
  const range = label.match(/^(\d+)\s*-\s*(\d+)$/);

  if (range) return { min: Number(range[1]), max: Number(range[2]) };

  const open = label.match(/^(\d+)\+$/);

  if (open) return { min: Number(open[1]) };

  return HEADCOUNT_BY_CODE[value.id];
};

const toIncludeExclude = (values: FilterValue[]) => {
  const include = values.filter((v) => !v.excluded && v.id).map((v) => v.id);
  const exclude = values.filter((v) => v.excluded && v.id).map((v) => v.id);

  return include.length > 0 || exclude.length > 0
    ? { include, ...(exclude.length > 0 ? { exclude } : {}) }
    : undefined;
};

export const isSalesNavCompanySearchUrl = (url: string): boolean =>
  /linkedin\.com\/sales\/search\/company\b/i.test(url);

// Turns a pasted Sales Navigator company-search URL into the Unipile
// POST /linkedin/search body. Throws if the URL is not a company search.
export const parseSalesNavCompanyUrl = (
  url: string,
): ParsedSalesNavCompanyUrl => {
  if (!isSalesNavCompanySearchUrl(url)) {
    throw new Error('Not a Sales Navigator company search URL');
  }

  const rawQuery = url.match(/[?&]query=([^&#]*)/)?.[1];

  if (rawQuery === undefined) {
    throw new Error('URL has no query parameter');
  }

  // One decode level exposes the List(...) structure; ids and text stay
  // percent-encoded until each value is read
  const query = safeDecode(rawQuery).replace(/^\(/, '').replace(/\)$/, '');
  const payload: SalesNavCompanySearchPayload = {
    api: 'sales_navigator',
    category: 'companies',
  };
  const unsupportedFilters: string[] = [];

  for (const part of splitTopLevel(query, ',')) {
    const separatorIndex = part.indexOf(':');
    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1);

    if (key === 'keywords') {
      const keywords = safeDecode(value).trim();

      if (keywords) payload.keywords = keywords;
      continue;
    }

    if (key !== 'filters') continue;

    for (const filterEntry of splitTopLevel(unwrapList(value), ',')) {
      const filter = readFields(filterEntry);
      const values = parseValues(filter.values ?? '');

      switch (filter.type) {
        case 'REGION':
          payload.location = toIncludeExclude(values);
          break;
        case 'INDUSTRY':
          payload.industry = toIncludeExclude(values);
          break;
        case 'COMPANY_HEADCOUNT': {
          const ranges = values
            .filter((v) => !v.excluded)
            .map(toHeadcountRange);

          if (ranges.some((range) => range === undefined)) {
            unsupportedFilters.push('COMPANY_HEADCOUNT');
          } else {
            payload.headcount = ranges as { min?: number; max?: number }[];
          }
          break;
        }
        default:
          unsupportedFilters.push(filter.type ?? 'UNKNOWN');
      }
    }
  }

  return { payload, unsupportedFilters };
};
