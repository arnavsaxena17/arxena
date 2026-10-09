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
  'upsert_outreach_target_companies',
  'upsert_outreach_target_people',
  'save_outreach_targets_to_crm',
  'start_outreach',
  'get_outreach_working_set',
  'preview_sample_message_column',
  'preview_ai_column',
  'run_ai_column',
  'get_ai_column_run_status',
  'cancel_ai_column_run',
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
  upsert_outreach_target_companies: {
    label: i18nLabel(msg`Upsert GTM Target Companies`),
  },
  upsert_outreach_target_people: {
    label: i18nLabel(msg`Upsert GTM Target People`),
  },
  save_outreach_targets_to_crm: {
    label: i18nLabel(msg`Save Outreach Targets to CRM`),
  },
  start_outreach: {
    label: i18nLabel(msg`Start Outreach`),
  },
  get_outreach_working_set: {
    label: i18nLabel(msg`Get Outreach Working Set`),
  },
  preview_sample_message_column: {
    label: i18nLabel(msg`Preview Sample Message Column`),
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
  generate_table_view: {
    label: i18nLabel(msg`Generate Table Filter and Sort`),
  },
  apply_table_view: {
    label: i18nLabel(msg`Apply Table Filter and Sort`),
  },
};
