export type McpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
};

export type McpToolMetadata = {
  title: string;
  annotations: McpToolAnnotations;
};

const WRITE_PREFIXES = [
  'create_',
  'update_',
  'append_',
  'send_',
  'move_',
  'delete_',
  'post_',
  'upload_',
  'add_',
  'share_',
  'process_',
  'refresh_',
];

const DESTRUCTIVE_PATTERNS = [
  'send_',
  'delete_',
  'disconnect_',
  'move_candidate',
  'send_shortlist',
  'send_bulk',
  'send_chat',
  'linkedin_unipile_send_',
  'whatsapp_unipile_',
  'post_candidates',
  'upload_profiles',
  'create_reminder',
  'create_interview',
  'create_client',
  'create_shortlist',
  'create_candidate',
  'create_company',
  'create_job',
  'append_agent_note',
  'update_contact',
  'enrich_contact',
  'linkedin_unipile_connect_',
  'linkedin_unipile_disconnect_',
  'whatsapp_unipile_disconnect_',
];

const OPEN_WORLD_PATTERNS = [
  'send_',
  'linkedin_unipile_send_',
  'whatsapp_',
  'send_chat',
  'send_bulk',
  'send_shortlist',
  'share_jd',
  'linkedin_unipile_send_invitation',
];

const toTitleCase = (name: string): string =>
  name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const isWriteTool = (name: string): boolean => {
  if (name === 'search' || name === 'fetch') {
    return false;
  }

  return (
    WRITE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    name.includes('_send_') ||
    name.includes('_disconnect_')
  );
};

const isDestructiveTool = (name: string): boolean =>
  DESTRUCTIVE_PATTERNS.some((pattern) => name.includes(pattern));

const isOpenWorldTool = (name: string): boolean =>
  OPEN_WORLD_PATTERNS.some((pattern) => name.includes(pattern));

/** OpenAI company-knowledge tools are read-only by definition. */
const READ_ONLY_OVERRIDES = new Set([
  'search',
  'fetch',
  'get_org_chart',
  'search_org_charts_by_country',
  'search_org_charts_by_function',
  'list_active_jobs',
  'get_job_by_id',
  'find_job_by_name',
  'list_candidates_for_job',
  'find_candidate',
  'get_candidate_details',
  'list_companies',
  'get_company_by_id',
  'find_company_by_name',
  'find_person',
  'get_pending_recruiter_actions',
  'read_agent_notes',
  'list_due_reminders',
  'list_shortlists',
  'list_cv_sents',
  'list_client_contacts',
  'list_interview_schedules',
  'list_client_interviews',
]);

export const getToolMetadata = (name: string): McpToolMetadata => {
  const title = toTitleCase(name);

  if (
    READ_ONLY_OVERRIDES.has(name) ||
    name.startsWith('list_') ||
    name.startsWith('get_') ||
    name.startsWith('find_') ||
    (name.startsWith('search_') && name !== 'search')
  ) {
    if (!isWriteTool(name) || READ_ONLY_OVERRIDES.has(name)) {
      return {
        title,
        annotations: { readOnlyHint: true },
      };
    }
  }

  if (name === 'search' || name === 'fetch') {
    return {
      title: name === 'search' ? 'Search knowledge' : 'Fetch document',
      annotations: { readOnlyHint: true },
    };
  }

  const readOnly =
    !WRITE_PREFIXES.some((prefix) => name.startsWith(prefix)) &&
    !name.includes('_send_') &&
    !name.includes('_disconnect_') &&
    (name.startsWith('check_') ||
      name.startsWith('parse_') ||
      name.startsWith('generate_') ||
      name.startsWith('validate_') ||
      name.startsWith('expand_') ||
      name.startsWith('job_brief_') ||
      name.endsWith('_health') ||
      name.endsWith('_status'));

  if (readOnly) {
    return {
      title,
      annotations: { readOnlyHint: true },
    };
  }

  const destructive = isDestructiveTool(name);
  const openWorld = isOpenWorldTool(name);

  return {
    title,
    annotations: {
      readOnlyHint: false,
      destructiveHint: destructive,
      openWorldHint: openWorld,
    },
  };
};
