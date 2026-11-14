import {
  buildOrgChartS3LookupPlan,
  collectOrgChartCompanyIdsForLookup,
  type OrgChartS3LookupEntry,
} from 'twenty-shared';

import { OrgChartS3Service } from '../services/orgchart-s3.service';

export type OrgChartS3RelativePathCandidate = {
  companyId: string;
  s3Variant?: string;
  persistKey: string;
  relativePath: string;
};

export const buildOrgChartS3RelativePathCandidates = (input: {
  orgChartS3Service: OrgChartS3Service;
  companyId: string;
  companyName?: string;
}): OrgChartS3RelativePathCandidate[] => {
  const resolvedName =
    input.companyName?.trim() || input.companyId.trim() || 'unknown';
  const plan = buildOrgChartS3LookupPlan(input.companyId);
  const seenPaths = new Set<string>();
  const candidates: OrgChartS3RelativePathCandidate[] = [];

  for (const entry of plan) {
    const persistKey = input.orgChartS3Service.persistedCompanyFolderKey(
      entry.companyId,
      resolvedName,
    );
    const relativePath =
      input.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(
        persistKey,
        entry.s3Variant,
      );

    if (seenPaths.has(relativePath)) {
      continue;
    }
    seenPaths.add(relativePath);

    candidates.push({
      companyId: entry.companyId,
      s3Variant: entry.s3Variant,
      persistKey,
      relativePath,
    });
  }

  return candidates;
};

export const collectOrgChartCompanyIdsWithAliases = (
  companyId: string,
): string[] => collectOrgChartCompanyIdsForLookup(companyId);

export type { OrgChartS3LookupEntry };
