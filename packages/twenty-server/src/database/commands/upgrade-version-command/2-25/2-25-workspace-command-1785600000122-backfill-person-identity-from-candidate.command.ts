import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CandidateIdentityRow = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  locationName?: string | null;
  linkedinProfileId?: string | null;
  uniqueStringKey?: string | null;
  avatarUrl?: string | null;
  outreachPreferredChannel?: string | null;
  hiringNaukriUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  resdexNaukriUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  displayPicture?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  linkedinUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  linkedinProfile?: unknown;
  linkedinPosts?: unknown;
  otherFields?: Record<string, unknown> | null;
};

type PersonIdentityRow = ObjectLiteral & {
  id: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  locationName?: string | null;
  linkedinProfileId?: string | null;
  uniqueStringKey?: string | null;
  avatarUrl?: string | null;
  outreachPreferredChannel?: string | null;
  hiringNaukriUrl?: unknown;
  resdexNaukriUrl?: unknown;
  displayPicture?: unknown;
  linkedinLink?: unknown;
  linkedinProfile?: unknown;
  linkedinPosts?: unknown;
};

const isEmptyText = (value: unknown): boolean =>
  !isNonEmptyString(typeof value === 'string' ? value : '');

const isEmptyLink = (value: unknown): boolean => {
  if (!isDefined(value) || typeof value !== 'object') {
    return true;
  }

  const link = value as { primaryLinkUrl?: string };

  return !isNonEmptyString(link.primaryLinkUrl);
};

const isEmptyJson = (value: unknown): boolean =>
  value === null || value === undefined;

const readOtherFieldsLocation = (
  otherFields: Record<string, unknown> | null | undefined,
): string | null => {
  if (!isDefined(otherFields)) {
    return null;
  }

  for (const key of ['locationName', 'location_name', 'location']) {
    const value = otherFields[key];

    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }

  return null;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000122)
