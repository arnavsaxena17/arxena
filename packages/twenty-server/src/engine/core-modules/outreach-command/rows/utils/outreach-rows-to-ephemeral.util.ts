import { type OutreachEphemeralCompany } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { type OutreachRow } from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';

const companyOtherFields = (row: OutreachRow): Record<string, unknown> => ({
  ...(row.otherFields ?? {}),
  ...(row.linkedinUrl ? { linkedinUrl: row.linkedinUrl } : {}),
});

export const outreachRowToEphemeralCompany = (
  row: OutreachRow,
): OutreachEphemeralCompany => {
  const otherFields = companyOtherFields(row);

  return {
    id: row.key,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    employees: row.size,
    segment: '',
    icpFit: '',
    status: 'new',
    ...(Object.keys(otherFields).length > 0 ? { otherFields } : {}),
  };
};

export const outreachRowToEphemeralPerson = (
  row: OutreachRow,
): OutreachEphemeralPerson => ({
  id: row.key,
  name: row.name,
  title: row.title,
  headline: row.title,
  summary: row.about,
  companyId: '',
  companyName: row.companyName,
  linkedinUrl: row.linkedinUrl,
  warmPath: '—',
  stage: 'queued',
  email: row.email,
  ...(row.otherFields ? { otherFields: row.otherFields } : {}),
});
