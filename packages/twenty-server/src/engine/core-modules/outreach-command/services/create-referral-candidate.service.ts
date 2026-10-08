import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type CreateReferralCandidateInput = {
  referralName?: string;
  referralEmail?: string;
  referralPhone?: string;
  jobCompanyName?: string;
  projectId?: string;
  referrerName?: string;
  referrerCandidateId?: string;
};

type Row = ObjectLiteral & { id: string };

// EMAIL_SENT is not a sequencer entry stage, so the new record does not start
// its own cold cadence; the referral intro is sent by the reply workflow.
const REFERRAL_SEQUENCE_STAGE = 'EMAIL_SENT';

@Injectable()
export class CreateReferralCandidateService {
  private readonly logger = new Logger(CreateReferralCandidateService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: CreateReferralCandidateInput;
  }): Promise<{
    success: boolean;
    referralCandidateId: string;
    personId: string;
    created: boolean;
    error: string;
  }> {
    const name = input.referralName?.trim() ?? '';
    const email = input.referralEmail?.trim() ?? '';
    const phone = input.referralPhone?.trim() ?? '';
    const projectId = input.projectId?.trim() ?? '';
    const fail = (error: string) => ({
      success: false,
      referralCandidateId: '',
      personId: '',
      created: false,
      error,
    });

    if (
      !isNonEmptyString(name) ||
      (!isNonEmptyString(email) && !isNonEmptyString(phone))
    ) {
      return fail('Referral needs a name and an email or phone');
    }

    if (!isNonEmptyString(projectId)) {
      return fail('projectId is required');
    }

    const [firstName, ...rest] = name.split(/\s+/);

    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repo = (objectName: string) =>
            this.globalWorkspaceOrmManager.getRepository<Row>(
              workspaceId,
              objectName,
              { shouldBypassPermissionChecks: true },
            );
          const personRepo = await repo('person');
          const candidateRepo = await repo('candidate');

          let person: Row | null = isNonEmptyString(email)
            ? await personRepo.findOne({
                where: { emails: { primaryEmail: email } },
              })
            : null;

          if (!person && isNonEmptyString(phone)) {
            person = await personRepo.findOne({
              where: { phones: { primaryPhoneNumber: phone } },
            });
          }

          if (!person) {
            person = await personRepo.save({
              name: { firstName, lastName: rest.join(' ') },
              ...(isNonEmptyString(email)
                ? { emails: { primaryEmail: email } }
                : {}),
              ...(isNonEmptyString(phone)
                ? { phones: { primaryPhoneNumber: phone } }
                : {}),
              ...(isNonEmptyString(input.jobCompanyName?.trim())
                ? { jobCompanyName: input.jobCompanyName?.trim() }
                : {}),
            });
          }

          const existing = await candidateRepo.findOne({
            where: { peopleId: person.id, projectId },
          });

          if (existing) {
            return {
              success: true,
              referralCandidateId: existing.id,
              personId: person.id,
              created: false,
              error: '',
            };
          }

          const candidate = await candidateRepo.save({
            name,
            peopleId: person.id,
            projectId,
            outreachSequenceStage: REFERRAL_SEQUENCE_STAGE,
          });

          if (isNonEmptyString(input.referrerName?.trim())) {
            const note = await (
              await repo('note')
            ).save({
              title: `Referred by ${input.referrerName?.trim()}`,
              bodyV2: {
                markdown: `Referred by ${input.referrerName?.trim()} (candidate ${input.referrerCandidateId?.trim() || 'unknown'}).`,
              },
            });

            await (
              await repo('noteTarget')
            ).save({
              noteId: note.id,
              targetCandidateId: candidate.id,
            });
          }

          return {
            success: true,
            referralCandidateId: candidate.id,
            personId: person.id,
            created: true,
            error: '',
          };
        },
        buildSystemAuthContext(workspaceId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`create-referral-candidate failed: ${message}`);

      return fail(message);
    }
  }
}
