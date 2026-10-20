import { OUTPUT_NAVIGATION_TOOL_NAMES } from 'src/engine/core-modules/tool/tools/output-navigation-tool/constants/output-navigation-tool-names.constant';

// Chat/Ask AI tools that need the in-app UI, file mounts, or open-world HTTP.
export const MCP_EXCLUDED_TOOL_NAMES = new Set([
  'code_interpreter',
  'http_request',
  'navigate_app',
  'highlight_org_chart',
  ...OUTPUT_NAVIGATION_TOOL_NAMES,
]);
