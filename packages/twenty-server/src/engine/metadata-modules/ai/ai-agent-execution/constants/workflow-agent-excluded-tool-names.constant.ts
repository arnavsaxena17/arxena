import { OUTPUT_NAVIGATION_TOOL_NAMES } from 'src/engine/core-modules/tool/tools/output-navigation-tool/constants/output-navigation-tool-names.constant';

// Chat/MCP always-on ACTION tools that do not belong on workflow agents.
export const WORKFLOW_AGENT_EXCLUDED_TOOL_NAMES = [
  ...OUTPUT_NAVIGATION_TOOL_NAMES,
  'search_help_center',
  'navigate_app',
  'highlight_org_chart',
  'upsert_outreach_target_companies',
  'upsert_outreach_target_people',
] as const;
