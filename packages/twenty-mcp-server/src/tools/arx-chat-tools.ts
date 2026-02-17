import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

export const arxChatTools: McpTool[] = [
  {
    definition: {
      name: 'send_chat',
      description:
        'Send a chat message to a candidate (e.g. via WhatsApp). Pass candidate/candidateId and message content.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID to send message to' },
          message: { type: 'string', description: 'Message content' },
          phoneNumber: { type: 'string', description: 'Optional phone number override' },
        },
        required: ['candidateId', 'message'],
      },
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
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID' },
        },
        required: ['candidateId'],
      },
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
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID' },
          jobId: { type: 'string', description: 'Job ID' },
          jdContent: { type: 'string', description: 'JD text or reference' },
        },
        required: ['candidateId', 'jobId'],
      },
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
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
          filePath: { type: 'string', description: 'Path or reference to JD file' },
          content: { type: 'string', description: 'Optional raw JD content' },
        },
        required: ['jobId'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'arx-chat', 'upload-jd', body);
    },
  },

  {
    definition: {
      name: 'get_candidates_by_job_id',
      description: 'Get candidates linked to a job (from arx-chat context).',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
        },
        required: ['jobId'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'arx-chat',
        'get-candidates-by-job-id',
        body,
      );
    },
  },

  {
    definition: {
      name: 'send_bulk_chats_by_candidate_ids',
      description: 'Send the same message to multiple candidates by their IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate IDs',
          },
          message: { type: 'string', description: 'Message content' },
        },
        required: ['candidateIds', 'message'],
      },
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
