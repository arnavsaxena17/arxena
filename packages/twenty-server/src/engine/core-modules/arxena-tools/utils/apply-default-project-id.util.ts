import { isNonEmptyString } from '@sniptt/guards';

import { OUTREACH_LIST_SOURCE_TOOLS } from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';

// Tools whose projectId means "write the results to this project's tab". Other
// tools take projectId as a filter, so they never get a default.
const TAB_WRITING_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...OUTREACH_LIST_SOURCE_TOOLS,
  'search_bright_data_business',
]);

// The model often drops projectId; the browsing context knows the project the
// user is on, so a Find still lands on its tab
export const applyDefaultProjectId = (
  toolName: string,
  args: Record<string, unknown>,
  projectId: string | undefined,
): Record<string, unknown> =>
  TAB_WRITING_TOOL_NAMES.has(toolName) &&
  isNonEmptyString(projectId) &&
  !isNonEmptyString(args.projectId)
    ? { ...args, projectId }
    : args;
