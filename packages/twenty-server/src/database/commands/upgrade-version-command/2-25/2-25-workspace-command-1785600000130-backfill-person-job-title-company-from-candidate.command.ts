import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { readPersonTitleCompanyFromCandidate } from 'src/database/commands/upgrade-version-command/2-25/utils/read-person-title-company-from-candidate.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateTitleCompanyRow = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  otherFields?: Record<string, unknown> | null;
};

type PersonTitleCompanyRow = ObjectLiteral & {
  id: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
};

const isEmptyText = (value: unknown): boolean =>
  !isNonEmptyString(typeof value === 'string' ? value : '');

// Prior 0122 backfill only copied candidate.jobTitle / jobCompanyName columns.
// Titles often lived only in otherFields (job_title, linkedin_headline, …).
@RegisteredWorkspaceCommand('2.25.0', 1785600000130)
@Command({
  name: 'upgrade:2-25:backfill-person-job-title-company-from-candidate',
  description:
    'Backfill Person jobTitle and jobCompanyName from Candidate columns/otherFields (never overwrite non-empty Person values)',
})
export class BackfillPersonJobTitleCompanyFromCandidateCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Backfilling Person jobTitle/jobCompanyName from Candidate for workspace ${workspaceId}`,
    );

    let updatedPeople = 0;
    let wouldUpdatePeople = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateTitleCompanyRow>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonTitleCompanyRow>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const candidates = await candidateRepository.find({ take: 50_000 });
      const patchesByPersonId = new Map<
        string,
        { jobTitle?: string; jobCompanyName?: string }
      >();

      for (const candidate of candidates) {
        const peopleId = candidate.peopleId?.trim();

        if (!isNonEmptyString(peopleId)) {
          continue;
        }

        const incoming = readPersonTitleCompanyFromCandidate(candidate);

        if (
          !isDefined(incoming.jobTitle) &&
          !isDefined(incoming.jobCompanyName)
        ) {
          continue;
        }

        const existingPatch = patchesByPersonId.get(peopleId) ?? {};

        patchesByPersonId.set(peopleId, {
          ...existingPatch,
          ...incoming,
        });
      }

      for (const [personId, incoming] of patchesByPersonId) {
        const person = await personRepository.findOne({
          where: { id: personId },
        });

        if (!isDefined(person)) {
          continue;
        }

        const patch: { jobTitle?: string; jobCompanyName?: string } = {};

        if (
          isEmptyText(person.jobTitle) &&
          isNonEmptyString(incoming.jobTitle)
        ) {
          patch.jobTitle = incoming.jobTitle;
        }

        if (
          isEmptyText(person.jobCompanyName) &&
          isNonEmptyString(incoming.jobCompanyName)
        ) {
          patch.jobCompanyName = incoming.jobCompanyName;
        }

        if (Object.keys(patch).length === 0) {
          continue;
        }

        if (isDryRun) {
          wouldUpdatePeople += 1;
          continue;
        }

        await personRepository.update(personId, patch);
        updatedPeople += 1;
      }
    }, buildSystemAuthContext(workspaceId));

    this.logger.log(
      isDryRun
        ? `[DRY RUN] Would backfill jobTitle/jobCompanyName for ${wouldUpdatePeople} people in workspace ${workspaceId}`
        : `Backfilled jobTitle/jobCompanyName for ${updatedPeople} people in workspace ${workspaceId}`,
    );
  }
}
