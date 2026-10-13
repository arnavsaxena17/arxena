
import { ARXENA_TOOL_CATALOG } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { allTools } from 'src/engine/core-modules/arxena-tools/library/tools/index';

// Library tools that are deliberately not offered to the model through the
// catalog: top-level MCP tools, the query-generation pipeline's internal
// steps, and Unipile account administration used by the UI and the extension.
// A new library tool must be added to the catalog or to this list.
const UNLISTED_LIBRARY_TOOLS = new Set([
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

describe('Arxena tool catalog and library', () => {
  const libraryToolNames = new Set<string>(
    allTools.map((tool) => tool.definition.name),
  );
  const catalogToolNames = new Set(ARXENA_TOOL_CATALOG.map((entry) => entry.name));
  it('should have a library handler for every catalog tool', () => {
    expect(
      [...catalogToolNames].filter((name) => !libraryToolNames.has(name)),
    ).toEqual([]);
  });

  it('should list every other library tool as deliberately unlisted', () => {
    expect(
      [...libraryToolNames]
        .filter(
          (name) =>
            !catalogToolNames.has(name) && !UNLISTED_LIBRARY_TOOLS.has(name),
        )
        .sort(),
    ).toEqual([]);
  });

  it('should not keep an unlisted entry for a tool that no longer exists', () => {
    expect(
      [...UNLISTED_LIBRARY_TOOLS].filter((name) => !libraryToolNames.has(name)),
    ).toEqual([]);
  });
});
