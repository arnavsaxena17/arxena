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
import { toUploadProfilesPerson } from 'src/engine/core-modules/outreach-command/utils/normalize-upload-people.util';
import {
  findOutreachMockUnipileRawProfile,
  mapOutreachMockUnipileProfile,
} from 'src/engine/core-modules/outreach-command/utils/outreach-mock-unipile-profiles.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
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
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly featureFlagService: FeatureFlagService,
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
    firstName: string;
    lastName: string;
    headline: string;
    about: string;
    location: string;
    linkedinUrl: string;
    profilePictureUrl: string;
    experience: Array<{
      company: string;
      position: string;
      location: string;
      description: string;
      start: string;
      end: string;
    }>;
    skills: string[];
    connectionsCount?: number;
    followersCount?: number;
    sharedConnectionsCount?: number;
    networkDistance?: string;
    recruitingActivity?: unknown[];
    snapshot: string;
    people: Array<Record<string, unknown>>;
    error: string;
  }> {
    // temporary: `&& false` forces real Unipile; send/connect stay mock-gated
    const isOutreachMockEnabled =
      (await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      )) && false;

    if (isOutreachMockEnabled) {
      const identifier =
        extractLinkedinProfileId(input.linkedinProfileId) ||
        extractLinkedinProfileId(input.linkedinUrl) ||
        'mock-linkedin-profile';

      this.logger.log(
        `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock LinkedIn profile for ${identifier}`,
      );

      const fixture = findOutreachMockUnipileRawProfile(identifier);

      if (isDefined(fixture)) {
        const mapped = mapOutreachMockUnipileProfile(fixture);
        const person = toUploadProfilesPerson({
          ...mapped,
          current_positions: mapped.experience,
        });

        return {
          ...mapped,
          people: person ? [person] : [],
          error: '',
        };
      }

      const linkedinUrl = isNonEmptyString(input.linkedinUrl)
        ? input.linkedinUrl
        : `https://www.linkedin.com/in/${identifier}`;
      const mapped = {
        success: true as const,
        linkedinProfileId: identifier,
        firstName: 'Mock',
        lastName: identifier.split('-').slice(-2).join(' ') || 'Profile',
        headline: 'Mock headline for outreach path testing',
        about: 'Mock about section',
        location: 'Bengaluru, India',
        linkedinUrl,
        profilePictureUrl: '',
        experience: [
          {
            company: 'Mock Co',
            position: 'VP Talent',
            location: 'Bengaluru',
            description: '',
            start: '2020-01',
            end: '',
          },
        ],
        skills: ['Recruiting'],
        snapshot: `Mock profile for ${identifier}`,
      };
      const person = toUploadProfilesPerson(mapped);

      return {
        ...mapped,
        people: person ? [person] : [],
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
            workspaceMemberId = withAccount?.id ?? workspaceMemberId;
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
      return {
        ...emptyProfile(resolved.identifier),
        error: 'No LinkedIn Unipile account on workspace member profile',
      };
    }

    if (!isNonEmptyString(resolved.identifier)) {
      return {
        ...emptyProfile(''),
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
        ...emptyProfile(resolved.identifier),
        error: 'Unipile returned no profile',
      };
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

    this.logger.log(`Fetched LinkedIn profile ${mapped.linkedinProfileId}`);

    const person = toUploadProfilesPerson(mapped);

    return {
      ...mapped,
      people: person ? [person] : [],
    };
  }
}

const emptyProfile = (linkedinProfileId: string) => ({
  success: false as const,
  linkedinProfileId,
  firstName: '',
  lastName: '',
  headline: '',
  about: '',
  location: '',
  linkedinUrl: '',
  profilePictureUrl: '',
  experience: [] as Array<{
    company: string;
    position: string;
    location: string;
    description: string;
    start: string;
    end: string;
  }>,
  skills: [] as string[],
  snapshot: '',
  people: [] as Array<Record<string, unknown>>,
  error: '',
});
