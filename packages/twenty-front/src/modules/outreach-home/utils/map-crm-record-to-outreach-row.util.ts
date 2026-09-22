import { isDefined } from 'twenty-shared/utils';

import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  type OutreachCompanyRow,
  type OutreachPersonRow,
} from '@/outreach-home/types/outreach-home.types';

const asNonEmptyString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
};

const primaryLinkUrl = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (isDefined(value) && typeof value === 'object') {
    return asNonEmptyString(
      (value as { primaryLinkUrl?: unknown }).primaryLinkUrl,
    );
  }

  return '';
};

const composePersonName = (record: ObjectRecord): string => {
  const nameValue = record.name;

  if (typeof nameValue === 'string') {
    return nameValue.trim();
  }

  if (isDefined(nameValue) && typeof nameValue === 'object') {
    const firstName = asNonEmptyString(
      (nameValue as { firstName?: unknown }).firstName,
    );
    const lastName = asNonEmptyString(
      (nameValue as { lastName?: unknown }).lastName,
    );

    return [firstName, lastName].filter(Boolean).join(' ').trim();
  }

  return '';
};

export const mapCrmCompanyRecordToOutreachCompanyRow = (
  record: ObjectRecord,
): OutreachCompanyRow | null => {
  const id = asNonEmptyString(record.id);

  if (id.length === 0) {
    return null;
  }

  const domain =
    primaryLinkUrl(record.domainName) ||
    asNonEmptyString(
      isDefined(record.domainName) && typeof record.domainName === 'object'
        ? (record.domainName as { primaryLinkLabel?: unknown }).primaryLinkLabel
        : undefined,
    );

  return {
    id,
    name: asNonEmptyString(record.name) || 'Untitled',
    domain,
    industry: asNonEmptyString(record.industry),
    employees: asNonEmptyString(record.employees),
    segment: asNonEmptyString(record.icpSegment),
    icpFit: asNonEmptyString(record.icpFit),
    status: 'new',
  };
};

export const mapCrmPersonRecordToOutreachPersonRow = (
  record: ObjectRecord,
): OutreachPersonRow | null => {
  const id = asNonEmptyString(record.id);

  if (id.length === 0) {
    return null;
  }

  const companyRelation =
    isDefined(record.company) && typeof record.company === 'object'
      ? (record.company as { id?: unknown; name?: unknown })
      : null;

  const companyId =
    asNonEmptyString(record.companyId) || asNonEmptyString(companyRelation?.id);
  const companyName =
    asNonEmptyString(record.jobCompanyName) ||
    asNonEmptyString(companyRelation?.name);

  const email =
    asNonEmptyString(
      isDefined(record.emails) && typeof record.emails === 'object'
        ? (record.emails as { primaryEmail?: unknown }).primaryEmail
        : undefined,
    ) || asNonEmptyString(record.email);

  return {
    id,
    name: composePersonName(record) || 'Untitled',
    title: asNonEmptyString(record.jobTitle),
    companyId,
    companyName,
    linkedinUrl: primaryLinkUrl(record.linkedinLink),
    warmPath: '—',
    stage: 'QUEUED',
    email,
    locationName: asNonEmptyString(record.locationName),
  };
};

export const mapCrmCompanyRecordsToOutreachCompanyRows = (
  records: ObjectRecord[],
): OutreachCompanyRow[] =>
  records.map(mapCrmCompanyRecordToOutreachCompanyRow).filter(isDefined);

export const mapCrmPersonRecordsToOutreachPersonRows = (
  records: ObjectRecord[],
): OutreachPersonRow[] =>
  records.map(mapCrmPersonRecordToOutreachPersonRow).filter(isDefined);
