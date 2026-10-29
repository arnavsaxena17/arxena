import { isNonEmptyString } from '@sniptt/guards';

import { type OutreachEphemeralCompany } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { type ResolvedCompanyFromRawName } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import { normalizeDomain } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';

export const UNRESOLVABLE_COMPANY_STATUS = 'unresolvable';

export type SpreadsheetCompanyResolutionCounts = {
  // Domain and LinkedIn URL filled from a high-confidence match
  resolved: number;
  // A medium or low match: alternates written, nothing filled
  lowConfidence: number;
  // No company in the index
  unresolvable: number;
  // Elasticsearch failed; the row is left as imported
  lookupFailed: number;
};

const LINKEDIN_COMPANY_URL_PATTERN =
  /linkedin\.com\/(company|school|showcase)\//i;

// Imported LinkedIn columns land in otherFields under a key taken from the
// sheet header, so any LinkedIn company URL among the values counts.
const hasCompanyLinkedinUrl = (company: OutreachEphemeralCompany): boolean =>
  Object.values(company.otherFields ?? {}).some(
    (value) =>
      typeof value === 'string' && LINKEDIN_COMPANY_URL_PATTERN.test(value),
  );

export const needsCompanyResolution = (
  company: OutreachEphemeralCompany,
): boolean =>
  !isNonEmptyString(company.domain) && !hasCompanyLinkedinUrl(company);

export const applyCompanyResolution = (
  company: OutreachEphemeralCompany,
  resolution: ResolvedCompanyFromRawName,
): OutreachEphemeralCompany => {
  if (resolution.lookupFailed) {
    return company;
  }

  if (!resolution.resolved) {
    return {
      ...company,
      status: UNRESOLVABLE_COMPANY_STATUS,
      otherFields: {
        ...company.otherFields,
        matchConfidence: null,
        alternates: [],
      },
    };
  }

  const isHighConfidence = resolution.matchConfidence === 'high';
  const domain = normalizeDomain(resolution.website ?? '');

  return {
    ...company,
    ...(isHighConfidence && isNonEmptyString(domain) ? { domain } : {}),
    otherFields: {
      ...company.otherFields,
      matchConfidence: resolution.matchConfidence,
      // The pick itself, so a medium or low row can be checked against its
      // alternates before anyone pays for a lookup.
      matchedCompany: {
        name: resolution.name,
        website: resolution.website,
        linkedinUrl: resolution.linkedinUrl,
        size: resolution.size,
      },
      alternates: resolution.alternates,
      ...(isHighConfidence && isNonEmptyString(resolution.linkedinUrl)
        ? { linkedinUrl: resolution.linkedinUrl }
        : {}),
    },
  };
};

export const countCompanyResolutions = (
  resolutions: ResolvedCompanyFromRawName[],
): SpreadsheetCompanyResolutionCounts => {
  const counts: SpreadsheetCompanyResolutionCounts = {
    resolved: 0,
    lowConfidence: 0,
    unresolvable: 0,
    lookupFailed: 0,
  };

  for (const resolution of resolutions) {
    if (resolution.lookupFailed) {
      counts.lookupFailed += 1;
    } else if (!resolution.resolved) {
      counts.unresolvable += 1;
    } else if (resolution.matchConfidence === 'high') {
      counts.resolved += 1;
    } else {
      counts.lowConfidence += 1;
    }
  }

  return counts;
};
