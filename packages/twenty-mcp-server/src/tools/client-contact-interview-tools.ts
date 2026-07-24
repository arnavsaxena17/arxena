import {
  graphqlMutationCreateOneClientContact,
  graphqlMutationCreateOneInterviewSchedule,
  graphqlQueryToCreateOneClientInterview,
  graphqlQueryToFindManyClientContacts,
  graphqlQueryToFindManyInterviewSchedules,
  graphqlQueryToFindScheduledClientMeetings,
} from 'twenty-shared';
import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

function extractClientContacts(data: unknown): Array<{ id: string; name?: string; jobsId?: string; peopleId?: string; createdAt?: string }> {
  const result = data as { clientContacts?: { edges?: Array<{ node: unknown }> } };
  const edges = result?.clientContacts?.edges ?? [];
  return edges.map((e) => e.node as { id: string; name?: string; jobsId?: string; peopleId?: string; createdAt?: string });
}

function extractInterviewSchedules(data: unknown): Array<{
  id: string;
  name?: string;
  jobsId?: string;
  meetingType?: string;
  position?: string;
  slotsAvailable?: string;
  createdAt?: string;
}> {
  const result = data as { interviewSchedules?: { edges?: Array<{ node: unknown }> } };
  const edges = result?.interviewSchedules?.edges ?? [];
  return edges.map((e) => e.node as { id: string; name?: string; jobsId?: string; meetingType?: string; position?: string; slotsAvailable?: string; createdAt?: string });
}

function extractClientInterviews(data: unknown): Array<{
  id: string;
  name?: string;
  position?: string;
  candidateId?: string;
  clientContactId?: string;
  interviewScheduleId?: string;
  interviewTime?: string;
  clientInterviewCompleted?: boolean;
  createdAt?: string;
}> {
  const result = data as { clientInterviews?: { edges?: Array<{ node: unknown }> } };
  const edges = result?.clientInterviews?.edges ?? [];
  return edges.map((e) => e.node as {
    id: string;
    name?: string;
    position?: string;
    candidateId?: string;
    clientContactId?: string;
    interviewScheduleId?: string;
    interviewTime?: string;
    clientInterviewCompleted?: boolean;
    createdAt?: string;
  });
}

