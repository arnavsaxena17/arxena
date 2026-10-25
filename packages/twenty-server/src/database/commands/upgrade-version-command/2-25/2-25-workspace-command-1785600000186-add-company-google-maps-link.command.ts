import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { isGoogleMapsHostUrl } from 'src/engine/core-modules/company-api/utils/company-identity.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CompanyLinkRow = ObjectLiteral & {
  id: string;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  googleMapsLink?: { primaryLinkUrl?: string | null } | null;
  googleMapsLinkPrimaryLinkUrl?: string | null;
};

const readPrimaryLinkUrl = (
  link: { primaryLinkUrl?: string | null } | null | undefined,
  flat?: string | null,
): string => {
  const fromObject = link?.primaryLinkUrl?.trim() ?? '';

  if (isNonEmptyString(fromObject)) {
    return fromObject;
  }

  return flat?.trim() ?? '';
};

const toPrimaryLink = (url: string) => {
  let href = url.trim();

  try {
    const parsed = new URL(href.includes('://') ? href : `https://${href}`);
    href = parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname);
  } catch {
    href = href.split(/[?#]/)[0] ?? href;
  }

  href = href.replace(/\/+$/, '');
  const primaryLinkUrl = href.startsWith('http') ? href : `https://${href}`;

  let primaryLinkLabel = '';

  try {
    primaryLinkLabel = new URL(primaryLinkUrl).hostname.replace(/^www\./, '');
  } catch {
    primaryLinkLabel = primaryLinkUrl;
  }

  return { primaryLinkUrl, primaryLinkLabel };
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000186)
@Command({
  name: 'upgrade:2-25:add-company-google-maps-link',
  description:
    'Add Company.googleMapsLink and move misfiled google.com URLs out of linkedinLink',
})
export class AddCompanyGoogleMapsLinkCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding Company.googleMapsLink for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const authContext = buildSystemAuthContext(workspaceId);
    let moved = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const companyRepository =
        await this.globalWorkspaceOrmManager.getRepository<CompanyLinkRow>(
          workspaceId,
          'company',
          { shouldBypassPermissionChecks: true },
        );

      const columns = new Set(
        (companyRepository.metadata?.columns ?? [])
          .map((column) => column.propertyName)
          .filter((name): name is string => isNonEmptyString(name)),
      );

      if (
        !columns.has('googleMapsLink') &&
        !columns.has('googleMapsLinkPrimaryLinkUrl')
      ) {
        this.logger.warn(
          `Company.googleMapsLink missing after sync for workspace ${workspaceId}; skip backfill`,
        );

        return;
      }

      const companies = await companyRepository.find({ take: 100_000 });

      for (const company of companies) {
        const linkedinUrl = readPrimaryLinkUrl(
          company.linkedinLink,
          company.linkedinLinkPrimaryLinkUrl,
        );

        if (!isGoogleMapsHostUrl(linkedinUrl)) {
          continue;
        }

        const existingMapsUrl = readPrimaryLinkUrl(
          company.googleMapsLink,
          company.googleMapsLinkPrimaryLinkUrl,
        );
        const patch: Record<string, unknown> = {
          linkedinLink: null,
        };

        if (!isNonEmptyString(existingMapsUrl)) {
          patch.googleMapsLink = toPrimaryLink(linkedinUrl);
        }

        await companyRepository.update(company.id, patch);
        moved += 1;
      }
    }, authContext);

    this.logger.log(
      `Company.googleMapsLink ready for workspace ${workspaceId}; moved ${moved} misfiled LinkedIn URLs`,
    );
  }
}
