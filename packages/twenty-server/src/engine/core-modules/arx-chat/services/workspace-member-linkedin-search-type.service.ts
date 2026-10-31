import { Injectable, Logger } from '@nestjs/common';

import {
    inferLinkedInSearchTypeFromUnipileOwnerProfile,
    type LinkedInSearchType,
} from 'twenty-shared';

import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

const LINKEDIN_SEARCH_TYPES = new Set<LinkedInSearchType>([
  'classic',
  'sales_navigator',
  'recruiter',
]);

const normalizeStoredSearchType = (
  raw: string | null | undefined,
): LinkedInSearchType | null => {
  const trimmed = raw?.trim().toLowerCase().replace(/-/g, '_');
  if (!trimmed) {
    return null;
  }
  if (LINKEDIN_SEARCH_TYPES.has(trimmed as LinkedInSearchType)) {
    return trimmed as LinkedInSearchType;
  }
  return null;
};

@Injectable()
export class WorkspaceMemberLinkedinSearchTypeService {
  private readonly logger = new Logger(
    WorkspaceMemberLinkedinSearchTypeService.name,
  );

  constructor(
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  async getStoredSearchType(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<LinkedInSearchType | null> {
    const profile =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );
    return normalizeStoredSearchType(profile?.linkedinSearchType ?? null);
  }

  async resolveSearchTypeForMember(
    workspaceMemberId: string,
    authToken: string,
    fallback: LinkedInSearchType = 'classic',
  ): Promise<LinkedInSearchType> {
    const stored = await this.getStoredSearchType(workspaceMemberId, authToken);
    return stored ?? fallback;
  }

  async inferAndPersistFromAccountId(
    workspaceMemberId: string,
    authToken: string,
    accountId: string,
  ): Promise<LinkedInSearchType | null> {
    const trimmedAccountId = accountId?.trim();
    if (!trimmedAccountId) {
      return null;
    }

    const ownerProfile =
      await this.linkedinUnipileRequestService.fetchLinkedinOwnerProfile(
        trimmedAccountId,
      );
    if (!ownerProfile) {
      this.logger.warn(
        `Could not fetch Unipile users/me for account ${trimmedAccountId}; skipping linkedinSearchType persist`,
      );
      return null;
    }

    const searchType =
      inferLinkedInSearchTypeFromUnipileOwnerProfile(ownerProfile);
    await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedInSearchType(
      workspaceMemberId,
      authToken,
      searchType,
    );
    this.logger.log(
      `Persisted linkedinSearchType=${searchType} for workspace member ${workspaceMemberId} account=${trimmedAccountId}`,
    );
    return searchType;
  }

  async refreshFromAccountId(
    workspaceMemberId: string,
    authToken: string,
    accountId: string,
  ): Promise<LinkedInSearchType | null> {
    return this.inferAndPersistFromAccountId(
      workspaceMemberId,
      authToken,
      accountId,
    );
  }
}
