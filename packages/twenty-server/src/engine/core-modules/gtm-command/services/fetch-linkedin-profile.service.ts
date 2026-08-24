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
    snapshot: string;
    error: string;
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

    const mapped = mapUnipileProfile(profile, resolved.identifier);

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
            linkedinProfileId: mapped.linkedinProfileId,
          });
        },
        authContext,
      );
    }

    this.logger.log(`Fetched LinkedIn profile ${mapped.linkedinProfileId}`);

    return mapped;
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
  error: '',
});

const readProfileString = (
  profile: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const mapExperience = (
  profile: Record<string, unknown>,
): Array<{
  company: string;
  position: string;
  location: string;
  description: string;
  start: string;
  end: string;
}> => {
  const raw = profile.work_experience ?? profile.experience;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const nestedCompany =
        item.company && typeof item.company === 'object'
          ? (item.company as Record<string, unknown>)
          : undefined;

      return {
        company:
          readProfileString(item, ['company', 'companyName', 'company_name']) ||
          (nestedCompany
            ? readProfileString(nestedCompany, ['name', 'title'])
            : ''),
        position: readProfileString(item, ['position', 'title', 'jobTitle']),
        location: readProfileString(item, ['location']),
        description: readProfileString(item, ['description', 'summary']),
        start: readProfileString(item, ['start', 'startDate', 'start_date']),
        end: readProfileString(item, ['end', 'endDate', 'end_date']),
      };
    });
};

const mapSkills = (profile: Record<string, unknown>): string[] => {
  const raw = profile.skills;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);
};

const mapUnipileProfile = (
  profile: Record<string, unknown>,
  fallbackIdentifier: string,
) => {
  const linkedinProfileId =
    readProfileString(profile, ['public_identifier', 'provider_id']) ||
    fallbackIdentifier;
  const firstName = readProfileString(profile, ['first_name', 'firstName']);
  const lastName = readProfileString(profile, ['last_name', 'lastName']);

  return {
    success: true as const,
    linkedinProfileId,
    firstName,
    lastName,
    headline: readProfileString(profile, ['headline']),
    about: readProfileString(profile, ['about', 'summary']),
    location: readProfileString(profile, ['location']),
    linkedinUrl:
      readProfileString(profile, ['profile_url', 'linkedinUrl', 'url']) ||
      (linkedinProfileId
        ? `https://www.linkedin.com/in/${linkedinProfileId}`
        : ''),
    profilePictureUrl: readProfileString(profile, [
      'profile_picture_url',
      'profilePictureUrl',
      'picture_url',
    ]),
    experience: mapExperience(profile),
    skills: mapSkills(profile),
    snapshot: JSON.stringify(profile),
    error: '',
  };
};
