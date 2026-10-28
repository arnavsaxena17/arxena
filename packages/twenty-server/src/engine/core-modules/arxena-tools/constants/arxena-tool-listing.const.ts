// Library tools that are deliberately not offered to the model through the
// catalog: top-level MCP tools, the query-generation pipeline's internal
// steps, and Unipile account administration used by the UI and the extension.
// A new library tool must be added to the catalog (by omitting it here) or to
// this list.
export const UNLISTED_LIBRARY_TOOLS = new Set([
  'search',
  'fetch',
  'generate_linkedin_query_agent1',
  'generate_linkedin_query_agent2',
  'generate_linkedin_query_agent3',
  'generate_linkedin_query_agent4',
  'generate_unresolved_search_parameters',
  'resolve_parameters',
  'linkedin_unipile_checkpoint',
  'linkedin_unipile_connect_cookie',
  'linkedin_unipile_connect_credentials',
  'linkedin_unipile_disconnect_account',
  'linkedin_unipile_extension_persist_cookies',
  'linkedin_unipile_extension_sync_cookies',
  'linkedin_unipile_get_account',
  'linkedin_unipile_health',
  'linkedin_unipile_hosted_auth',
  'linkedin_unipile_list_accounts',
  'linkedin_unipile_list_attendee_chats',
  'linkedin_unipile_list_chat_messages',
  'linkedin_unipile_list_chats',
  'linkedin_unipile_org_chart_ensure_account',
  'linkedin_unipile_reconnect_from_stored_profile',
  'linkedin_unipile_resync_account',
  'linkedin_unipile_send_invitation',
  'linkedin_unipile_send_message',
  'linkedin_unipile_update_member_account',
  'linkedin_unipile_validate_session',
  'linkedin_unipile_visit_profile',
  'whatsapp_unipile_disconnect_account',
  'whatsapp_unipile_get_account',
  'whatsapp_unipile_health',
  'whatsapp_unipile_list_accounts',
  'whatsapp_unipile_request_qr_code',
  'whatsapp_unipile_resync_account',
  'whatsapp_unipile_update_member_account',
]);

// Subset of unlisted tools that learn_tools / catalog must also refuse even if
// somehow listed.
export const ARXENA_INTERNAL_TOOL_NAMES = new Set([
  'generate_linkedin_query_agent1',
  'generate_linkedin_query_agent2',
  'generate_linkedin_query_agent3',
  'generate_linkedin_query_agent4',
  'generate_unresolved_search_parameters',
  'resolve_parameters',
]);
