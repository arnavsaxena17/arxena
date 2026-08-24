import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { isJsonColumnEmpty } from 'src/engine/core-modules/candidate-sourcing/utils/migrate-other-fields.utils';
import { DEFAULT_PROJECT_PROMPTS } from 'src/engine/core-modules/workspace-modifications/object-apis/data/prompts';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type LegacyPromptRow = {
  name: string | null;
  prompt: string | null;
  projectId: string | null;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000055)
@Command({
  name: 'upgrade:2-25:fold-prompts-into-project',
  description:
    'Migrate prompt object rows into project.prompts JSON, then drop the prompt object from existing workspaces',
})
export class FoldPromptsIntoProjectCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Folding prompts into project.prompts for workspace ${workspaceId}`,
    );

    const { workspaceLevel, promptsByProject, promptRows } =
      await this.readLegacyPrompts(schema, workspaceId);

    this.logger.log(
      `Workspace ${workspaceId}: found ${promptRows} prompt row(s) across ${promptsByProject.size} project(s)`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const promptsColumnExists =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        '_project',
        'prompts',
        { silent: true },
      );

    if (!promptsColumnExists) {
      this.logger.warn(
        `Skipped writing project.prompts for workspace ${workspaceId}: column missing after sync`,
      );

      return;
    }

    const projects = (await this.workspaceQueryService.executeWorkspaceRawQuery(
      `
        SELECT id, prompts
        FROM ${schema}."_project"
        WHERE "deletedAt" IS NULL
      `,
      [],
      workspaceId,
    )) as { id: string; prompts: unknown }[];

    let updatedCount = 0;

    for (const project of projects ?? []) {
      if (!isJsonColumnEmpty(project.prompts)) {
        continue;
      }

      const merged = {
        ...DEFAULT_PROJECT_PROMPTS,
        ...workspaceLevel,
        ...(promptsByProject.get(project.id) ?? {}),
      };

      await this.workspaceQueryService.executeWorkspaceRawQuery(
        `UPDATE ${schema}."_project" SET "prompts" = $2::jsonb WHERE id = $1`,
        [project.id, JSON.stringify(merged)],
        workspaceId,
      );
      updatedCount++;
    }

    this.logger.log(
      `Workspace ${workspaceId}: wrote prompts JSON onto ${updatedCount} project(s)`,
    );
  }

  private async readLegacyPrompts(
    schema: string,
    workspaceId: string,
  ): Promise<{
    workspaceLevel: Record<string, string>;
    promptsByProject: Map<string, Record<string, string>>;
    promptRows: number;
  }> {
    const promptTableExists = await this.workspaceQueryService.checkIfTableExists(
      schema,
      '_prompt',
    );

    if (!promptTableExists) {
      return {
        workspaceLevel: {},
        promptsByProject: new Map(),
        promptRows: 0,
      };
    }

    const projectIdColumn = await this.resolvePromptProjectIdColumn(
      schema,
      workspaceId,
    );

    const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
      `
        SELECT name, prompt, ${projectIdColumn} as "projectId"
        FROM ${schema}."_prompt"
        WHERE "deletedAt" IS NULL
      `,
      [],
      workspaceId,
    )) as LegacyPromptRow[];

    const workspaceLevel: Record<string, string> = {};
    const promptsByProject = new Map<string, Record<string, string>>();

    for (const row of rows ?? []) {
      const name = row.name?.trim();
      const prompt = row.prompt?.trim();

      if (!name || !prompt) {
        continue;
      }

      if (!row.projectId) {
        workspaceLevel[name] = prompt;
        continue;
      }

      const existing = promptsByProject.get(row.projectId) ?? {};

      existing[name] = prompt;
      promptsByProject.set(row.projectId, existing);
    }

    return {
      workspaceLevel,
      promptsByProject,
      promptRows: rows?.length ?? 0,
    };
  }

  private async resolvePromptProjectIdColumn(
    schema: string,
    workspaceId: string,
  ): Promise<string> {
    const columns = (await this.workspaceQueryService.executeWorkspaceRawQuery(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = '_prompt'
          AND column_name = ANY($2::text[])
      `,
      [schema, ['projectId', 'projectsId', 'jobId', 'jobsId']],
      workspaceId,
    )) as { column_name: string }[];

    const names = new Set((columns ?? []).map((column) => column.column_name));

    for (const candidate of ['projectId', 'projectsId', 'jobId', 'jobsId']) {
      if (names.has(candidate)) {
        return `"${candidate}"`;
      }
    }

    return '"projectId"';
  }
}
