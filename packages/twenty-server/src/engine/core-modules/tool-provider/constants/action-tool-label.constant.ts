import { msg } from '@lingui/core/macro';

import { type ActionToolLabel } from 'src/engine/core-modules/tool-provider/types/action-tool-label.type';
import { i18nLabel } from 'src/engine/workspace-manager/twenty-standard-application/utils/i18n-label.util';

export const ACTION_TOOL_IDS = [
  'http_request',
  'send_email',
  'draft_email',
  'create_calendar_event',
  'search_help_center',
  'code_interpreter',
  'send_files',
  'navigate_app',
  'highlight_org_chart',
  'inspect_outreach_spreadsheet',
  'import_outreach_spreadsheet',
  'save_outreach_targets_to_crm',
  'start_outreach',
  'get_outreach_tab',
  'find_people_by_company',
  'fetch_profiles',
  'get_sourcing_ledger',
  'get_source_capabilities',
  'get_scoring_plan',
  'preview_sample_message_column',
  'preview_ai_column',
  'run_ai_column',
  'get_ai_column_run_status',
  'cancel_ai_column_run',
  'remove_ai_column',
  'generate_table_view',
  'apply_table_view',
] as const;

export type ActionToolId = (typeof ACTION_TOOL_IDS)[number];

export const ACTION_TOOL_LABELS: Record<ActionToolId, ActionToolLabel> = {
  http_request: {
    label: i18nLabel(msg`HTTP Request`),
  },
  send_email: {
    label: i18nLabel(msg`Send Email`),
  },
  draft_email: {
    label: i18nLabel(msg`Draft Email`),
  },
  create_calendar_event: {
    label: i18nLabel(msg`Create Calendar Event`),
  },
  search_help_center: {
    label: i18nLabel(msg`Search Help Center`),
  },
  code_interpreter: {
    label: i18nLabel(msg`Code Interpreter`),
  },
  send_files: {
    label: i18nLabel(msg`Send Files`),
  },
  navigate_app: {
    label: i18nLabel(msg`Navigate App`),
  },
  highlight_org_chart: {
    label: i18nLabel(msg`Highlight Org Chart`),
  },
  inspect_outreach_spreadsheet: {
    label: i18nLabel(msg`Inspect Outreach Spreadsheet`),
  },
  import_outreach_spreadsheet: {
    label: i18nLabel(msg`Import Outreach Spreadsheet`),
  },
  save_outreach_targets_to_crm: {
    label: i18nLabel(msg`Save Outreach Targets to CRM`),
  },
  start_outreach: {
    label: i18nLabel(msg`Start Outreach`),
  },
  find_people_by_company: {
    label: i18nLabel(msg`Find People By Company`),
  },
  get_outreach_tab: {
    label: i18nLabel(msg`Get Outreach Tab`),
  },
  preview_sample_message_column: {
    label: i18nLabel(msg`Preview Sample Message Column`),
  },
  get_sourcing_ledger: {
    label: i18nLabel(msg`Get Sourcing Ledger`),
  },
  get_source_capabilities: {
    label: i18nLabel(msg`Get Source Capabilities`),
  },
  get_scoring_plan: {
    label: i18nLabel(msg`Get Scoring Plan`),
  },
  fetch_profiles: {
    label: i18nLabel(msg`Fetch Profiles`),
  },
  preview_ai_column: {
    label: i18nLabel(msg`Preview AI Column`),
  },
  run_ai_column: {
    label: i18nLabel(msg`Run AI Column`),
  },
  get_ai_column_run_status: {
    label: i18nLabel(msg`Get AI Column Run Status`),
  },
  cancel_ai_column_run: {
    label: i18nLabel(msg`Cancel AI Column Run`),
  },
  remove_ai_column: {
    label: i18nLabel(msg`Remove AI Column`),
  },
  generate_table_view: {
    label: i18nLabel(msg`Generate Table Filter and Sort`),
  },
  apply_table_view: {
    label: i18nLabel(msg`Apply Table Filter and Sort`),
  },
};
