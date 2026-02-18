import {
  HIRING_NAUKRI_CRAWL_INPUT_DESCRIPTOR,
  HIRING_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR,
  LINKEDIN_FETCH_COOKIES_INPUT_DESCRIPTOR,
  LINKEDIN_GET_UNREAD_MESSAGES_INPUT_DESCRIPTOR,
  LINKEDIN_SEND_CONNECTION_REQUEST_INPUT_DESCRIPTOR,
  LINKEDIN_SEND_MESSAGE_INPUT_DESCRIPTOR,
  NAUKRI_UPDATE_CONTACT_INPUT_DESCRIPTOR,
  NAUKRI_UPLOAD_PROFILES_INPUT_DESCRIPTOR,
  RESDEX_CRAWL_INPUT_DESCRIPTOR,
  RESDEX_DOWNLOAD_CV_INPUT_DESCRIPTOR,
  RESDEX_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR,
  RESDEX_OPEN_TABS_INPUT_DESCRIPTOR,
  RMS_NAUKRI_CRAWL_INPUT_DESCRIPTOR,
  RMS_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR,
  WHATSAPP_SEND_ATTACHMENT_INPUT_DESCRIPTOR,
  WHATSAPP_SEND_MESSAGE_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

const TIMEOUT_MS = 30_000;


export const extensionBridgeTools: McpTool[] = [
  // Resdex tools
  {
    definition: {
      name: 'resdex_download_cv',
      description:
        'Download CV from a Resdex candidate profile. Requires candidate URL and contact information.',
      inputSchema: descriptorToInputSchema(RESDEX_DOWNLOAD_CV_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'resdex-download-cv',
        args,
      );
    },
  },
  {
    definition: {
      name: 'resdex_open_tabs',
      description:
        'Open multiple Resdex candidate URLs in browser tabs. Useful for batch operations.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(RESDEX_OPEN_TABS_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of Resdex candidate profile URLs to open',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'resdex-open-tabs',
        args,
      );
    },
  },
  {
    definition: {
      name: 'resdex_fetch_and_send_profiles',
      description:
        'Fetch candidate data from Resdex search/folder page and send to backend. Requires the user to be on a Resdex search or folder page.',
      inputSchema: descriptorToInputSchema(RESDEX_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'resdex-fetch-and-send-profiles',
        args,
      );
    },
  },
  {
    definition: {
      name: 'resdex_crawl',
      description:
        'Crawl Resdex search/folder pages to extract candidate data. Requires the user to be on a Resdex search or folder page.',
      inputSchema: descriptorToInputSchema(RESDEX_CRAWL_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'resdex-crawl',
        args,
      );
    },
  },
  // Hiring Naukri tools
  {
    definition: {
      name: 'hiring_naukri_crawl',
      description:
        'Crawl Hiring Naukri applies/applies pages to extract candidate data. Requires the user to be on a Hiring Naukri applies page.',
      inputSchema: descriptorToInputSchema(HIRING_NAUKRI_CRAWL_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'hiring-naukri-crawl',
        args,
      );
    },
  },
  {
    definition: {
      name: 'hiring_naukri_fetch_and_send_profiles',
      description:
        'Fetch candidate data from Hiring Naukri pages and send to backend. Requires the user to be on a Hiring Naukri applies page.',
      inputSchema: descriptorToInputSchema(HIRING_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'hiring-naukri-fetch-and-send-profiles',
        args,
      );
    },
  },
  // RMS Naukri tools
  {
    definition: {
      name: 'rms_naukri_crawl',
      description:
        'Crawl RMS Naukri profile/project pages to extract candidate data. Requires the user to be on an RMS Naukri profile/project page.',
      inputSchema: descriptorToInputSchema(RMS_NAUKRI_CRAWL_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'rms-naukri-crawl',
        args,
      );
    },
  },
  {
    definition: {
      name: 'rms_naukri_fetch_and_send_profiles',
      description:
        'Fetch candidate data from RMS Naukri and send to backend. Requires the user to be on an RMS Naukri page.',
      inputSchema: descriptorToInputSchema(RMS_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'rms-naukri-fetch-and-send-profiles',
        args,
      );
    },
  },
  // Naukri Common tools
  {
    definition: {
      name: 'naukri_update_contact',
      description:
        'Fetch phone/email from current Naukri page and update contact in Arxena. Requires the user to be on a Naukri candidate profile page.',
      inputSchema: descriptorToInputSchema(NAUKRI_UPDATE_CONTACT_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'naukri-update-contact',
        args,
      );
    },
  },
  {
    definition: {
      name: 'naukri_upload_profiles',
      description:
        'Upload scraped Naukri profiles to backend. This processes profiles that were previously scraped.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(NAUKRI_UPLOAD_PROFILES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            profiles: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of profile objects to upload',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'naukri-upload-profiles',
        args,
      );
    },
  },
  // LinkedIn tools
  {
    definition: {
      name: 'linkedin_send_message',
      description:
        'Send a LinkedIn chat message to a contact. Requires the LinkedIn profile URL and message content.',
      inputSchema: descriptorToInputSchema(LINKEDIN_SEND_MESSAGE_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'linkedin-send-message',
        args,
      );
    },
  },
  {
    definition: {
      name: 'linkedin_send_connection_request',
      description:
        'Send a LinkedIn connection request to a contact. Requires the LinkedIn profile URL and optional message.',
      inputSchema: descriptorToInputSchema(LINKEDIN_SEND_CONNECTION_REQUEST_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'linkedin-send-connection-request',
        args,
      );
    },
  },
  {
    definition: {
      name: 'linkedin_get_unread_messages',
      description:
        'Fetch unread LinkedIn messages. Opens LinkedIn messaging page if not already open.',
      inputSchema: descriptorToInputSchema(LINKEDIN_GET_UNREAD_MESSAGES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'linkedin-get-unread-messages',
        args,
      );
    },
  },
  {
    definition: {
      name: 'linkedin_fetch_cookies',
      description:
        'Fetch and save LinkedIn cookies (specifically li_at cookie) from the browser. This is useful for authentication purposes.',
      inputSchema: descriptorToInputSchema(LINKEDIN_FETCH_COOKIES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'linkedin-fetch-cookies',
        args,
      );
    },
  },
  // WhatsApp tools
  {
    definition: {
      name: 'whatsapp_send_message',
      description:
        'Send a WhatsApp message to a phone number. Requires phone number and message content.',
      inputSchema: descriptorToInputSchema(WHATSAPP_SEND_MESSAGE_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'whatsapp-send-message',
        args,
      );
    },
  },
  {
    definition: {
      name: 'whatsapp_send_attachment',
      description:
        'Send a WhatsApp attachment (image, document, video, audio) to a phone number.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(WHATSAPP_SEND_ATTACHMENT_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['image', 'document', 'video', 'audio'],
                    description: 'Type of attachment',
                  },
                  data: {
                    type: 'string',
                    description: 'Base64 encoded attachment data',
                  },
                  filename: {
                    type: 'string',
                    description: 'Filename for the attachment',
                  },
                },
              },
              description: 'Array of attachment objects',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'extension-bridge',
        'whatsapp-send-attachment',
        args,
      );
    },
  },
];
