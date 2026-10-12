import {
  type OutreachListEntity,
  type OutreachListRow,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';

const COMPANY_COLUMNS: Array<[string, keyof OutreachListRow]> = [
  ['name', 'name'],
  ['website', 'website'],
  ['domain', 'domain'],
  ['linkedin_url', 'linkedinUrl'],
  ['industry', 'industry'],
  ['location', 'location'],
  ['country', 'country'],
  ['size', 'size'],
  ['about', 'about'],
  ['source', 'source'],
  ['in_crm', 'inCrm'],
];

const PEOPLE_COLUMNS: Array<[string, keyof OutreachListRow]> = [
  ['name', 'name'],
  ['title', 'title'],
  ['company', 'companyName'],
  ['location', 'location'],
  ['country', 'country'],
  ['linkedin_url', 'linkedinUrl'],
  ['email', 'email'],
  ['source', 'source'],
  ['in_crm', 'inCrm'],
];

export const OUTREACH_LIST_CSV_COLUMNS: Record<
  OutreachListEntity,
  Array<[string, keyof OutreachListRow]>
> = { company: COMPANY_COLUMNS, people: PEOPLE_COLUMNS };

// Leading =, +, - and @ make spreadsheets run the cell as a formula
const escapeCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const buildOutreachListCsv = (
  entity: OutreachListEntity,
  rows: OutreachListRow[],
): string => {
  const columns = OUTREACH_LIST_CSV_COLUMNS[entity];
  const lines = [columns.map(([header]) => header).join(',')];

  for (const row of rows) {
    lines.push(
      columns
        .map(([, field]) => {
          const value = row[field];

          return escapeCell(
            typeof value === 'boolean' ? (value ? 'yes' : 'no') : (value ?? ''),
          );
        })
        .join(','),
    );
  }

  // BOM so Excel reads UTF-8 names correctly
  return `﻿${lines.join('\n')}\n`;
};
