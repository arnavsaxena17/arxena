import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ContactEnrichmentWaterfallService } from 'src/engine/core-modules/contact-enrichment/services/contact-enrichment-waterfall.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateRecord = ObjectLiteral & {
  id: string;
  linkedinUrl?: { primaryLinkUrl?: string | null } | null;
  enrichStatus?: string | null;
  personId?: string | null;
};

type PersonRecord = ObjectLiteral & {
  id: string;
  emails?: { primaryEmail?: string | null; additionalEmails?: string[] | null };
};

export type EnrichContactInput = {
  candidateId?: string;
  linkedinUrl?: string;
  wantEmail?: boolean;
  wantPhone?: boolean;
};

@Injectable()
export class EnrichContactService {
  private readonly logger = new Logger(EnrichContactService.name);

  constructor(
    private readonly contactEnrichmentWaterfallService: ContactEnrichmentWaterfallService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: EnrichContactInput;
  }): Promise<{
    success: boolean;
    email: string;
    emails: string[];
    phones: string[];
    source: string;
    enrichStatus: string;
    error?: string;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateId = input.candidateId?.trim() ?? '';
        let linkedinUrl = input.linkedinUrl?.trim() ?? '';
        let personId: string | null = null;

        const candidateRepository = isNonEmptyString(candidateId)
          ? await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            )
          : null;

        if (isDefined(candidateRepository) && isNonEmptyString(candidateId)) {
          const candidate = await candidateRepository.findOne({
            where: { id: candidateId },
            select: ['id', 'linkedinUrl', 'personId'],
          });

          if (!isDefined(candidate)) {
            return {
              success: false,
              email: '',
              emails: [],
              phones: [],
              source: '',
              enrichStatus: 'FAILED',
              error: 'Candidate not found',
            };
          }

          personId = candidate.personId ?? null;
          if (!isNonEmptyString(linkedinUrl)) {
            linkedinUrl = candidate.linkedinUrl?.primaryLinkUrl?.trim() ?? '';
          }

          await candidateRepository.update(candidateId, {
            enrichStatus: 'RUNNING',
            outreachSequenceStage: 'EMAIL_ENRICHING',
          });
        }

        if (!isNonEmptyString(linkedinUrl)) {
          await this.stampCandidate(candidateRepository, candidateId, 'FAILED');

          return {
            success: false,
            email: '',
            emails: [],
            phones: [],
            source: '',
            enrichStatus: 'FAILED',
            error: 'linkedinUrl is required',
          };
        }

        try {
          const result =
            await this.contactEnrichmentWaterfallService.fetchContacts(
              linkedinUrl,
              {
                wantEmail: input.wantEmail !== false,
                wantPhone: input.wantPhone === true,
              },
            );

          const emails = result.emails.filter(isNonEmptyString);
          const phones = result.phones.filter(isNonEmptyString);
          const email = emails[0] ?? '';
          const found = emails.length > 0;
          const enrichStatus = found ? 'FOUND' : 'FAILED';

          await this.stampCandidate(
            candidateRepository,
            candidateId,
            enrichStatus,
            found ? undefined : 'FAILED_ENRICH',
          );

          if (found && isNonEmptyString(personId)) {
            const personRepository =
              await this.globalWorkspaceOrmManager.getRepository<PersonRecord>(
                workspaceId,
                'person',
                { shouldBypassPermissionChecks: true },
              );

            await personRepository.update(personId, {
              emails: {
                primaryEmail: email,
                additionalEmails: emails.slice(1),
              },
            });
          }

          return {
            success: found,
            email,
            emails,
            phones,
            source: result.source,
            enrichStatus,
            error: found ? '' : 'No email found',
          };
        } catch (error) {
          this.logger.error('enrich-contact failed', error);
          await this.stampCandidate(
            candidateRepository,
            candidateId,
            'FAILED',
            'FAILED_ENRICH',
          );

          return {
            success: false,
            email: '',
            emails: [],
            phones: [],
            source: '',
            enrichStatus: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      authContext,
    );
  }

  private async stampCandidate(
    repository: {
      update: (id: string, values: Record<string, unknown>) => Promise<unknown>;
    } | null,
    candidateId: string,
    enrichStatus: string,
    outreachSequenceStage?: string,
  ): Promise<void> {
    if (!isDefined(repository) || !isNonEmptyString(candidateId)) {
      return;
    }

    await repository.update(candidateId, {
      enrichStatus,
      ...(outreachSequenceStage ? { outreachSequenceStage } : {}),
    });
  }
}
