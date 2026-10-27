import { OUTPUT_NAVIGATION_TOOL_NAMES } from 'src/engine/core-modules/tool/tools/output-navigation-tool/constants/output-navigation-tool-names.constant';

// Chat/MCP always-on ACTION tools that do not belong on workflow agents.
export const WORKFLOW_AGENT_EXCLUDED_TOOL_NAMES = [
  ...OUTPUT_NAVIGATION_TOOL_NAMES,
  'search_help_center',
  'navigate_app',
  'highlight_org_chart',
  'inspect_outreach_spreadsheet',
  'import_outreach_spreadsheet',
  'save_outreach_targets_to_crm',
  'start_outreach',
  // Chat discovery tool — LinkedIn opener agents were calling this mid-draft
  // (Mock Co / employer lookups) and stalling AI-column sample-message chunks.
  'find_role_at_companies',
  'fetch_profiles',
  'get_sourcing_ledger',
  'get_outreach_tab',
  'preview_sample_message_column',
  'preview_ai_column',
  'run_ai_column',
  'get_ai_column_run_status',
  'cancel_ai_column_run',
  'generate_table_view',
  'apply_table_view',
] as const;
