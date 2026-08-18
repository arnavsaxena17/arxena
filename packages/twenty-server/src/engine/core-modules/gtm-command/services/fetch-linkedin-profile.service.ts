import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberProfileRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
  linkedinProfileId?: string | null;
};

export type FetchLinkedinProfileInput = {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
};

@Injectable()
export class FetchLinkedinProfileService {
  private readonly logger = new Logger(FetchLinkedinProfileService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchLinkedinProfileInput;
  }): Promise<{
    success: boolean;
    linkedinProfileId: string;
    headline: string;
    about: string;
    experience: unknown;
    snapshot: string;
    error?: string;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    const resolved = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfileRecord>(
            workspaceId,
            'workspaceMemberProfile',
            { shouldBypassPermissionChecks: true },
          );

        let accountId = '';
        let workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

        if (isNonEmptyString(workspaceMemberId)) {
          const profile = await profileRepository.findOne({
            where: { workspaceMemberId },
          });

          accountId = profile?.linkedinUnipileAccountId?.trim() ?? '';
        }

        if (!isNonEmptyString(accountId)) {
          const anyProfile = await profileRepository.find({
            where: {},
            take: 20,
          });
          const withAccount = anyProfile.find((row) =>
            isNonEmptyString(row.linkedinUnipileAccountId),
          );

          accountId = withAccount?.linkedinUnipileAccountId?.trim() ?? '';
          workspaceMemberId =
            withAccount?.workspaceMemberId ?? workspaceMemberId;
        }

        let identifier =
          extractLinkedinProfileId(input.linkedinProfileId) ||
          extractLinkedinProfileId(input.linkedinUrl);

        if (!isNonEmptyString(identifier) && isNonEmptyString(input.candidateId)) {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            );
          const candidate = await candidateRepository.findOne({
            where: { id: input.candidateId },
          });

          identifier =
            extractLinkedinProfileId(candidate?.linkedinProfileId) ||
            extractLinkedinProfileId(candidate?.linkedinUrl?.primaryLinkUrl);
        }

        return { accountId, identifier, workspaceMemberId };
      },
      authContext,
    );

    if (!isNonEmptyString(resolved.accountId)) {
      return {
        success: false,
        linkedinProfileId: '',
        headline: '',
        about: '',
        experience: [],
        snapshot: '',
        error: 'No LinkedIn Unipile account on workspace member profile',
      };
    }

    if (!isNonEmptyString(resolved.identifier)) {
      return {
        success: false,
        linkedinProfileId: '',
        headline: '',
        about: '',
        experience: [],
        snapshot: '',
        error: 'linkedinUrl or linkedinProfileId is required',
      };
    }

    const profile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        resolved.accountId,
        resolved.identifier,
      );

    if (!isDefined(profile)) {
      return {
        success: false,
        linkedinProfileId: resolved.identifier,
        headline: '',
        about: '',
        experience: [],
        snapshot: '',
        error: 'Unipile returned no profile',
      };
    }

    const headline =
      typeof profile.headline === 'string' ? profile.headline : '';
    const about =
      typeof profile.about === 'string'
        ? profile.about
        : typeof profile.summary === 'string'
          ? profile.summary
          : '';
    const experience = profile.work_experience ?? profile.experience ?? [];
    const snapshot = JSON.stringify(profile);
    const linkedinProfileId =
      (typeof profile.public_identifier === 'string' &&
        profile.public_identifier) ||
      (typeof profile.provider_id === 'string' && profile.provider_id) ||
      resolved.identifier;

    if (isNonEmptyString(input.candidateId)) {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            );

          await candidateRepository.update(input.candidateId as string, {
            linkedinProfileId,
            linkedinProfileSnapshot: snapshot,
          });
        },
        authContext,
      );
    }

    this.logger.log(`Fetched LinkedIn profile ${linkedinProfileId}`);

    return {
      success: true,
      linkedinProfileId,
      headline,
      about,
      experience,
      snapshot,
    };
  }
}
