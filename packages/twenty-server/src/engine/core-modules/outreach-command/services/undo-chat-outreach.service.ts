import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { collectOutreachMutationsFromChatParts } from 'src/engine/core-modules/outreach-command/utils/collect-outreach-mutations-from-chat-parts.util';
import { OutreachTableViewService } from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { type AgentMessageEntity } from 'src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';

export type UndoChatOutreachResult = {
  threadId: string;
  columnsRemoved: Array<{
    projectId: string;
    subject: string;
    columnKeys: string[];
    rowsTouched: number;
    ephemeralUpdated: number;
    crmUpdated: number;
  }>;
  viewsCleared: Array<{ projectId: string; tab: string }>;
  message: string;
};

@Injectable()
export class UndoChatOutreachService {
  constructor(
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly outreachTableViewService: OutreachTableViewService,
  ) {}

  async undoFromMessages({
    workspaceId,
    threadId,
    messages,
  }: {
    workspaceId: string;
    threadId: string;
    messages: AgentMessageEntity[];
  }): Promise<UndoChatOutreachResult> {
    const parts = messages.flatMap((message) => message.parts ?? []);
    const mutations = collectOutreachMutationsFromChatParts(parts);

    const columnsRemoved: UndoChatOutreachResult['columnsRemoved'] = [];

    for (const removal of mutations.columnRemovals) {
      const written = await this.outreachWorkingSetService.removeAiColumns({
        workspaceId,
        projectId: removal.projectId,
        subject: removal.subject,
        columnKeys: removal.columnKeys,
      });

      columnsRemoved.push({
        projectId: removal.projectId,
        subject: removal.subject,
        columnKeys: written.columnKeys,
        rowsTouched: written.rowsTouched,
        ephemeralUpdated: written.ephemeralUpdated,
        crmUpdated: written.crmUpdated,
      });
    }

    const viewsCleared: UndoChatOutreachResult['viewsCleared'] = [];

    for (const clear of mutations.viewClears) {
      await this.outreachTableViewService.apply({
        workspaceId,
        projectId: clear.projectId,
        tab: clear.tab,
        filters: [],
        sort: null,
        summary: undefined,
      });
      viewsCleared.push({ projectId: clear.projectId, tab: clear.tab });
    }

    return {
      threadId,
      columnsRemoved,
      viewsCleared,
      message: this.describe(columnsRemoved, viewsCleared),
    };
  }

  private describe(
    columnsRemoved: UndoChatOutreachResult['columnsRemoved'],
    viewsCleared: UndoChatOutreachResult['viewsCleared'],
  ): string {
    const columnKeys = columnsRemoved.flatMap(
      (removal) => removal.columnKeys,
    );
    const uniqueKeys = [...new Set(columnKeys)];
    const rowsTouched = columnsRemoved.reduce(
      (sum, removal) => sum + removal.rowsTouched,
      0,
    );

    if (uniqueKeys.length === 0 && viewsCleared.length === 0) {
      return 'Nothing to undo: this chat did not run AI columns or apply a table view.';
    }

    const parts: string[] = [];

    if (uniqueKeys.length > 0) {
      parts.push(
        `Removed AI column(s) ${uniqueKeys.join(', ')} from ${rowsTouched} row(s)`,
      );
    }

    if (viewsCleared.length > 0) {
      parts.push(
        `Cleared table view(s) on ${viewsCleared
          .map((view) => `${view.tab}@${view.projectId}`)
          .join(', ')}`,
      );
    }

    return isDefined(parts[0]) ? parts.join('. ') + '.' : 'Done.';
  }
}
