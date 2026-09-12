import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral, Repository } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import {
  OUTREACH_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME,
  type OutreachWorkspaceProfileBootstrapJobData,
} from 'src/engine/core-modules/outreach-command/jobs/outreach-workspace-profile-bootstrap.job-constants';
import { OutreachCompanyEnrichmentCollectorService } from 'src/engine/core-modules/outreach-command/services/outreach-company-enrichment-collector.service';
import { OutreachCompanyProfileSummarizerService } from 'src/engine/core-modules/outreach-command/services/outreach-company-profile-summarizer.service';
import { IcpBootstrapSummarizerService } from 'src/engine/core-modules/outreach-command/services/outreach-icp-bootstrap-summarizer.service';
import { stringifyIcpSpec } from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';
import { buildOutreachWorkspaceProfileDraftFromDomain } from 'src/engine/core-modules/outreach-command/utils/outreach-workspace-profile-draft.util';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type {
  LinkedInPeopleSearchResult,
  LinkedInSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { getDomainFromEmail } from 'src/utils/get-domain-from-email';
import { isWorkEmail } from 'src/utils/is-work-email';

type WorkspaceMemberRecord = ObjectLiteral & {
  id: string;
  userEmail?: string | null;
  name?: { firstName?: string; lastName?: string } | null;
  linkedinUrl?: string | null;
  linkedinProfile?: Record<string, unknown> | null;
};

const isPeopleSearchResult = (
  item: LinkedInSearchResult,
): item is LinkedInPeopleSearchResult => item.type === 'PEOPLE';

@Injectable()
export class OutreachWorkspaceProfileProvisioningService {
  private readonly logger = new Logger(
    OutreachWorkspaceProfileProvisioningService.name,
  );

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectMessageQueue(MessageQueue.workspaceQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly companyEnrichmentCollector: OutreachCompanyEnrichmentCollectorService,
    private readonly companyProfileSummarizer: OutreachCompanyProfileSummarizerService,
    private readonly icpBootstrapSummarizer: IcpBootstrapSummarizerService,
    @Optional()
    private readonly linkedInSearchService?: LinkedInSearchService,
    @Optional()
    private readonly linkedinUnipileRequestService?: LinkedinUnipileRequestService,
  ) {}

  async enqueueBootstrap(
    data: OutreachWorkspaceProfileBootstrapJobData,
  ): Promise<void> {
    await this.messageQueueService.add<OutreachWorkspaceProfileBootstrapJobData>(
      OUTREACH_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME,
      data,
      { retryLimit: 2 },
    );
  }

  async regenerateWorkspaceProfile(
    data: OutreachWorkspaceProfileBootstrapJobData,
  ): Promise<void> {
    await this.bootstrapWorkspaceProfile({
      ...data,
      force: true,
    });
  }

  async bootstrapWorkspaceProfile(
    data: OutreachWorkspaceProfileBootstrapJobData,
  ): Promise<void> {
    const {
      workspaceId,
      userEmail,
      workspaceDisplayName,
      userFirstName,
      userLastName,
    } = data;

    if (!isNonEmptyString(workspaceId)) {
      return;
    }

    try {
      const existingWorkspace = await this.workspaceRepository.findOneBy({
        id: workspaceId,
      });

      if (!isDefined(existingWorkspace)) {
        this.logger.warn(
          `Skipping workspace profile bootstrap for ${workspaceId}: workspace not found`,
        );

        return;
      }

      const force = data.force === true;

      if (
        !force &&
        (isNonEmptyString(existingWorkspace.icpSpec) ||
          isDefined(existingWorkspace.enrichmentJson))
      ) {
        this.logger.log(
          `Skipping GTM workspace profile bootstrap for ${workspaceId}: already enriched`,
        );

        return;
      }

      const workEmail =
        isNonEmptyString(userEmail) && isWorkEmail(userEmail)
          ? userEmail
          : null;
      const domainFromProfile = existingWorkspace.companyDomain
        ?.trim()
        .toLowerCase();
      const domainFromEmail = workEmail
        ? getDomainFromEmail(workEmail)?.toLowerCase()
        : undefined;
      const domain = isNonEmptyString(domainFromProfile)
        ? domainFromProfile
        : domainFromEmail;

      if (!isNonEmptyString(domain)) {
        if (force) {
          throw new Error(
            'Cannot regenerate workspace profile: no company domain on the workspace or work email.',
          );
        }

        return;
      }

      const enrichmentSources = await this.companyEnrichmentCollector.collect({
        domain,
        workspaceDisplayName,
        workspaceId,
      });

      const llmCompanyProfile =
        await this.companyProfileSummarizer.summarizeFromEnrichmentSources({
          domain,
          workspaceDisplayName,
          enrichment: enrichmentSources,
          workspaceId,
        });

      const draft = buildOutreachWorkspaceProfileDraftFromDomain({
        domain,
        workspaceDisplayName,
        wikiCompany: enrichmentSources.wikiCompany,
        wikidataCompany: enrichmentSources.wikidataCompany,
        linkedInSearchHit: enrichmentSources.linkedInSearchHit,
        linkedInCompanyProfile: enrichmentSources.linkedInCompanyProfile,
        webSearchCompany: enrichmentSources.webSearchCompany,
        llmCompanyProfile,
      });

      const llmIcp = await this.icpBootstrapSummarizer.draftFromSellerCompany({
        domain,
        companyName: draft.companyName,
        industry: draft.industry,
        summary: draft.summary,
        employeeRange: draft.employeeRange,
        hq: draft.hq,
        workspaceId,
      });

      if (llmIcp) {
        draft.icpSpec = {
          targetTitles: llmIcp.targetTitles,
          locations: llmIcp.locations,
        };
      }

      draft.enrichmentJson = {
        ...draft.enrichmentJson,
        sourceIds: enrichmentSources.sourceIds,
      };

      await this.workspaceRepository.update(
        { id: workspaceId },
        {
          companyName: draft.companyName,
          companyDomain: draft.companyDomain,
          industry: draft.industry,
          summary: draft.summary,
          employeeRange: draft.employeeRange,
          hq: draft.hq,
          enrichmentJson: draft.enrichmentJson,
          icpSpec: stringifyIcpSpec(draft.icpSpec),
        },
      );

      await this.maybeEnrichWorkspaceMemberLinkedInProfile({
        workspaceId,
        userEmail: workEmail,
        userFirstName,
        userLastName,
        companyName: draft.companyName,
        linkedInAccountId: enrichmentSources.linkedInAccountId,
      });
    } catch (error) {
      this.logger.error(
        `bootstrapWorkspaceProfile failed for workspace ${workspaceId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async maybeEnrichWorkspaceMemberLinkedInProfile(input: {
    workspaceId: string;
    userEmail: string | null;
    userFirstName?: string | null;
    userLastName?: string | null;
    companyName: string;
    linkedInAccountId?: string;
  }): Promise<void> {
    if (
      !isNonEmptyString(input.linkedInAccountId) ||
      !isDefined(this.linkedInSearchService) ||
      !isDefined(this.linkedinUnipileRequestService)
    ) {
      return;
    }

    const firstName = input.userFirstName?.trim() ?? '';
    const lastName = input.userLastName?.trim() ?? '';
    if (!isNonEmptyString(firstName) && !isNonEmptyString(lastName)) {
      return;
    }

    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const memberRepository =
            await this.getWorkspaceMemberRepository(input.workspaceId);

          if (!isDefined(memberRepository)) {
            return;
          }

          const workspaceMember = await this.findActivatingWorkspaceMember({
            memberRepository,
            userEmail: input.userEmail,
            firstName,
            lastName,
          });

          if (!isDefined(workspaceMember)) {
            return;
          }

          if (
            isNonEmptyString(workspaceMember.linkedinUrl) ||
            isDefined(workspaceMember.linkedinProfile)
          ) {
            return;
          }

          const searchResponse =
            await this.linkedInSearchService.searchPeopleClassic(
              {
                keywords: null,
                industry: null,
                location: null,
                profile_language: null,
                network_distance: null,
                company: isNonEmptyString(input.companyName)
                  ? [input.companyName]
                  : null,
                past_company: null,
                school: null,
                service: null,
                connections_of: null,
                followers_of: null,
                open_to: null,
                advanced_keywords: {
                  first_name: isNonEmptyString(firstName) ? firstName : null,
                  last_name: isNonEmptyString(lastName) ? lastName : null,
                  title: null,
                  company: isNonEmptyString(input.companyName)
                    ? input.companyName
                    : null,
                  school: null,
                },
              },
              input.linkedInAccountId,
              { limit: 5 },
            );

          const personHit = this.pickBestPersonSearchHit(
            searchResponse.items.filter(isPeopleSearchResult),
            { firstName, lastName },
          );

          if (!personHit) {
            return;
          }

          const personIdentifier =
            personHit.public_identifier ||
            personHit.public_profile_url ||
            personHit.profile_url ||
            personHit.id;

          if (!isNonEmptyString(personIdentifier)) {
            return;
          }

          const linkedinUrl =
            personHit.public_profile_url ||
            personHit.profile_url ||
            (personHit.public_identifier
              ? `https://www.linkedin.com/in/${personHit.public_identifier}`
              : null);

          let linkedinProfile: Record<string, unknown> | null = null;

          try {
            linkedinProfile =
              await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
                input.linkedInAccountId,
                personIdentifier,
                { linkedinSections: ['*'] },
              );
          } catch (error) {
            this.logger.warn(
              `Person LinkedIn profile fetch failed for ${personIdentifier}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          const systemActor = buildCreatedByFromSystem();
          const profileFields = {
            linkedinUrl: linkedinUrl ?? null,
            linkedinProfile:
              linkedinProfile ??
              ({
                searchHit: personHit,
                fetchedAt: new Date().toISOString(),
              } as Record<string, unknown>),
            updatedBy: systemActor,
          };

          await memberRepository.update(
            { id: workspaceMember.id },
            profileFields,
          );

          this.logger.log(
            `Saved LinkedIn profile on workspaceMember for member ${workspaceMember.id}`,
          );
        },
        buildSystemAuthContext(input.workspaceId),
      );
    } catch (error) {
      this.logger.warn(
        `Workspace member LinkedIn enrich skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private pickBestPersonSearchHit(
    items: LinkedInPeopleSearchResult[],
    input: { firstName: string; lastName: string },
  ): LinkedInPeopleSearchResult | null {
    if (items.length === 0) {
      return null;
    }

    const firstName = input.firstName.toLowerCase();
    const lastName = input.lastName.toLowerCase();

    return (
      items.find((item) => {
        const itemFirst = item.first_name?.toLowerCase() ?? '';
        const itemLast = item.last_name?.toLowerCase() ?? '';

        return (
          (!isNonEmptyString(firstName) || itemFirst === firstName) &&
          (!isNonEmptyString(lastName) || itemLast === lastName)
        );
      }) ?? items[0]
    );
  }

  private async findActivatingWorkspaceMember(input: {
    memberRepository: {
      find: (options: {
        take?: number;
        order?: Record<string, 'ASC' | 'DESC'>;
      }) => Promise<WorkspaceMemberRecord[]>;
    };
    userEmail: string | null;
    firstName: string;
    lastName: string;
  }): Promise<WorkspaceMemberRecord | null> {
    const members = await input.memberRepository.find({
      take: 20,
      order: { createdAt: 'ASC' },
    });

    if (members.length === 0) {
      return null;
    }

    if (isNonEmptyString(input.userEmail)) {
      const byEmail = members.find(
        (member) =>
          member.userEmail?.trim().toLowerCase() ===
          input.userEmail?.trim().toLowerCase(),
      );
      if (byEmail) {
        return byEmail;
      }
    }

    const byName = members.find((member) => {
      const memberFirst = member.name?.firstName?.trim().toLowerCase() ?? '';
      const memberLast = member.name?.lastName?.trim().toLowerCase() ?? '';

      return (
        (!isNonEmptyString(input.firstName) ||
          memberFirst === input.firstName.toLowerCase()) &&
        (!isNonEmptyString(input.lastName) ||
          memberLast === input.lastName.toLowerCase())
      );
    });

    return byName ?? members[0] ?? null;
  }

  private async getWorkspaceMemberRepository(workspaceId: string) {
    try {
      return await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberRecord>(
        workspaceId,
        'workspaceMember',
        { shouldBypassPermissionChecks: true },
      );
    } catch (error) {
      this.logger.warn(
        `workspaceMember unavailable for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