@Command({
  name: 'upgrade:2-25:backfill-person-identity-from-candidate',
  description:
    'Sync Person identity fields from Arxena metadata and backfill from Candidate (never overwrite non-empty Person values)',
})
export class BackfillPersonIdentityFromCandidateCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Backfilling Person identity from Candidate for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    let updatedPeople = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateIdentityRow>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonIdentityRow>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const candidates = await candidateRepository.find({ take: 50_000 });
      const patchesByPersonId = new Map<string, Record<string, unknown>>();

      for (const candidate of candidates) {
        const peopleId = candidate.peopleId?.trim();

        if (!isNonEmptyString(peopleId)) {
          continue;
        }

        const existingPatch = patchesByPersonId.get(peopleId) ?? {};
        const locationFromOtherFields = readOtherFieldsLocation(
          candidate.otherFields,
        );
        const locationName =
          (isNonEmptyString(candidate.locationName)
            ? candidate.locationName.trim()
            : null) ?? locationFromOtherFields;

        const incoming: Record<string, unknown> = {
          ...(isNonEmptyString(candidate.jobTitle)
            ? { jobTitle: candidate.jobTitle.trim() }
            : {}),
          ...(isNonEmptyString(candidate.jobCompanyName)
            ? { jobCompanyName: candidate.jobCompanyName.trim() }
            : {}),
          ...(isNonEmptyString(locationName) ? { locationName } : {}),
          ...(isNonEmptyString(candidate.linkedinProfileId)
            ? { linkedinProfileId: candidate.linkedinProfileId.trim() }
            : {}),
          ...(isNonEmptyString(candidate.uniqueStringKey)
            ? { uniqueStringKey: candidate.uniqueStringKey.trim() }
            : {}),
          ...(isNonEmptyString(candidate.avatarUrl)
            ? { avatarUrl: candidate.avatarUrl.trim() }
            : {}),
          ...(isNonEmptyString(candidate.outreachPreferredChannel)
            ? {
                outreachPreferredChannel:
                  candidate.outreachPreferredChannel.trim(),
              }
            : {}),
          ...(!isEmptyLink(candidate.hiringNaukriUrl)
            ? { hiringNaukriUrl: candidate.hiringNaukriUrl }
            : {}),
          ...(!isEmptyLink(candidate.resdexNaukriUrl)
            ? { resdexNaukriUrl: candidate.resdexNaukriUrl }
            : {}),
          ...(!isEmptyLink(candidate.displayPicture)
            ? { displayPicture: candidate.displayPicture }
            : {}),
          ...(!isEmptyLink(candidate.linkedinUrl)
            ? { linkedinLink: candidate.linkedinUrl }
            : {}),
          ...(!isEmptyJson(candidate.linkedinProfile)
            ? { linkedinProfile: candidate.linkedinProfile }
            : {}),
          ...(!isEmptyJson(candidate.linkedinPosts)
            ? { linkedinPosts: candidate.linkedinPosts }
            : {}),
        };

        patchesByPersonId.set(peopleId, { ...existingPatch, ...incoming });
      }

      for (const [personId, incoming] of patchesByPersonId) {
        const person = await personRepository.findOne({
          where: { id: personId },
        });

        if (!isDefined(person)) {
          continue;
        }

        const patch: Record<string, unknown> = {};

        if (isEmptyText(person.jobTitle) && isNonEmptyString(incoming.jobTitle)) {
          patch.jobTitle = incoming.jobTitle;
        }

        if (
          isEmptyText(person.jobCompanyName) &&
          isNonEmptyString(incoming.jobCompanyName)
        ) {
          patch.jobCompanyName = incoming.jobCompanyName;
        }

        if (
          isEmptyText(person.locationName) &&
          isNonEmptyString(incoming.locationName)
        ) {
          patch.locationName = incoming.locationName;
        }

        if (
          isEmptyText(person.linkedinProfileId) &&
          isNonEmptyString(incoming.linkedinProfileId)
        ) {
          patch.linkedinProfileId = incoming.linkedinProfileId;
        }

        if (
          isEmptyText(person.uniqueStringKey) &&
          isNonEmptyString(incoming.uniqueStringKey)
        ) {
          patch.uniqueStringKey = incoming.uniqueStringKey;
        }

        if (
          isEmptyText(person.avatarUrl) &&
          isNonEmptyString(incoming.avatarUrl)
        ) {
          patch.avatarUrl = incoming.avatarUrl;
        }

        if (
          isEmptyText(person.outreachPreferredChannel) &&
          isNonEmptyString(incoming.outreachPreferredChannel)
        ) {
          patch.outreachPreferredChannel = incoming.outreachPreferredChannel;
        }

        if (isEmptyLink(person.hiringNaukriUrl) && incoming.hiringNaukriUrl) {
          patch.hiringNaukriUrl = incoming.hiringNaukriUrl;
        }

        if (isEmptyLink(person.resdexNaukriUrl) && incoming.resdexNaukriUrl) {
          patch.resdexNaukriUrl = incoming.resdexNaukriUrl;
        }

        if (isEmptyLink(person.displayPicture) && incoming.displayPicture) {
          patch.displayPicture = incoming.displayPicture;
        }

        if (isEmptyLink(person.linkedinLink) && incoming.linkedinLink) {
          patch.linkedinLink = incoming.linkedinLink;
        }

        if (isEmptyJson(person.linkedinProfile) && incoming.linkedinProfile) {
          patch.linkedinProfile = incoming.linkedinProfile;
        }

        if (isEmptyJson(person.linkedinPosts) && incoming.linkedinPosts) {
          patch.linkedinPosts = incoming.linkedinPosts;
        }

        if (Object.keys(patch).length === 0) {
          continue;
        }

        await personRepository.update(personId, patch);
        updatedPeople += 1;
      }
    }, buildSystemAuthContext(workspaceId));

    this.logger.log(
      `Backfilled Person identity for ${updatedPeople} people in workspace ${workspaceId}`,
    );
  }
}
