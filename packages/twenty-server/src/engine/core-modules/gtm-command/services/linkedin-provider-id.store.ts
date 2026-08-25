import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { escapeForIlike, isDefined } from 'twenty-shared/utils';
import { ILike, type ObjectLiteral } from 'typeorm';

import { isValidLinkedInProviderId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-attendee-id.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateLinkedinRecord = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
  personId?: string | null;
  linkedinProfileId?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string | null } | null;
  linkedinUrlPrimaryLinkUrl?: string | null;
  outreachSequenceStage?: string | null;
};

type PersonLinkedinRecord = ObjectLiteral & {
  id: string;
  linkedinProfileId?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
};

type WorkspaceRepositoryLike<T extends ObjectLiteral> = {
  findOne: (options: { where: Record<string, unknown> }) => Promise<T | null>;
  update: (id: string, values: Record<string, unknown>) => Promise<unknown>;
  metadata?: { columns?: Array<{ propertyName?: string }> };
};

const repositoryHasColumn = (
  repository: WorkspaceRepositoryLike<ObjectLiteral>,
  columnName: string,
): boolean => {
  const columns = repository.metadata?.columns;

  if (!Array.isArray(columns) || columns.length === 0) {
    return true;
  }

  return columns.some((column) => column.propertyName === columnName);
};

const personIdFromCandidate = (
  candidate: CandidateLinkedinRecord | null,
): string => {
  const peopleId = candidate?.peopleId?.trim() ?? '';
  const personId = candidate?.personId?.trim() ?? '';

  return isNonEmptyString(peopleId) ? peopleId : personId;
};

@Injectable()
export class LinkedinProviderIdStoreService {
  private readonly logger = new Logger(LinkedinProviderIdStoreService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async findCandidate({
    workspaceId,
    candidateId,
    identifier,
  }: {
    workspaceId: string;
    candidateId?: string;
    identifier?: string;
  }): Promise<CandidateLinkedinRecord | null> {
    if (!isNonEmptyString(workspaceId)) {
      return null;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository = await this.globalWorkspaceOrmManager
          .getRepository<CandidateLinkedinRecord>(workspaceId, 'candidate', {
            shouldBypassPermissionChecks: true,
          });

        return this.lookupCandidate(candidateRepository, {
          candidateId,
          identifier,
        });
      },
      authContext,
    );
  }

