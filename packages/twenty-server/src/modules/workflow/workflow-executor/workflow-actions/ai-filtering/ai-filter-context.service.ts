import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { parseIcpSpec } from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const ENRICHMENT_TEXT_KEYS = [
  'whatTheySell',
  'offer',
  'description',
  'summary',
] as const;

// Runtime facts appended to a filter's criteria: who is selling, what the
// workspace ICP says. Read when the job runs, so a changed ICP applies to the
// next run without editing the workflow. Empty when the workspace has none.
export const buildFilterContextText = (
  workspace: Pick<
    WorkspaceEntity,
    'displayName' | 'icpSpec' | 'enrichmentJson'
  > | null,
): string => {
  if (workspace === null) {
    return '';
  }

  const lines: string[] = [];

  if (workspace.displayName) {
    lines.push(`Sender company: ${workspace.displayName}`);
  }

  const enrichment = workspace.enrichmentJson;

  for (const key of ENRICHMENT_TEXT_KEYS) {
    const value = enrichment?.[key];

    if (typeof value === 'string' && value.trim() !== '') {
      lines.push(`What the sender sells: ${value.trim().slice(0, 400)}`);
      break;
    }
  }

  const icp = parseIcpSpec(workspace.icpSpec);

  if (icp.targetTitles.length > 0) {
    lines.push(`Target titles: ${icp.targetTitles.join(', ')}`);
  }

  if (icp.locations.length > 0) {
    lines.push(`Target locations: ${icp.locations.join(', ')}`);
  }

  return lines.join('\n');
};

@Injectable()
export class AiFilterContextService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  async resolveForWorkspace(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'displayName', 'icpSpec', 'enrichmentJson'],
    });

    return buildFilterContextText(workspace);
  }
}
