import { McpTool } from '../types/tool-types';

const TIMEOUT_MS = 30_000;

async function callExtensionBridgeEndpoint(
  baseUrl: string,
  apiToken: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/extension-bridge/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Extension bridge request failed: ${response.status} ${text}`,
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const extensionBridgeTools: McpTool[] = [
  // Resdex tools
  {
    definition: {
      name: 'resdex_download_cv',
      description:
        'Download CV from a Resdex candidate profile. Requires candidate URL and contact information.',
      inputSchema: {
        type: 'object',
        properties: {
          contact_obj: {
            type: 'object',
            description: 'Contact object with candidate information',
          },
          url: {
            type: 'string',
            description: 'Resdex candidate profile URL',
          },
          useDirectDownload: {
            type: 'boolean',
            description: 'Whether to use direct download method',
            default: true,
          },
          fileName: {
            type: 'string',
            description: 'Optional filename for the downloaded CV',
          },
        },
        required: ['contact_obj', 'url'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Resdex candidate profile URLs to open',
          },
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
        },
        required: ['urls'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to crawl',
            default: 10,
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to crawl',
            default: 10,
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to crawl',
            default: 10,
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          current_table_id: {
            type: 'string',
            description: 'Optional table ID for tracking',
          },
        },
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          contact_id: {
            type: 'string',
            description: 'Contact ID in Arxena to update',
          },
          candidate_url: {
            type: 'string',
            description: 'Naukri candidate profile URL',
          },
        },
        required: ['contact_id'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          profiles: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of profile objects to upload',
          },
        },
        required: ['profiles'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message content to send',
          },
          name: {
            type: 'string',
            description: 'Name of the contact',
          },
          linkedin_url: {
            type: 'string',
            description: 'LinkedIn profile URL of the contact',
          },
        },
        required: ['message', 'name', 'linkedin_url'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Optional connection request message',
          },
          name: {
            type: 'string',
            description: 'Name of the contact',
          },
          linkedin_url: {
            type: 'string',
            description: 'LinkedIn profile URL of the contact',
          },
        },
        required: ['name', 'linkedin_url'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to send message to (format: country code + number, e.g., "+1234567890")',
          },
          message: {
            type: 'string',
            description: 'Message content to send',
          },
          twentyMessageId: {
            type: 'string',
            description: 'Optional message ID from Arxena for tracking',
          },
        },
        required: ['phoneNumber', 'message'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
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
      inputSchema: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to send attachment to',
          },
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
          caption: {
            type: 'string',
            description: 'Optional caption for the attachment',
          },
        },
        required: ['phoneNumber', 'attachments'],
      },
    },
    handler: async (args, config) => {
      return callExtensionBridgeEndpoint(
        config.baseUrl,
        config.apiToken,
        'whatsapp-send-attachment',
        args,
      );
    },
  },
];
