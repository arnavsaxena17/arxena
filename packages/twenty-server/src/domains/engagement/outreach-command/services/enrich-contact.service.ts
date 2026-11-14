import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ContactEnrichmentWaterfallService } from 'src/domains/discovery/providers/contact-enrichment/services/contact-enrichment-waterfall.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { extractLinkedinProfileId } from 'src/domains/engagement/outreach-command/utils/extract-linkedin-profile-id.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateRecord = ObjectLiteral & {
  id: string;
  enrichStatus?: string | null;
  peopleId?: string | null;
};

type PersonRecord = ObjectLiteral & {
  id: string;
  emails?: { primaryEmail?: string | null; additionalEmails?: string[] | null };
  phones?: { primaryPhoneNumber?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
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
    private readonly featureFlagService: FeatureFlagService,
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

          personId = candidate.peopleId ?? null;

          const person = isNonEmptyString(personId)
            ? await (
                await this.globalWorkspaceOrmManager.getRepository<PersonRecord>(
                  workspaceId,
                  'person',
                  { shouldBypassPermissionChecks: true },
                )
              ).findOne({ where: { id: personId } })
            : null;

          // Contact details already on the person (e.g. from LinkedIn
          // contact_info) win over a paid provider lookup.
          const storedContact = readStoredContact(person, {
            wantEmail: input.wantEmail !== false,
            wantPhone: input.wantPhone !== false,
          });

          if (isDefined(storedContact)) {
            await this.stampCandidate(
              candidateRepository,
              candidateId,
              'FOUND',
            );

            return storedContact;
          }

          if (!isNonEmptyString(linkedinUrl)) {
            linkedinUrl = person?.linkedinLink?.primaryLinkUrl?.trim() ?? '';
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

        const isOutreachMockEnabled =
          await this.featureFlagService.isFeatureEnabled(
            FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
            workspaceId,
          );

        if (isOutreachMockEnabled) {
          const slug =
            extractLinkedinProfileId(linkedinUrl) || linkedinUrl.toLowerCase();
          const shouldFail = slug.includes('enrich-fail');

          if (shouldFail) {
            this.logger.log(
              `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock enrich miss for ${slug}`,
            );
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
              source: 'mock',
              enrichStatus: 'FAILED',
              error: 'No email found',
            };
          }

          const email = `${slug.replace(/[^a-z0-9-]/gi, '')}@bc-matrix.test`;

          this.logger.log(
            `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock enrich hit ${email}`,
          );
          await this.stampCandidate(candidateRepository, candidateId, 'FOUND');

          if (isNonEmptyString(personId)) {
            const personRepository =
              await this.globalWorkspaceOrmManager.getRepository<PersonRecord>(
                workspaceId,
                'person',
                { shouldBypassPermissionChecks: true },
              );

            await personRepository.update(personId, {
              emails: {
                primaryEmail: email,
                additionalEmails: [],
              },
            });
          }

          return {
            success: true,
            email,
            emails: [email],
            phones: [],
            source: 'mock',
            enrichStatus: 'FOUND',
            error: '',
          };
        }

        try {
          const result =
            await this.contactEnrichmentWaterfallService.fetchContacts(
              linkedinUrl,
              {
                // Match REST / CMI defaults: both on unless explicitly false.
                wantEmail: input.wantEmail !== false,
                wantPhone: input.wantPhone !== false,
              },
            );

          const wantEmail = input.wantEmail !== false;
          const wantPhone = input.wantPhone !== false;
          const emails = result.emails.filter(isNonEmptyString);
          const phones = result.phones.filter(isNonEmptyString);
          const email = emails[0] ?? '';
          const foundEmail = emails.length > 0;
          const foundPhone = phones.length > 0;
          const found = (wantEmail && foundEmail) || (wantPhone && foundPhone);
          const enrichStatus = found ? 'FOUND' : 'FAILED';

          await this.stampCandidate(
            candidateRepository,
            candidateId,
            enrichStatus,
            found ? undefined : 'FAILED_ENRICH',
          );

          if (foundEmail && isNonEmptyString(personId)) {
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
            error: found
              ? ''
              : wantEmail && !wantPhone
                ? 'No email found'
                : wantPhone && !wantEmail
                  ? 'No phone found'
                  : 'No email or phone found',
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

const readStoredContact = (
  person: PersonRecord | null,
  { wantEmail, wantPhone }: { wantEmail: boolean; wantPhone: boolean },
) => {
  const primaryEmail = person?.emails?.primaryEmail?.trim() ?? '';
  const primaryPhone = person?.phones?.primaryPhoneNumber?.trim() ?? '';
  const hasEmail = isNonEmptyString(primaryEmail);
  const hasPhone = isNonEmptyString(primaryPhone);

  // Only skip the providers when every requested channel is already stored.
  if ((!wantEmail && !wantPhone) || (wantEmail && !hasEmail)) {
    return null;
  }

  if (wantPhone && !hasPhone) {
    return null;
  }

  const emails = hasEmail
    ? [
        primaryEmail,
        ...(person?.emails?.additionalEmails ?? []).filter(isNonEmptyString),
      ]
    : [];

  return {
    success: true,
    email: hasEmail ? primaryEmail : '',
    emails,
    phones: hasPhone ? [primaryPhone] : [],
    source: 'person',
    enrichStatus: 'FOUND',
    error: '',
  };
};
