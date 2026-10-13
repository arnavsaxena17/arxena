import { callRestAPI, callRestAPIDelete } from '../api/rest-client';
import { ArxenaConfig } from '../config';
import { McpTool } from '../types/tool-types';
import {
  LINKEDIN_UNIPILE_CHECKPOINT_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_CONNECT_COOKIE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_CONNECT_CREDENTIALS_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_EXTENSION_SYNC_COOKIES_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_GET_OWN_PROFILE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_GET_PROFILE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_GET_PROFILE_OVERVIEW_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_GET_USER_POSTS_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_GET_USER_COMMENTS_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_HOSTED_AUTH_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_LIST_ATTENDEE_CHATS_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_LIST_CHAT_MESSAGES_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_LIST_CHATS_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_ORG_CHART_ENSURE_ACCOUNT_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_PERSIST_COOKIES_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_RECONNECT_FROM_STORED_PROFILE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_SEND_INVITATION_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_SEND_MESSAGE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_SEND_VOICE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_UPDATE_MEMBER_ACCOUNT_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_VALIDATE_SESSION_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_VISIT_PROFILE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_FOLLOW_PROFILE_INPUT_DESCRIPTOR,
  LINKEDIN_UNIPILE_POST_REACTION_INPUT_DESCRIPTOR,
  UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  WHATSAPP_UNIPILE_UPDATE_MEMBER_ACCOUNT_INPUT_DESCRIPTOR,
  type McpInputFieldDescriptor,
} from '../utils/McpToolSchemas';
import { descriptorToInputSchema } from '../utils/input-schema';

type UnipilePathPrefix = 'linkedin-unipile' | 'whatsapp-unipile';

