import {
  GET_ALL_MESSAGES_BY_CANDIDATE_ID_INPUT_DESCRIPTOR,
  SEND_BULK_CHATS_BY_CANDIDATE_IDS_INPUT_DESCRIPTOR,
  SEND_CHAT_INPUT_DESCRIPTOR,
  SHARE_JD_TO_CANDIDATE_INPUT_DESCRIPTOR,
  UPLOAD_JD_INPUT_DESCRIPTOR
} from 'twenty-shared';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

export const arxChatTools: McpTool[] = [
  {
    definition: {
      name: 'send_chat',
      description:
        'Send a chat message to a candidate (e.g. via WhatsApp). Pass candidate/candidateId and message content.',
      inputSchema: descriptorToInputSchema(SEND_CHAT_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'arx-chat', 'send-chat', body);
    },
  },

  {
    definition: {
      name: 'get_all_messages_by_candidate_id',
      description: 'Retrieve full chat history for a candidate by their candidate ID.',
      inputSchema: descriptorToInputSchema(GET_ALL_MESSAGES_BY_CANDIDATE_ID_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'arx-chat',
        'get-all-messages-by-candidate-id',
        body,
      );
    },
  },

  {
    definition: {
      name: 'share_jd_to_candidate',
      description: 'Share a job description (JD) with a candidate via chat.',
      inputSchema: descriptorToInputSchema(SHARE_JD_TO_CANDIDATE_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'arx-chat', 'share-jd-to-candidate', body);
    },
  },

  {
    definition: {
      name: 'upload_jd',
      description: 'Upload a job description file for use in sharing or search.',
      inputSchema: descriptorToInputSchema(UPLOAD_JD_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'upload-jd', body);
    },
  },


  {
    definition: {
      name: 'send_bulk_chats_by_candidate_ids',
      description: 'Send the same message to multiple candidates by their IDs.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(SEND_BULK_CHATS_BY_CANDIDATE_IDS_INPUT_DESCRIPTOR);
        // Handle array type for candidateIds
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            candidateIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of candidate IDs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'arx-chat',
        'send-bulk-chats-by-candidate-ids',
        body,
      );
    },
  },
];
