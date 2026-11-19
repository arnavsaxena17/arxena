import { isNonEmptyString } from '@sniptt/guards';

import { SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';
import { OUTREACH_TAB_SOURCE_TOOLS } from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-normalizers.util';

// Tools whose projectId means "write the results to this project's tab". Other
// tools take projectId as a filter, so they never get a default.
const TAB_WRITING_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...OUTREACH_TAB_SOURCE_TOOLS,
  SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
]);

// The model often drops projectId, and sometimes mis-copies the UUID; the
// browsing context knows the project the user is on, so a Find still lands on
// its tab and a mutated id never reaches the tool
export const applyDefaultProjectId = (
  toolName: string,
  args: Record<string, unknown>,
  projectId: string | undefined,
): Record<string, unknown> =>
  TAB_WRITING_TOOL_NAMES.has(toolName) &&
  isNonEmptyString(projectId) &&
  args.projectId !== projectId
    ? { ...args, projectId }
    : args;
