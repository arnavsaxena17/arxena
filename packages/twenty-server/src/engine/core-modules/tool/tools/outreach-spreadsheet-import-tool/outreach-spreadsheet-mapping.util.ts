import { z } from 'zod';

import { isNonEmptyString } from '@sniptt/guards';

import { type SpreadsheetCell } from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-parser.util';

const columnName = z.string().min(1);

export const OutreachSpreadsheetPeopleGroupZodSchema = z.object({
  name: columnName.describe('Header of the person name column'),
  title: columnName.optional().describe('Header of the job title column'),
  linkedinUrl: columnName
    .optional()
    .describe(
      'Header of the LinkedIn column. The cell hyperlink is used when present, else the visible text if it is a URL',
    ),
  email: columnName.optional().describe('Header of the email column'),
});

export const OutreachSpreadsheetExtraColumnZodSchema = z.object({
  header: columnName.describe('Sheet header the values come from'),
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe('Proposed snake_case key stored in otherFields'),
  label: z.string().min(1).describe('Column title shown in the table'),
  type: z.enum(['text', 'number', 'boolean', 'url']).default('text'),
});

export type OutreachSpreadsheetExtraColumn = z.infer<
  typeof OutreachSpreadsheetExtraColumnZodSchema
>;

export const OutreachSpreadsheetMappingZodSchema = z.object({
  company: z
    .object({
      name: columnName
        .optional()
        .describe('Header used as the company display name (brand wins)'),
      fallbackName: columnName
        .optional()
        .describe('Header used when the name cell is empty'),
      domain: columnName.optional(),
      industry: columnName.optional(),
      employees: columnName.optional(),
      segment: columnName.optional(),
      extra: z
        .array(OutreachSpreadsheetExtraColumnZodSchema)
        .default([])
        .describe(
          'Sheet columns with no built-in field, kept as extra table columns on the company under a proposed key',
        ),
    })
    .optional(),
  peopleGroups: z
    .array(OutreachSpreadsheetPeopleGroupZodSchema)
    .default([])
    .describe(
      'One entry per person in a row. A wide sheet with Contact 1 / Contact 2 column sets has one entry per set',
    ),
});

export type OutreachSpreadsheetMapping = z.infer<
  typeof OutreachSpreadsheetMappingZodSchema
>;

export type ImportedCompany = {
  name: string;
  domain: string;
  industry: string;
  employees: string;
  segment: string;
  extra: Record<string, string | number | boolean>;
};

export type ImportedPerson = {
  name: string;
  title: string;
  linkedinUrl: string;
  email: string;
  companyName: string;
};

export type ImportedSpreadsheetRows = {
  companies: ImportedCompany[];
  people: ImportedPerson[];
  skippedRowCount: number;
  skippedPeopleCount: number;
};

const PLACEHOLDER_VALUE = /^(not found|n\/?a|na|none|null|-+|—+|tbd|unknown|\?)$/i;

const cleanText = (value: string): string =>
  PLACEHOLDER_VALUE.test(value.trim()) ? '' : value.trim();

const looksLikeUrl = (value: string): boolean =>
  /^(https?:\/\/|www\.)\S+$/i.test(value) || /linkedin\.com\//i.test(value);

const readCell = (
  row: SpreadsheetCell[],
  headers: string[],
  header: string | undefined,
): SpreadsheetCell => {
  const index = isNonEmptyString(header) ? headers.indexOf(header) : -1;

  return index === -1 ? { text: '' } : (row[index] ?? { text: '' });
};

const readText = (
  row: SpreadsheetCell[],
  headers: string[],
  header: string | undefined,
): string => cleanText(readCell(row, headers, header).text);

const toExtraValue = (
  text: string,
  type: OutreachSpreadsheetExtraColumn['type'],
): string | number | boolean => {
  if (type === 'number') {
    const parsed = Number(text.replace(/[,\s]/g, ''));

    return Number.isFinite(parsed) ? parsed : text;
  }

  if (type === 'boolean') {
    return /^(yes|y|true|1)$/i.test(text);
  }

  return text;
};

const readLink = (
  row: SpreadsheetCell[],
  headers: string[],
  header: string | undefined,
): string => {
  const cell = readCell(row, headers, header);

  if (isNonEmptyString(cell.link)) {
    return cell.link;
  }

  return looksLikeUrl(cell.text.trim()) ? cell.text.trim() : '';
};

