import { Injectable, Logger } from '@nestjs/common';

import { extractLinkedinSlugFromUrl } from 'twenty-shared';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { UnipileAccountPoolService } from 'src/engine/core-modules/arx-chat/services/unipile-account-pool.service';

import { CandidateAvatarStorageService } from './candidate-avatar-storage.service';

type UnipileUserProfileResponse = {
  profile_picture_url?: string | null;
  profile_picture_url_large?: string | null;
  profile_picture?: string | null;
  picture_url?: string | null;
};

@Injectable()
export class CandidateAvatarRefreshService {
  private readonly logger = new Logger(CandidateAvatarRefreshService.name);

  constructor(
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
  ) {}

  extractProfilePictureFromUnipileResponse(
    profile: UnipileUserProfileResponse,
  ): string | null {
    const candidates = [
      profile.profile_picture_url,
      profile.profile_picture_url_large,
      profile.profile_picture,
      profile.picture_url,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  /**
   * Fetches a fresh LinkedIn profile photo via Unipile and ingests to S3.
   * Requires a connected LinkedIn account on the workspace member used for org-chart builds.
   */
  async refreshAndIngestFromLinkedin(input: {
    linkedinUrl: string;
    workspaceId: string;
    workspaceMemberId: string;
    authToken: string;
  }): Promise<string | null> {
    const linkedinUrl = input.linkedinUrl?.trim();
    if (!linkedinUrl) {
      return null;
    }

    const slug = extractLinkedinSlugFromUrl(linkedinUrl);
    if (!slug) {
      return null;
    }

    const accountResult =
      await this.unipileAccountPoolService.getOrCreateUnipileAccount(
        input.workspaceMemberId,
        input.workspaceId,
        input.authToken,
        'LINKEDIN',
      );

    if (!('accountId' in accountResult)) {
      this.logger.warn(
        `Avatar Unipile refresh skipped: no LinkedIn account for workspace=${input.workspaceId}`,
      );
      return null;
    }

    try {
      const response =
        (await this.linkedinUnipileRequestService.makeUnipileRequest(
          `/api/v1/users/${encodeURIComponent(slug)}?account_id=${encodeURIComponent(accountResult.accountId)}`,
        )) as UnipileUserProfileResponse;

      const freshUrl = this.extractProfilePictureFromUnipileResponse(response);
      if (!freshUrl) {
        return null;
      }

      const persisted = await this.candidateAvatarStorageService.ingestFromUrl({
        imageUrl: freshUrl,
        linkedinUrl,
      });

      return this.candidateAvatarStorageService.isPersistedAvatarUrl(persisted)
        ? persisted
        : null;
    } catch (error) {
      this.logger.warn(
        `Avatar Unipile refresh failed for ${linkedinUrl}`,
        error,
      );
      return null;
    }
  }

  /**
   * On proxy miss: try meta linkedinUrl + optional workspace context to refresh.
   */
  async tryRefreshByStableKey(input: {
    stableKey: string;
    workspaceId?: string;
    workspaceMemberId?: string;
    authToken?: string;
  }): Promise<string | null> {
    const meta = await this.candidateAvatarStorageService.readMeta(
      input.stableKey,
    );
    if (!meta?.linkedinUrl?.trim()) {
      return null;
    }

    if (
      !input.workspaceId ||
      !input.workspaceMemberId ||
      !input.authToken?.trim()
    ) {
      return null;
    }

    return this.refreshAndIngestFromLinkedin({
      linkedinUrl: meta.linkedinUrl,
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
      authToken: input.authToken,
    });
  }
}
