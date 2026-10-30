import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  type OutreachEntity,
  type OutreachRow,
} from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';
import { buildOutreachRow } from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-normalizers.util';

// The tab row is the working set; the row shape used by CSV and CRM keys is
// the same one the search tools normalize into. Keep the tab id so a match can
// be marked or removed on the tab.
export const outreachTabRowToListRow = (
  entity: OutreachEntity,
  row: OutreachTabRow,
): OutreachRow | null =>
  entity === 'company'
    ? buildOutreachRow('company', 'other', {
        id: row.id,
        name: row.name,
        domain: row.domain ?? '',
        website: row.domain ? `https://${row.domain}` : '',
        linkedinUrl: row.linkedinUrl ?? '',
        industry: row.industry ?? '',
        location: row.locationName ?? '',
        size: row.employees ?? '',
        otherFields: row.otherFields,
      })
    : buildOutreachRow('people', 'other', {
        id: row.id,
        name: row.name,
        title: row.title ?? '',
        companyName: row.companyName ?? '',
        linkedinUrl: row.linkedinUrl ?? '',
        location: row.locationName ?? '',
        otherFields: row.otherFields,
      });

export const outreachTabRowsToListRows = (
  entity: OutreachEntity,
  rows: OutreachTabRow[],
): OutreachRow[] =>
  rows
    .map((row) => outreachTabRowToListRow(entity, row))
    .filter((row): row is OutreachRow => row !== null);
