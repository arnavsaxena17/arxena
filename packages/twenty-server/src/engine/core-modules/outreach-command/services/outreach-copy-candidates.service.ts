import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateRow = ObjectLiteral & {
  id: string;
  name?: string | null;
  peopleId?: string | null;
  projectId?: string | null;
  outreachSequenceStage?: string | null;
};

type PersonRow = ObjectLiteral & {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  doNotContact?: boolean | null;
};

type ProjectRow = ObjectLiteral & {
  id: string;
  recruiterId?: string | null;
};

export type OutreachCopyCandidatesResult = {
  copied: number;
  candidateIds: string[];
  skippedAlreadyInProject: number;
  skippedDoNotContact: number;
  skippedEngaged: number;
  skippedMissingPerson: number;
};

// A person who already replied, negotiated, booked or was explicitly stopped
// must not be re-touched from a second seat: that is the one outcome the client
// would notice. Everything cold (sent / ignored / waiting) is copyable.
const ENGAGED_STAGES = new Set([
  'REPLIED',
  'NEGOTIATING',
  'MEETING_BOOKED',
  'STOPPED',
]);

// Copying people copies their Person-identity only: a fresh Candidate row in the
// target project, back at QUEUED with no analytics. Outreach starts only when an
// operator clicks Start, so enrolment here must never flip the outreach flags.
const COPY_SEQUENCE_STAGE = 'QUEUED';

@Injectable()
export class OutreachCopyCandidatesService {
  private readonly logger = new Logger(OutreachCopyCandidatesService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    sourceProjectId,
    targetProjectId,
    candidateIds,
    personIds,
  }: {
    workspaceId: string;
    sourceProjectId: string;
    targetProjectId: string;
    candidateIds?: string[];
    personIds?: string[];
  }): Promise<OutreachCopyCandidatesResult> {
    const source = sourceProjectId?.trim() ?? '';
    const target = targetProjectId?.trim() ?? '';

    if (!isNonEmptyString(source) || !isNonEmptyString(target)) {
      throw new Error('sourceProjectId and targetProjectId are required');
    }

    if (source === target) {
      throw new Error('Select a different project to copy people from');
    }

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repo = <TRow extends ObjectLiteral>(objectName: string) =>
          this.globalWorkspaceOrmManager.getRepository<TRow>(
            workspaceId,
            objectName,
            { shouldBypassPermissionChecks: true },
          );
        const candidateRepository = await repo<CandidateRow>('candidate');
        const personRepository = await repo<PersonRow>('person');
        const projectRepository = await repo<ProjectRow>('project');

        const sourceCandidates = await this.loadSourceCandidates({
          candidateRepository,
          sourceProjectId: source,
          candidateIds,
        });
        const orderedPersonIds = collectPersonIds(sourceCandidates, personIds);

        const emptyResult: OutreachCopyCandidatesResult = {
          copied: 0,
          candidateIds: [],
          skippedAlreadyInProject: 0,
          skippedDoNotContact: 0,
          skippedEngaged: 0,
          skippedMissingPerson: 0,
        };

        if (orderedPersonIds.length === 0) {
          return emptyResult;
        }

        const [persons, peopleCandidates, targetCandidates, targetProject] =
          await Promise.all([
            personRepository.find({
              where: { id: In(orderedPersonIds) },
            }),
            candidateRepository.find({
              where: { peopleId: In(orderedPersonIds) },
            }),
            candidateRepository.find({
              where: { projectId: target, peopleId: In(orderedPersonIds) },
            }),
            projectRepository.findOne({ where: { id: target } }),
          ]);

        const personById = new Map(
          persons.map((person) => [person.id, person]),
        );
        const alreadyInTarget = new Set(
          targetCandidates
            .map((candidate) => candidate.peopleId)
            .filter(isNonEmptyString),
        );
        const engagedPersonIds = new Set(
          peopleCandidates
            .filter((candidate) =>
              ENGAGED_STAGES.has(candidate.outreachSequenceStage ?? ''),
            )
            .map((candidate) => candidate.peopleId)
            .filter(isNonEmptyString),
        );
        const sourceNameByPersonId = new Map<string, string>();

        for (const candidate of sourceCandidates) {
          if (
            isNonEmptyString(candidate.peopleId) &&
            isNonEmptyString(candidate.name) &&
            !sourceNameByPersonId.has(candidate.peopleId)
          ) {
            sourceNameByPersonId.set(candidate.peopleId, candidate.name.trim());
          }
        }

        // The target project's recruiter is the seat that will send, so pinning
        // it at copy time keeps the round deterministic even before the
        // sequencer's sender selector runs.
        const senderMemberId = targetProject?.recruiterId?.trim() ?? '';
        const result = { ...emptyResult };

        for (const personId of orderedPersonIds) {
          const person = personById.get(personId);

          if (!isDefined(person)) {
            result.skippedMissingPerson += 1;
            continue;
          }

          if (person.doNotContact === true) {
            result.skippedDoNotContact += 1;
            continue;
          }

          if (alreadyInTarget.has(personId)) {
            result.skippedAlreadyInProject += 1;
            continue;
          }

          if (engagedPersonIds.has(personId)) {
            result.skippedEngaged += 1;
            continue;
          }

          const name =
            sourceNameByPersonId.get(personId) ?? buildPersonName(person);

          const candidate = await candidateRepository.save({
            name,
            peopleId: personId,
            projectId: target,
            outreachSequenceStage: COPY_SEQUENCE_STAGE,
            ...(isNonEmptyString(senderMemberId)
              ? { outreachWorkspaceMemberId: senderMemberId }
              : {}),
          });

          // Guards against copying the same person twice in one call when the
          // source rows and the explicit personIds overlap.
          alreadyInTarget.add(personId);
          result.copied += 1;
          result.candidateIds.push(candidate.id);
        }

        this.logger.log(
          `Copied ${result.copied} ${result.copied === 1 ? 'person' : 'people'} from project ${source} to ${target} (skipped ${result.skippedAlreadyInProject} already copied, ${result.skippedEngaged} engaged, ${result.skippedDoNotContact} do-not-contact)`,
        );

        return result;
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  private async loadSourceCandidates({
    candidateRepository,
    sourceProjectId,
    candidateIds,
  }: {
    candidateRepository: {
      find: (options: {
        where: Record<string, unknown>;
      }) => Promise<CandidateRow[]>;
    };
    sourceProjectId: string;
    candidateIds?: string[];
  }): Promise<CandidateRow[]> {
    const explicitCandidateIds = (candidateIds ?? []).filter(isNonEmptyString);

    if (explicitCandidateIds.length === 0) {
      return candidateRepository.find({
        where: { projectId: sourceProjectId },
      });
    }

    const found = await candidateRepository.find({
      where: { id: In(explicitCandidateIds) },
    });

    // Only rows that really belong to the source project are copyable.
    return found.filter((candidate) => candidate.projectId === sourceProjectId);
  }
}

const collectPersonIds = (
  candidates: CandidateRow[],
  personIds?: string[],
): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const personId of [
    ...candidates.map((candidate) => candidate.peopleId),
    ...(personIds ?? []),
  ]) {
    if (!isNonEmptyString(personId) || seen.has(personId)) {
      continue;
    }

    seen.add(personId);
    ordered.push(personId);
  }

  return ordered;
};

const buildPersonName = (person: PersonRow): string =>
  [person.name?.firstName, person.name?.lastName]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