const stripKeys = (
  args: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> => {
  const body = { ...args };
  for (const key of keys) {
    delete body[key];
  }
  return body;
};

const resolveUnipileAccountId = (args: Record<string, unknown>): string => {
  const accountId = String(args.accountId ?? args.account_id ?? '').trim();

  return accountId;
};

const postUnipileTool = (
  name: string,
  description: string,
  pathPrefix: UnipilePathPrefix,
  endpoint: string,
  descriptor: readonly McpInputFieldDescriptor[] = [],
  stripBodyKeys: string[] = [],
): McpTool => ({
  definition: {
    name,
    description,
    inputSchema: descriptorToInputSchema(descriptor),
  },
  handler: async (args, config) => {
    const body = stripKeys(args, stripBodyKeys);
    return callRestAPI(
      config.baseUrl,
      config.apiToken,
      pathPrefix,
      endpoint,
      body,
    );
  },
});

const postUnipileToolWithPathParam = (
  name: string,
  description: string,
  pathPrefix: UnipilePathPrefix,
  endpointTemplate: (pathParam: string) => string,
  pathParamKey: string,
  descriptor: readonly McpInputFieldDescriptor[],
): McpTool => ({
  definition: {
    name,
    description,
    inputSchema: descriptorToInputSchema(descriptor),
  },
  handler: async (args, config) => {
    const pathParam = String(args[pathParamKey] ?? '').trim();
    if (!pathParam) {
      throw new Error(`${pathParamKey} is required`);
    }
    const body = stripKeys(args, [pathParamKey]);
    return callRestAPI(
      config.baseUrl,
      config.apiToken,
      pathPrefix,
      endpointTemplate(pathParam),
      body,
    );
  },
});

const deleteUnipileTool = (
  name: string,
  description: string,
  pathPrefix: UnipilePathPrefix,
  endpointTemplate: (pathParam: string) => string,
  pathParamKey: string,
  descriptor: readonly McpInputFieldDescriptor[],
): McpTool => ({
  definition: {
    name,
    description,
    inputSchema: descriptorToInputSchema(descriptor),
  },
  handler: async (args, config: ArxenaConfig) => {
    const pathParam = String(args[pathParamKey] ?? '').trim();
    if (!pathParam) {
      throw new Error(`${pathParamKey} is required`);
    }
    return callRestAPIDelete(
      config.baseUrl,
      config.apiToken,
      pathPrefix,
      endpointTemplate(pathParam),
    );
  },
});

export const unipileControllersTools: McpTool[] = [
  // LinkedIn Unipile — connection & accounts
  postUnipileTool(
    'linkedin_unipile_connect_credentials',
    'Connect a LinkedIn account to Unipile using username and password.',
    'linkedin-unipile',
    'connect/credentials',
    LINKEDIN_UNIPILE_CONNECT_CREDENTIALS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_connect_cookie',
    'Connect a LinkedIn account to Unipile using li_at cookie and user-agent.',
    'linkedin-unipile',
    'connect/cookie',
    LINKEDIN_UNIPILE_CONNECT_COOKIE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_extension_sync_cookies',
    'Sync LinkedIn cookies from the Chrome extension into Unipile and workspace member profile.',
    'linkedin-unipile',
    'extension/sync-cookies',
    LINKEDIN_UNIPILE_EXTENSION_SYNC_COOKIES_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_extension_persist_cookies',
    'Persist LinkedIn cookies from the Chrome extension onto the workspace member profile without creating a persistent Unipile session.',
    'linkedin-unipile',
    'extension/persist-cookies',
    LINKEDIN_UNIPILE_PERSIST_COOKIES_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_reconnect_from_stored_profile',
    'Reconnect LinkedIn via Unipile using cookies stored on the workspace member profile.',
    'linkedin-unipile',
    'reconnect-from-stored-profile',
    LINKEDIN_UNIPILE_RECONNECT_FROM_STORED_PROFILE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_validate_session',
    'Validate stored LinkedIn cookies by connecting once via Unipile and disconnecting again unless keepLinkedinConnected is set.',
    'linkedin-unipile',
    'extension/validate-session',
    LINKEDIN_UNIPILE_VALIDATE_SESSION_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_update_member_account',
    'Bind a LinkedIn Unipile account ID to the current workspace member profile.',
    'linkedin-unipile',
    'accounts/update-member',
    LINKEDIN_UNIPILE_UPDATE_MEMBER_ACCOUNT_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_org_chart_ensure_account',
    'Ensure a LinkedIn Unipile account exists for org-chart search (pool or hosted auth redirect).',
    'linkedin-unipile',
    'org-chart/ensure-account',
    LINKEDIN_UNIPILE_ORG_CHART_ENSURE_ACCOUNT_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_hosted_auth',
    'Create a Unipile hosted authentication link for LinkedIn connect/reconnect.',
    'linkedin-unipile',
    'hosted-auth',
    LINKEDIN_UNIPILE_HOSTED_AUTH_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_checkpoint',
    'Submit a LinkedIn 2FA/OTP checkpoint code for a pending Unipile account.',
    'linkedin-unipile',
    'checkpoint',
    LINKEDIN_UNIPILE_CHECKPOINT_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_list_accounts',
    'List all LinkedIn accounts connected via Unipile for this workspace.',
    'linkedin-unipile',
    'accounts',
  ),
  postUnipileToolWithPathParam(
    'linkedin_unipile_get_account',
    'Get details for a LinkedIn Unipile account by ID.',
    'linkedin-unipile',
    (accountId) => `accounts/${accountId}`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  postUnipileToolWithPathParam(
    'linkedin_unipile_resync_account',
    'Resync a LinkedIn Unipile account with Unipile.',
    'linkedin-unipile',
    (accountId) => `accounts/${accountId}/resync`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  deleteUnipileTool(
    'linkedin_unipile_disconnect_account',
    'Disconnect and remove a LinkedIn Unipile account.',
    'linkedin-unipile',
    (accountId) => `accounts/${accountId}`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  {
    definition: {
      name: 'linkedin_unipile_get_own_profile',
      description:
        'Retrieve the connected LinkedIn account owner profile via Unipile (GET /api/v1/users/me). Returns name, headline, public identifier/URL, premium, Sales Navigator and Recruiter capability. Pass accountId (or account_id) from Connected Accounts.',
      inputSchema: descriptorToInputSchema(
        LINKEDIN_UNIPILE_GET_OWN_PROFILE_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const accountId = resolveUnipileAccountId(args);
      if (!accountId) {
        throw new Error('accountId (or account_id) is required');
      }
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-unipile',
        `profile/me/${accountId}`,
        stripKeys(args, ['accountId', 'account_id']),
      );
    },
  },
  postUnipileTool(
    'linkedin_unipile_get_profile',
    'Retrieve one LinkedIn profile by identifier (/in/slug) or provider_id. Pass linkedin_api=sales_navigator (or recruiter) to fetch product-specific provider_id. For Sales Navigator chats: (1) classic fetch by slug, (2) SN refetch with classic provider_id + linkedin_api=sales_navigator, (3) linkedin_unipile_list_attendee_chats with SN provider_id. For searching many profiles use search_linkedin_people.',
    'linkedin-unipile',
    'profile',
    LINKEDIN_UNIPILE_GET_PROFILE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_list_chats',
    'List LinkedIn chats for a connected Unipile account (GET /api/v1/chats). Returns chat folders including INBOX_LINKEDIN_SALES_NAVIGATOR. Prefer linkedin_unipile_list_attendee_chats when looking up chats with a specific person.',
    'linkedin-unipile',
    'chats/list',
    LINKEDIN_UNIPILE_LIST_CHATS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_list_attendee_chats',
    'List 1:1 LinkedIn chats with a given attendee (GET /api/v1/chat_attendees/{id}/chats). For Sales Navigator inbox, pass the sales_navigator provider_id from linkedin_unipile_get_profile with linkedin_api=sales_navigator.',
    'linkedin-unipile',
    'chats/by-attendee',
    LINKEDIN_UNIPILE_LIST_ATTENDEE_CHATS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_list_chat_messages',
    'List messages in a LinkedIn Unipile chat (GET /api/v1/chats/{chat_id}/messages). Pass chat_id from list chats tools. Paginate with cursor until exhausted.',
    'linkedin-unipile',
    'chats/messages',
    LINKEDIN_UNIPILE_LIST_CHAT_MESSAGES_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_user_posts',
    'Retrieve recent LinkedIn posts for a user by their provider_id. Returns paginated list of posts with text, engagement metrics, and social_id for further actions.',
    'linkedin-unipile',
    'profile/posts',
    LINKEDIN_UNIPILE_GET_USER_POSTS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_user_comments',
    'Retrieve LinkedIn comments made by a user to posts (Unipile List User Comments). Use identifier `me` for the connected account owner. Returns paginated comments with parent post preview.',
    'linkedin-unipile',
    'profile/comments',
    LINKEDIN_UNIPILE_GET_USER_COMMENTS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_profile_overview',
    "Fetch a LinkedIn person's full profile, recent posts, and activity in a single call. Profile and posts are fetched in parallel. NOTE: Unipile has no standalone activity endpoint — activity is sourced from posts (always) and the recruiting_activity profile section (LinkedIn Recruiter accounts only, opt-in via include_recruiting_activity=true).",
    'linkedin-unipile',
    'profile/overview',
    LINKEDIN_UNIPILE_GET_PROFILE_OVERVIEW_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_send_message',
    'Send a LinkedIn message via Unipile (DM or InMail depending on options). Also accepts optional voice_message; prefer linkedin_unipile_send_voice_note for voice-only.',
    'linkedin-unipile',
    'message/send',
    LINKEDIN_UNIPILE_SEND_MESSAGE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_send_voice_note',
    'Send a LinkedIn voice note via Unipile (requires voice_message; prefer .m4a). Same as workflow step SEND_LINKEDIN_VOICE_NOTE.',
    'linkedin-unipile',
    'message/send-voice',
    LINKEDIN_UNIPILE_SEND_VOICE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_visit_profile',
    'Visit a LinkedIn profile with notify=true (empty sections). Same as workflow step VIEW_LINKEDIN_PROFILE / visit_linkedin_profile.',
    'linkedin-unipile',
    'profile/visit',
    LINKEDIN_UNIPILE_VISIT_PROFILE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_follow_profile',
    'Follow a LinkedIn profile via Unipile magic route. Pass provider_id (ACo…) or identifier to resolve. Same as workflow step FOLLOW_LINKEDIN_PROFILE.',
    'linkedin-unipile',
    'profile/follow',
    LINKEDIN_UNIPILE_FOLLOW_PROFILE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_like_post',
    'React to a LinkedIn post (default like). Pass post_id = social_id from posts. Same as workflow step LIKE_LINKEDIN_POST.',
    'linkedin-unipile',
    'posts/reaction',
    LINKEDIN_UNIPILE_POST_REACTION_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_send_invitation',
    'Send a LinkedIn connection request via Unipile.',
    'linkedin-unipile',
    'message/invite',
    LINKEDIN_UNIPILE_SEND_INVITATION_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_health',
    'Check LinkedIn Unipile controller health and configuration.',
    'linkedin-unipile',
    'health',
  ),

  // WhatsApp Unipile
  postUnipileTool(
    'whatsapp_unipile_update_member_account',
    'Bind a WhatsApp Unipile account ID to the current workspace member profile.',
    'whatsapp-unipile',
    'accounts/update-member',
    WHATSAPP_UNIPILE_UPDATE_MEMBER_ACCOUNT_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'whatsapp_unipile_request_qr_code',
    'Request a WhatsApp QR code for Unipile connection.',
    'whatsapp-unipile',
    'qr-code',
  ),
  // {
  //   definition: {
  //     name: 'whatsapp_unipile_check_account_status',
  //     description: 'Poll WhatsApp Unipile account connection status by account ID.',
  //     inputSchema: descriptorToInputSchema([
  //       {
  //         key: 'accountId',
  //         type: 'string',
  //         description: 'WhatsApp Unipile account ID',
  //         required: true,
  //       },
  //     ]),
  //   },
  //   handler: async (args, config) => {
  //     const accountId = String(args.accountId ?? '').trim();
  //     if (!accountId) {
  //       throw new Error('accountId is required');
  //     }
  //     return callRestAPIGet(
  //       config.baseUrl,
  //       config.apiToken,
  //       'whatsapp-unipile',
  //       `accounts/${accountId}/status`,
  //     );
  //   },
  // },
  postUnipileTool(
    'whatsapp_unipile_list_accounts',
    'List all WhatsApp accounts connected via Unipile for this workspace.',
    'whatsapp-unipile',
    'accounts',
  ),
  postUnipileToolWithPathParam(
    'whatsapp_unipile_get_account',
    'Get details for a WhatsApp Unipile account by ID.',
    'whatsapp-unipile',
    (accountId) => `accounts/${accountId}`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  postUnipileToolWithPathParam(
    'whatsapp_unipile_resync_account',
    'Resync a WhatsApp Unipile account with Unipile.',
    'whatsapp-unipile',
    (accountId) => `accounts/${accountId}/resync`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  deleteUnipileTool(
    'whatsapp_unipile_disconnect_account',
    'Disconnect and remove a WhatsApp Unipile account.',
    'whatsapp-unipile',
    (accountId) => `accounts/${accountId}`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'whatsapp_unipile_health',
    'Check WhatsApp Unipile controller health and configuration.',
    'whatsapp-unipile',
    'health',
  ),
];
