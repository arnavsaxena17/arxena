import {
    callRestAPI,
    callRestAPIDelete,
    callRestAPIGet,
} from '../api/rest-client';
import { ArxenaConfig } from '../config';
import { McpTool } from '../types/tool-types';
import {
    LINKEDIN_UNIPILE_CHECKPOINT_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_CONNECT_COOKIE_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_CONNECT_CREDENTIALS_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_EXTENSION_SYNC_COOKIES_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_GET_PROFILE_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_GET_PROFILE_OVERVIEW_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_GET_USER_POSTS_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_HOSTED_AUTH_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_ORG_CHART_ENSURE_ACCOUNT_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_PERSIST_COOKIES_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_RECONNECT_FROM_STORED_PROFILE_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_SEND_INVITATION_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_SEND_MESSAGE_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_UPDATE_MEMBER_ACCOUNT_INPUT_DESCRIPTOR,
    LINKEDIN_UNIPILE_VALIDATE_SESSION_INPUT_DESCRIPTOR,
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
  postUnipileToolWithPathParam(
    'linkedin_unipile_get_own_profile',
    'Fetch the connected member own LinkedIn profile via Unipile.',
    'linkedin-unipile',
    (accountId) => `profile/me/${accountId}`,
    'accountId',
    UNIPILE_ACCOUNT_ID_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_profile',
    'Retrieve one LinkedIn profile by identifier (/in/slug). For searching many profiles use search_linkedin_people or search_linkedin_from_url (linkedin-search / Unipile search API).',
    'linkedin-unipile',
    'profile',
    LINKEDIN_UNIPILE_GET_PROFILE_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_user_posts',
    'Retrieve recent LinkedIn posts for a user by their provider_id. Returns paginated list of posts with text, engagement metrics, and social_id for further actions.',
    'linkedin-unipile',
    'profile/posts',
    LINKEDIN_UNIPILE_GET_USER_POSTS_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_get_profile_overview',
    'Fetch a LinkedIn person\'s full profile, recent posts, and activity in a single call. Profile and posts are fetched in parallel. NOTE: Unipile has no standalone activity endpoint — activity is sourced from posts (always) and the recruiting_activity profile section (LinkedIn Recruiter accounts only, opt-in via include_recruiting_activity=true).',
    'linkedin-unipile',
    'profile/overview',
    LINKEDIN_UNIPILE_GET_PROFILE_OVERVIEW_INPUT_DESCRIPTOR,
  ),
  postUnipileTool(
    'linkedin_unipile_send_message',
    'Send a LinkedIn message via Unipile (DM or InMail depending on options).',
    'linkedin-unipile',
    'message/send',
    LINKEDIN_UNIPILE_SEND_MESSAGE_INPUT_DESCRIPTOR,
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
  {
    definition: {
      name: 'whatsapp_unipile_check_account_status',
      description: 'Poll WhatsApp Unipile account connection status by account ID.',
      inputSchema: descriptorToInputSchema([
        {
          key: 'accountId',
          type: 'string',
          description: 'WhatsApp Unipile account ID',
          required: true,
        },
      ]),
    },
    handler: async (args, config) => {
      const accountId = String(args.accountId ?? '').trim();
      if (!accountId) {
        throw new Error('accountId is required');
      }
      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'whatsapp-unipile',
        `accounts/${accountId}/status`,
      );
    },
  },
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