export const applySpreadsheetMapping = (
  headers: string[],
  rows: SpreadsheetCell[][],
  mapping: OutreachSpreadsheetMapping,
): ImportedSpreadsheetRows => {
  const companies: ImportedCompany[] = [];
  const people: ImportedPerson[] = [];
  let skippedRowCount = 0;
  let skippedPeopleCount = 0;
  const companyMapping = mapping.company;

  for (const row of rows) {
    const companyName = companyMapping
      ? readText(row, headers, companyMapping.name) ||
        readText(row, headers, companyMapping.fallbackName)
      : '';

    if (companyMapping !== undefined) {
      if (companyName === '') {
        skippedRowCount++;
      } else {
        companies.push({
          name: companyName,
          domain: readText(row, headers, companyMapping.domain),
          industry: readText(row, headers, companyMapping.industry),
          employees: readText(row, headers, companyMapping.employees),
          segment: readText(row, headers, companyMapping.segment),
          extra: Object.fromEntries(
            companyMapping.extra
              .map((column) => [
                column.key,
                readText(row, headers, column.header),
                column.type,
              ] as const)
              .filter(([, text]) => text !== '')
              .map(([key, text, type]) => [key, toExtraValue(text, type)]),
          ),
        });
      }
    }

    for (const group of mapping.peopleGroups) {
      const personName = readText(row, headers, group.name);

      if (personName === '') {
        skippedPeopleCount++;
        continue;
      }

      people.push({
        name: personName,
        title: readText(row, headers, group.title),
        linkedinUrl: readLink(row, headers, group.linkedinUrl),
        email: readText(row, headers, group.email),
        companyName,
      });
    }
  }

  return { companies, people, skippedRowCount, skippedPeopleCount };
};

const CONTACT_COLUMN =
  /^(?:contact|person|poc|lead|decision[ -]?maker|owner)\s*#?(\d+)?\s*[-:_.]*\s*(name|title|designation|role|linkedin(?: url| profile)?|email(?: id)?)$/i;

const findHeader = (headers: string[], pattern: RegExp): string | undefined =>
  headers.find((header) => pattern.test(header));

const suggestPeopleGroups = (
  headers: string[],
): OutreachSpreadsheetMapping['peopleGroups'] => {
  const groupsByNumber = new Map<string, Record<string, string>>();

  for (const header of headers) {
    const match = CONTACT_COLUMN.exec(header);

    if (match === null) {
      continue;
    }

    const groupKey = match[1] ?? '1';
    const kind = match[2].toLowerCase();
    const field = kind.startsWith('linkedin')
      ? 'linkedinUrl'
      : kind.startsWith('email')
        ? 'email'
        : kind === 'name'
          ? 'name'
          : 'title';

    groupsByNumber.set(groupKey, {
      ...(groupsByNumber.get(groupKey) ?? {}),
      [field]: header,
    });
  }

  const wideGroups = [...groupsByNumber.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, group]) => group)
    .filter((group) => isNonEmptyString(group.name));

  if (wideGroups.length > 0) {
    return wideGroups as OutreachSpreadsheetMapping['peopleGroups'];
  }

  // One person per row (a plain people list)
  const name = findHeader(
    headers,
    /^(full name|person name|contact name|name)$/i,
  );

  if (name === undefined) {
    return [];
  }

  return [
    {
      name,
      title: findHeader(headers, /^(job )?(title|designation|role|position)$/i),
      linkedinUrl: findHeader(headers, /linkedin/i),
      email: findHeader(headers, /e-?mail/i),
    },
  ];
};

export const toColumnKey = (header: string): string => {
  const key = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return /^[a-z]/.test(key) ? key : `col_${key}`;
};

const IDENTITY_HEADERS = /^(#|sr\.?( no\.?)?|s\.?no\.?|index|id)$/i;

export const suggestSpreadsheetMapping = (
  headers: string[],
): OutreachSpreadsheetMapping => {
  const peopleGroups = suggestPeopleGroups(headers);
  const usedByPeople = new Set(
    peopleGroups.flatMap((group) => Object.values(group)),
  );

  const brand = findHeader(headers, /^(brand|brand name)$/i);
  const companyHeader = findHeader(
    headers,
    /^(company|company name|organi[sz]ation|account|business name)$/i,
  );
  const operatingCompany = findHeader(
    headers,
    /operating company|legal (entity|name)|registered name|entity name/i,
  );

  const name = brand ?? companyHeader ?? operatingCompany;
  const fallbackName = [companyHeader, operatingCompany].find(
    (header) => header !== undefined && header !== name,
  );

  const domain = findHeader(headers, /^(website|domain|company website|url)$/i);
  const industry = findHeader(headers, /^(industry|sector|category)$/i);
  const employees = findHeader(
    headers,
    /^(employees|headcount|company size|no\.? of employees)$/i,
  );
  const segment = findHeader(headers, /^segment$/i);

  const claimed = new Set(
    [name, domain, industry, employees, segment].filter(
      isNonEmptyString,
    ),
  );

  const extra = headers
    .filter(
      (header) =>
        !claimed.has(header) &&
        !usedByPeople.has(header) &&
        !IDENTITY_HEADERS.test(header),
    )
    .map((header) => ({
      header,
      key: toColumnKey(header),
      label: header,
      type: 'text' as const,
    }));

  return {
    company:
      name === undefined
        ? undefined
        : { name, fallbackName, domain, industry, employees, segment, extra },
    peopleGroups,
  };
};