  async readStoredProviderId({
    workspaceId,
    candidateId,
    identifier,
  }: {
    workspaceId?: string;
    candidateId?: string;
    identifier?: string;
  }): Promise<string> {
    if (!isNonEmptyString(workspaceId)) {
      return '';
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository = await this.globalWorkspaceOrmManager
          .getRepository<CandidateLinkedinRecord>(workspaceId, 'candidate', {
            shouldBypassPermissionChecks: true,
          });
        const candidate = await this.lookupCandidate(candidateRepository, {
          candidateId,
          identifier,
        });

        if (isValidLinkedInProviderId(candidate?.linkedinProfileId)) {
          return candidate?.linkedinProfileId?.trim() ?? '';
        }

        const personRepository = await this.tryGetPersonRepository(workspaceId);
        const person = await this.lookupPerson(personRepository, {
          personId: personIdFromCandidate(candidate),
          identifier,
        });

        return isValidLinkedInProviderId(person?.linkedinProfileId)
          ? (person?.linkedinProfileId?.trim() ?? '')
          : '';
      },
      authContext,
    );
  }

  async saveProviderId({
    workspaceId,
    candidateId,
    identifier,
    providerId,
  }: {
    workspaceId?: string;
    candidateId?: string;
    identifier?: string;
    providerId: string;
  }): Promise<void> {
    const trimmedProviderId = providerId.trim();

    if (
      !isNonEmptyString(workspaceId) ||
      !isValidLinkedInProviderId(trimmedProviderId)
    ) {
      return;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository = await this.globalWorkspaceOrmManager
            .getRepository<CandidateLinkedinRecord>(workspaceId, 'candidate', {
              shouldBypassPermissionChecks: true,
            });
          const candidate = await this.lookupCandidate(candidateRepository, {
            candidateId,
            identifier,
          });

          if (
            isDefined(candidate) &&
            candidate.linkedinProfileId !== trimmedProviderId
          ) {
            await candidateRepository.update(candidate.id, {
              linkedinProfileId: trimmedProviderId,
            });
          }

          const personRepository =
            await this.tryGetPersonRepository(workspaceId);

          if (!isDefined(personRepository)) {
            return;
          }

          if (!repositoryHasColumn(personRepository, 'linkedinProfileId')) {
            return;
          }

          const person = await this.lookupPerson(personRepository, {
            personId: personIdFromCandidate(candidate),
            identifier,
          });

          if (
            isDefined(person) &&
            person.linkedinProfileId !== trimmedProviderId
          ) {
            await personRepository.update(person.id, {
              linkedinProfileId: trimmedProviderId,
            });
          }
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist LinkedIn provider id ${trimmedProviderId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async resolveForSend({
    workspaceId,
    candidateId,
    identifier,
    fetchProviderId,
  }: {
    workspaceId?: string;
    candidateId?: string;
    identifier: string;
    fetchProviderId: () => Promise<string>;
  }): Promise<string> {
    const trimmedIdentifier = identifier.trim();

    if (isValidLinkedInProviderId(trimmedIdentifier)) {
      await this.saveProviderId({
        workspaceId,
        candidateId,
        identifier: trimmedIdentifier,
        providerId: trimmedIdentifier,
      });

      return trimmedIdentifier;
    }

    const stored = await this.readStoredProviderId({
      workspaceId,
      candidateId,
      identifier: trimmedIdentifier,
    });

    if (isValidLinkedInProviderId(stored)) {
      return stored;
    }

    const fetched = (await fetchProviderId()).trim();

    if (isValidLinkedInProviderId(fetched)) {
      await this.saveProviderId({
        workspaceId,
        candidateId,
        identifier: trimmedIdentifier,
        providerId: fetched,
      });
    }

    return fetched;
  }

  private async lookupCandidate(
    repository: WorkspaceRepositoryLike<CandidateLinkedinRecord>,
    {
      candidateId,
      identifier,
    }: {
      candidateId?: string;
      identifier?: string;
    },
  ): Promise<CandidateLinkedinRecord | null> {
    if (isNonEmptyString(candidateId)) {
      const byId = await repository.findOne({ where: { id: candidateId } });

      if (isDefined(byId)) {
        return byId;
      }
    }

    const slug = extractLinkedinProfileId(identifier ?? '');

    if (!isNonEmptyString(slug)) {
      return null;
    }

    const byProfileId = await repository.findOne({
      where: { linkedinProfileId: slug },
    });

    if (isDefined(byProfileId)) {
      return byProfileId;
    }

    return this.findByLinkedinUrl(repository, {
      urlColumn: 'linkedinUrlPrimaryLinkUrl',
      slug,
    });
  }

  private async lookupPerson(
    repository: WorkspaceRepositoryLike<PersonLinkedinRecord> | null,
    {
      personId,
      identifier,
    }: {
      personId?: string;
      identifier?: string;
    },
  ): Promise<PersonLinkedinRecord | null> {
    if (!isDefined(repository)) {
      return null;
    }

    if (isNonEmptyString(personId)) {
      const byId = await repository.findOne({ where: { id: personId } });

      if (isDefined(byId)) {
        return byId;
      }
    }

    if (!repositoryHasColumn(repository, 'linkedinProfileId')) {
      return this.findPersonByUrl(repository, identifier);
    }

    const slug = extractLinkedinProfileId(identifier ?? '');

    if (!isNonEmptyString(slug)) {
      return null;
    }

    const byProfileId = await repository.findOne({
      where: { linkedinProfileId: slug },
    });

    if (isDefined(byProfileId)) {
      return byProfileId;
    }

    return this.findPersonByUrl(repository, slug);
  }

  private async findPersonByUrl(
    repository: WorkspaceRepositoryLike<PersonLinkedinRecord>,
    identifier?: string,
  ): Promise<PersonLinkedinRecord | null> {
    const slug = extractLinkedinProfileId(identifier ?? '');

    if (!isNonEmptyString(slug)) {
      return null;
    }

    return this.findByLinkedinUrl(repository, {
      urlColumn: 'linkedinLinkPrimaryLinkUrl',
      slug,
    });
  }

  private async findByLinkedinUrl<T extends ObjectLiteral>(
    repository: WorkspaceRepositoryLike<T>,
    {
      urlColumn,
      slug,
    }: {
      urlColumn: string;
      slug: string;
    },
  ): Promise<T | null> {
    try {
      return await repository.findOne({
        where: {
          [urlColumn]: ILike(`%/in/${escapeForIlike(slug)}%`),
        },
      });
    } catch (error) {
      this.logger.debug(
        `LinkedIn URL lookup on ${urlColumn} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async tryGetPersonRepository(
    workspaceId: string,
  ): Promise<WorkspaceRepositoryLike<PersonLinkedinRecord> | null> {
    try {
      return await this.globalWorkspaceOrmManager.getRepository<PersonLinkedinRecord>(
        workspaceId,
        'person',
        { shouldBypassPermissionChecks: true },
      );
    } catch (error) {
      this.logger.debug(
        `Person repository unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
