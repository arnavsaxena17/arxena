import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import { isValidLinkedInProviderId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-attendee-id.util';
import { mapUnipileLinkedinProfile } from 'src/engine/core-modules/outreach-command/utils/map-unipile-linkedin-profile.util';
import { findOutreachMockUnipileRawProfile } from 'src/engine/core-modules/outreach-command/utils/outreach-mock-unipile-profiles.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
  linkedinProfileId?: string | null;
};

export type VisitLinkedinProfileInput = {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
};

export type VisitLinkedinProfileResult = {
  success: boolean;
  visited: boolean;
  linkedinProfileId: string;
  firstName: string;
  lastName: string;
  headline: string;
  linkedinUrl: string;
  error: string;
};

@Injectable()
export class VisitLinkedinProfileService {
  private readonly logger = new Logger(VisitLinkedinProfileService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: VisitLinkedinProfileInput;
  }): Promise<VisitLinkedinProfileResult> {
    const isOutreachMockEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      );

    if (isOutreachMockEnabled) {
      const identifier =
        extractLinkedinProfileId(input.linkedinProfileId) ||
        extractLinkedinProfileId(input.linkedinUrl) ||
        'mock-linkedin-profile';

      this.logger.log(
        `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock LinkedIn visit for ${identifier}`,
      );

      const fixture = findOutreachMockUnipileRawProfile(identifier);
      const linkedinUrl = isNonEmptyString(input.linkedinUrl)
        ? input.linkedinUrl
        : `https://www.linkedin.com/in/${identifier}`;

      if (isDefined(fixture)) {
        const mapped = mapUnipileLinkedinProfile(fixture, identifier);

        return {
          success: true,
          visited: true,
          linkedinProfileId: mapped.linkedinProfileId,
          firstName: mapped.firstName,
          lastName: mapped.lastName,
          headline: mapped.headline,
          linkedinUrl: mapped.linkedinUrl || linkedinUrl,
          error: '',
        };
      }

      return {
        success: true,
        visited: true,
        linkedinProfileId: identifier,
        firstName: 'Mock',
        lastName: identifier.split('-').slice(-2).join(' ') || 'Profile',
        headline: 'Mock headline for outreach path testing',
        linkedinUrl,
        error: '',
      };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    const resolved =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const profileRepository =
            await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
              workspaceId,
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );

          let accountId = '';
          let workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

          if (isNonEmptyString(workspaceMemberId)) {
            const profile = await profileRepository.findOne({
              where: { id: workspaceMemberId },
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
              withAccount?.id ?? workspaceMemberId;
          }

          let identifier =
            extractLinkedinProfileId(input.linkedinProfileId) ||
            extractLinkedinProfileId(input.linkedinUrl);

          if (
            !isNonEmptyString(identifier) &&
            isNonEmptyString(input.candidateId)
          ) {
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
      return emptyVisitResult(
        resolved.identifier,
        'No LinkedIn Unipile account on workspace member profile',
      );
    }

    if (!isNonEmptyString(resolved.identifier)) {
      return emptyVisitResult(
        '',
        'linkedinUrl or linkedinProfileId is required',
      );
    }

    // notify=true marks the visit on LinkedIn; empty sections keep the call light.
    // Cache is bypassed inside fetchLinkedinUserProfile when notify is true.
    const profile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        resolved.accountId,
        resolved.identifier,
        { notify: true, linkedinSections: [] },
      );

    if (!isDefined(profile)) {
      return emptyVisitResult(
        resolved.identifier,
        'Unipile returned no profile',
      );
    }

    const mapped = mapUnipileLinkedinProfile(profile, resolved.identifier);

    if (isValidLinkedInProviderId(mapped.linkedinProfileId)) {
      await this.linkedinProviderIdStore.saveProviderId({
        workspaceId,
        candidateId: input.candidateId,
        identifier: resolved.identifier,
        providerId: mapped.linkedinProfileId,
      });
    }

    this.logger.log(`Visited LinkedIn profile ${mapped.linkedinProfileId}`);

    return {
      success: true,
      visited: true,
      linkedinProfileId: mapped.linkedinProfileId,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      headline: mapped.headline,
      linkedinUrl: mapped.linkedinUrl,
      error: '',
    };
  }
}

const emptyVisitResult = (
  linkedinProfileId: string,
  error: string,
): VisitLinkedinProfileResult => ({
  success: false,
  visited: false,
  linkedinProfileId,
  firstName: '',
  lastName: '',
  headline: '',
  linkedinUrl: '',
  error,
});
