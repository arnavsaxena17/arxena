import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import {
  buildCandidateFlagsPatchUpdate,
  type CandidateWithFlags,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

// One-shot repair after automated-trigger resync:
//   yarn command:prod outreach:kick-connection-accepted --workspace-id <id> --candidate-ids <id,id>
@Command({
  name: 'outreach:kick-connection-accepted',
  description:
    'Flip startOutreach false→true on CONNECTION_ACCEPTED candidates to re-fire Candidate Sequencer',
})
export class KickConnectionAcceptedCommand extends CommandRunner {
  private readonly logger = new Logger(KickConnectionAcceptedCommand.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super();
  }

  @Option({
    flags: '-w, --workspace-id <workspaceId>',
    description: 'Workspace id',
    required: true,
  })
  parseWorkspaceId(value: string): string {
    return value;
  }

  @Option({
    flags: '-c, --candidate-ids <candidateIds>',
    description: 'Comma-separated candidate ids',
    required: true,
  })
  parseCandidateIds(value: string): string {
    return value;
  }

  override async run(
    _passedParams: string[],
    options: { workspaceId?: string; candidateIds?: string },
  ): Promise<void> {
    const workspaceId = options.workspaceId;
    const candidateIds = (options.candidateIds ?? '')
      .split(',')
      .map((candidateId) => candidateId.trim())
      .filter(isNonEmptyString);

    if (!isNonEmptyString(workspaceId) || candidateIds.length === 0) {
      throw new Error('workspace-id and candidate-ids are required');
    }

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<
          ObjectLiteral & {
            id: string;
            outreachSequenceStage?: string | null;
            candidateFlags?: unknown;
          }
        >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

      for (const candidateId of candidateIds) {
        const candidate = await candidateRepository.findOne({
          where: { id: candidateId },
        });

        if (!isDefined(candidate)) {
          this.logger.warn(`Candidate ${candidateId} not found; skipping`);
          continue;
        }

        if (candidate.outreachSequenceStage !== 'CONNECTION_ACCEPTED') {
          this.logger.warn(
            `Candidate ${candidateId} stage=${String(candidate.outreachSequenceStage)}; skipping`,
          );
          continue;
        }

        const candidateWithFlags = {
          candidateFlags: candidate.candidateFlags,
        } as CandidateWithFlags;

        await candidateRepository.update(
          candidateId,
          buildCandidateFlagsPatchUpdate(candidateWithFlags, {
            startOutreach: false,
          }) as never,
        );

        await candidateRepository.update(
          candidateId,
          buildCandidateFlagsPatchUpdate(candidateWithFlags, {
            startOutreach: true,
            stopOutreach: false,
          }) as never,
        );

        this.logger.log(
          `Kicked CONNECTION_ACCEPTED sequencer re-entry for ${candidateId}`,
        );
      }
    }, authContext);
  }
}
