import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type ResolvedCompanyFromRawName } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import { type FindPeopleByCompanyTarget } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';
import { type UpsertOutreachTargetCompaniesInput } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool.schema';

type TabCompany = UpsertOutreachTargetCompaniesInput['companies'][number];

// Where a typed company row's facts came from: the company index, or only the
// name and domain the model typed
export type TypedCompanyIdentitySource = 'index' | 'model';

const toHost = (value: string | null | undefined): string =>
  isNonEmptyString(value)
    ? value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
    : '';

// The index match is used only when it is clearly this company. A medium
// name match needs the typed domain to agree, so a near name ("Hinduja
// Hospital" -> "Hinduja Tech") never lends its industry and size to the row.
export const isTrustedIndexMatch = (
  company: Pick<FindPeopleByCompanyTarget, 'domain'>,
  resolved: ResolvedCompanyFromRawName | null | undefined,
): resolved is ResolvedCompanyFromRawName => {
  if (
    !isDefined(resolved) ||
    resolved.resolved !== true ||
    resolved.lookupFailed === true
  ) {
    return false;
  }

  const typedHost = toHost(company.domain);
  const indexHost = toHost(resolved.website);
  const domainsAgree =
    typedHost !== '' && indexHost !== '' && typedHost === indexHost;

  if (resolved.matchConfidence === 'high') {
    return true;
  }

  return resolved.matchConfidence === 'medium' && domainsAgree;
};

// The Companies tab row for a company the model typed. What the model typed
// wins; the index fills the gaps (industry, size, LinkedIn, country) and marks
// the row so a reader can tell a checked company from an unchecked one.
export const buildTypedCompanyRow = (
  company: FindPeopleByCompanyTarget,
  resolved: ResolvedCompanyFromRawName | null | undefined,
): TabCompany => {
  const typedHost = toHost(company.domain);
  const typedEmployees = isDefined(company.employees)
    ? String(company.employees)
    : '';

  if (!isTrustedIndexMatch(company, resolved)) {
    return {
      name: company.name,
      domain: typedHost,
      industry: company.industry ?? '',
      employees: typedEmployees,
      segment: '',
      icpFit: '',
      status: 'new',
      otherFields: {
        identitySource: 'model' satisfies TypedCompanyIdentitySource,
      },
    };
  }

  const indexHost = toHost(resolved.website);

  return {
    name: company.name,
    domain: typedHost !== '' ? typedHost : indexHost,
    industry: isNonEmptyString(company.industry)
      ? company.industry
      : (resolved.industry ?? ''),
    employees: typedEmployees !== '' ? typedEmployees : (resolved.size ?? ''),
    segment: '',
    icpFit: '',
    status: 'new',
    otherFields: {
      identitySource: 'index' satisfies TypedCompanyIdentitySource,
      ...(isNonEmptyString(resolved.id) && { indexCompanyId: resolved.id }),
      ...(isNonEmptyString(resolved.name) && { indexName: resolved.name }),
      ...(isNonEmptyString(resolved.linkedinUrl) && {
        linkedinUrl: resolved.linkedinUrl,
      }),
      ...(isNonEmptyString(resolved.country) && { country: resolved.country }),
      ...(isNonEmptyString(resolved.founded) && { founded: resolved.founded }),
      ...(resolved.matchConfidence !== null && {
        indexMatchConfidence: resolved.matchConfidence,
      }),
      // A typed domain the index disagrees with is kept, but flagged: the
      // model may have guessed it
      ...(typedHost !== '' &&
        indexHost !== '' &&
        typedHost !== indexHost && { indexWebsite: indexHost }),
    },
  };
};
