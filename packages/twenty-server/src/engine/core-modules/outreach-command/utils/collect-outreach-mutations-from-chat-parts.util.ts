import { isNonEmptyString, isObject } from '@sniptt/guards';

import { resolveToolName } from 'src/engine/core-modules/tool-provider/utils/resolve-tool-name.util';
import { type OutreachWorkingSetSubject } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { type OutreachTableTab } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';

const EXECUTE_TOOL_TOOL_NAME = 'execute_tool';

export type ChatToolPartLike = {
  toolName?: string | null;
  toolInput?: unknown;
  toolOutput?: unknown;
  state?: string | null;
};

export type OutreachChatColumnRemoval = {
  projectId: string;
  subject: OutreachWorkingSetSubject;
  columnKeys: string[];
};

export type OutreachChatViewClear = {
  projectId: string;
  tab: OutreachTableTab;
};

export type OutreachChatMutations = {
  columnRemovals: OutreachChatColumnRemoval[];
  viewClears: OutreachChatViewClear[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && !Array.isArray(value);

const readSubject = (value: unknown): OutreachWorkingSetSubject =>
  value === 'company' ? 'company' : 'person';

const readTab = (value: unknown): OutreachTableTab =>
  value === 'companies' ? 'companies' : 'people';

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && isNonEmptyString(entry),
  );
};

const resolveInnerInput = (
  toolName: string,
  toolInput: unknown,
): Record<string, unknown> => {
  if (!isRecord(toolInput)) {
    return {};
  }

  if (toolName !== EXECUTE_TOOL_TOOL_NAME) {
    return toolInput;
  }

  const nested = toolInput.arguments;

  return isRecord(nested) ? nested : {};
};

const resolveInnerOutput = (toolOutput: unknown): Record<string, unknown> => {
  if (!isRecord(toolOutput)) {
    return {};
  }

  // execute_tool returns the inner ToolOutput as-is
  return toolOutput;
};

const isSuccessfulOutput = (output: Record<string, unknown>): boolean =>
  output.success !== false;

const columnKeysFromOutput = (output: Record<string, unknown>): string[] => {
  const result = output.result;

  if (!isRecord(result)) {
    return [];
  }

  return readStringArray(result.columnKeys);
};

const columnRemovalKey = (removal: OutreachChatColumnRemoval): string =>
  `${removal.projectId}:${removal.subject}:${[...removal.columnKeys].sort().join(',')}`;

const viewClearKey = (clear: OutreachChatViewClear): string =>
  `${clear.projectId}:${clear.tab}`;

// Walks Ask AI message tool parts and lists outreach side effects that Phase-1
// undo can reverse (AI columns from run_ai_column, table views from apply).
export const collectOutreachMutationsFromChatParts = (
  parts: ChatToolPartLike[],
): OutreachChatMutations => {
  const columnRemovalsByKey = new Map<string, OutreachChatColumnRemoval>();
  const viewClearsByKey = new Map<string, OutreachChatViewClear>();

  for (const part of parts) {
    if (!isNonEmptyString(part.toolName)) {
      continue;
    }

    const resolvedName = resolveToolName({
      toolName: part.toolName,
      input: part.toolInput,
    });
    const input = resolveInnerInput(part.toolName, part.toolInput);
    const output = resolveInnerOutput(part.toolOutput);

    if (!isSuccessfulOutput(output)) {
      continue;
    }

    if (resolvedName === 'run_ai_column') {
      const projectId =
        typeof input.projectId === 'string' ? input.projectId : '';
      const columnKeys = columnKeysFromOutput(output);

      if (!isNonEmptyString(projectId) || columnKeys.length === 0) {
        continue;
      }

      const removal: OutreachChatColumnRemoval = {
        projectId,
        subject: readSubject(input.subject),
        columnKeys: [...new Set(columnKeys)],
      };

      columnRemovalsByKey.set(columnRemovalKey(removal), removal);
      continue;
    }

    if (resolvedName === 'apply_table_view') {
      if (input.clear === true) {
        continue;
      }

      const projectId =
        typeof input.projectId === 'string' ? input.projectId : '';

      if (!isNonEmptyString(projectId)) {
        continue;
      }

      const clear: OutreachChatViewClear = {
        projectId,
        tab: readTab(input.tab),
      };

      viewClearsByKey.set(viewClearKey(clear), clear);
    }
  }

  return {
    columnRemovals: [...columnRemovalsByKey.values()],
    viewClears: [...viewClearsByKey.values()],
  };
};