export const clientContactInterviewTools: McpTool[] = [
  {
    definition: {
      name: 'list_client_contacts',
      description: 'List client contacts for the workspace. Optionally filter by jobId to get contacts for a specific job.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Optional job ID to filter client contacts by job' },
          limit: { type: 'number', description: 'Max records to return (default: 50)' },
        },
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const filter: Record<string, unknown> = {};
      if (jobId) filter.jobsId = { eq: jobId };

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindManyClientContacts,
        { filter, limit, orderBy: [{ updatedAt: 'DescNullsLast' }] },
      );

      const list = extractClientContacts(data);
      return { count: list.length, clientContacts: list };
    },
  },

  {
    definition: {
      name: 'create_client_contact',
      description: 'Create a client contact. Link to a job (jobsId) and optionally to a person (peopleId).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for the client contact' },
          jobId: { type: 'string', description: 'Job ID this contact is associated with' },
          peopleId: { type: 'string', description: 'Optional person ID (e.g. for email/phone)' },
        },
        required: ['name', 'jobId'],
      },
    },
    handler: async (args, config) => {
      const name = args.name as string;
      const jobId = args.jobId as string;
      const peopleId = args.peopleId as string | undefined;

      const input: Record<string, unknown> = { name, jobsId: jobId };
      if (peopleId) input.peopleId = peopleId;

      const result = await executeGraphQL<{ createClientContact?: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlMutationCreateOneClientContact,
        { input },
      );

      const id = result?.createClientContact?.id;
      if (!id) throw new Error('Failed to create client contact');
      return { success: true, clientContactId: id, jobId, message: `Client contact "${name}" created (id: ${id})` };
    },
  },

  {
    definition: {
      name: 'list_interview_schedules',
      description: 'List interview schedules (e.g. client interview slots) for a job. Optionally filter by jobId.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Optional job ID to filter by' },
          limit: { type: 'number', description: 'Max records to return (default: 50)' },
        },
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const filter: Record<string, unknown> = {};
      if (jobId) filter.jobsId = { eq: jobId };

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindManyInterviewSchedules,
        { filter, limit, orderBy: [{ position: 'AscNullsFirst' }] },
      );

      const list = extractInterviewSchedules(data);
      return { count: list.length, interviewSchedules: list };
    },
  },

  {
    definition: {
      name: 'create_interview_schedule',
      description: 'Create an interview schedule (slot template) for a job. Used when scheduling client interviews.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
          name: { type: 'string', description: 'Name for the schedule (e.g. "Client Round 1")' },
          meetingType: { type: 'string', description: 'Optional meeting type (e.g. "Video", "In-person")' },
          position: { type: 'number', description: 'Optional position/order' },
        },
        required: ['jobId', 'name'],
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string;
      const name = args.name as string;
      const meetingType = args.meetingType as string | undefined;
      const position = args.position as number | undefined;

      const input: Record<string, unknown> = { name, jobsId: jobId };
      if (meetingType !== undefined) input.meetingType = meetingType;
      if (typeof position === 'number') input.position = position;

      const result = await executeGraphQL<{ createInterviewSchedule?: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlMutationCreateOneInterviewSchedule,
        { input },
      );

      const id = result?.createInterviewSchedule?.id;
      if (!id) throw new Error('Failed to create interview schedule');
      return { success: true, interviewScheduleId: id, jobId, message: `Interview schedule "${name}" created (id: ${id})` };
    },
  },

  {
    definition: {
      name: 'list_client_interviews',
      description: 'List client interviews (scheduled or completed). Filter by jobId, candidateId, or clientContactId.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Optional: filter by job (via interview schedule)' },
          candidateId: { type: 'string', description: 'Optional: filter by candidate' },
          clientContactId: { type: 'string', description: 'Optional: filter by client contact' },
          limit: { type: 'number', description: 'Max records (default: 50)' },
        },
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string | undefined;
      const clientContactId = args.clientContactId as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const filter: Record<string, unknown> = {};
      if (candidateId) filter.candidateId = { eq: candidateId };
      if (clientContactId) filter.clientContactId = { eq: clientContactId };

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindScheduledClientMeetings,
        { filter, limit, orderBy: [{ interviewTime: 'DescNullsLast' }] },
      );

      const list = extractClientInterviews(data);
      return { count: list.length, clientInterviews: list };
    },
  },

  {
    definition: {
      name: 'create_client_interview',
      description:
        'Schedule a client interview. Requires candidateId, clientContactId, and interviewScheduleId. Optionally set interviewTime.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID' },
          clientContactId: { type: 'string', description: 'Client contact ID (who is conducting the interview)' },
          interviewScheduleId: { type: 'string', description: 'Interview schedule/slot template ID' },
          name: { type: 'string', description: 'Optional name for the interview' },
          position: { type: 'number', description: 'Optional position' },
          interviewTime: { type: 'string', description: 'Optional ISO date/time for the interview' },
        },
        required: ['candidateId', 'clientContactId', 'interviewScheduleId'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const clientContactId = args.clientContactId as string;
      const interviewScheduleId = args.interviewScheduleId as string;
      const name = args.name as string | undefined;
      const position = args.position as number | undefined;
      const interviewTime = args.interviewTime as string | undefined;

      const input: Record<string, unknown> = {
        candidateId,
        clientContactId,
        interviewScheduleId,
      };
      if (name) input.name = name;
      if (typeof position === 'number') input.position = position;
      if (interviewTime) input.interviewTime = interviewTime;

      const result = await executeGraphQL<{ createClientInterview?: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToCreateOneClientInterview,
        { input },
      );

      const id = result?.createClientInterview?.id;
      if (!id) throw new Error('Failed to create client interview');
      return {
        success: true,
        clientInterviewId: id,
        candidateId,
        clientContactId,
        interviewScheduleId,
        message: `Client interview scheduled (id: ${id})`,
      };
    },
  },

  {
    definition: {
      name: 'send_shortlist_to_client',
      description:
        'Queue creation of a Gmail draft with the shortlist for the given candidates. The recruiter can then review and send the email. Provide candidate IDs (e.g. from a shortlist or CV Sent).',
      inputSchema: {
        type: 'object',
        properties: {
          candidateIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of candidate IDs to include in the shortlist email',
          },
          origin: {
            type: 'string',
            description: 'Origin for tracking (e.g. "mcp-assistant" or "create-gmail-draft-shortlist")',
          },
        },
        required: ['candidateIds'],
      },
    },
    handler: async (args, config) => {
      const candidateIds = args.candidateIds as string[];
      const origin = (args.origin as string) ?? 'mcp-assistant';
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        throw new Error('candidateIds must be a non-empty array');
      }

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'arx-delivery',
        'create-gmail-draft-shortlist',
        { candidateIds, origin },
      );

      const res = result as { success?: boolean; message?: string; status?: string };
      return {
        success: res?.success ?? true,
        message: res?.message ?? 'Gmail draft shortlist creation queued. Recruiter can review and send from Gmail.',
        status: res?.status ?? 'queued',
      };
    },
  },
];
