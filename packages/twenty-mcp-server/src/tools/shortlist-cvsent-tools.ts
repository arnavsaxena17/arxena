import {
  createCvsentMutation,
  createManyShortlistsMutation,
  createShortlistMutation,
  graphQltoUpdateOneCandidate,
  graphqlQueryToFindCvsent,
  graphqlQueryToFindShortlists,
} from 'twenty-shared/graphql';
import { executeGraphQL } from '../api/graphql-client';
import { McpTool } from '../types/tool-types';

type ShortlistNode = {
  id: string;
  candidateId?: string;
  projectId?: string;
  cvSentsId?: string;
  name?: string;
  currentJobTitle?: string;
  yearsOfExperience?: string;
  currentCompany?: string;
  createdAt?: string;
};

function extractShortlists(data: unknown): ShortlistNode[] {
  const result = data as { shortlists?: { edges?: Array<{ node: ShortlistNode }> } };
  const edges = result?.shortlists?.edges ?? [];
  return edges.map((e) => e.node);
}

function extractCvSents(data: unknown): Array<{ id: string; name?: string; position?: string; projectId?: string; createdAt?: string }> {
  const result = data as { cvsent?: { edges?: Array<{ node: unknown }> } };
  const edges = result?.cvsent?.edges ?? [];
  return edges.map((e) => e.node as { id: string; name?: string; position?: string; projectId?: string; createdAt?: string });
}

export const shortlistCvsentTools: McpTool[] = [
  {
    definition: {
      name: 'list_shortlists',
      description:
        'List shortlists for the workspace. Optionally filter by projectId to get shortlists for a specific job. Returns shortlist id, candidateId, projectId, name, and profile fields.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional job ID to filter shortlists by job',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of shortlists to return (default: 50)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const filter: Record<string, unknown> = {};
      if (projectId) filter.projectId = { eq: projectId };

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindShortlists,
        { filter, limit, orderBy: [{ updatedAt: 'DescNullsLast' }] },
      );

      const shortlists = extractShortlists(data);
      return {
        count: shortlists.length,
        shortlists: shortlists.map((s) => ({
          id: s.id,
          candidateId: s.candidateId,
          projectId: s.projectId,
          cvSentsId: s.cvSentsId,
          name: s.name,
          currentJobTitle: s.currentJobTitle,
          yearsOfExperience: s.yearsOfExperience,
          currentCompany: s.currentCompany,
          createdAt: s.createdAt,
        })),
      };
    },
  },

  {
    definition: {
      name: 'create_shortlist',
      description:
        'Add a single candidate to a shortlist for a job. Creates one shortlist row (candidate + job). Optionally provide name or profile fields.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          candidateId: { type: 'string', description: 'Candidate ID to add to the shortlist' },
          name: { type: 'string', description: 'Optional display name for the shortlist entry' },
        },
        required: ['projectId', 'candidateId'],
      },
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string;
      const candidateId = args.candidateId as string;
      const name = args.name as string | undefined;

      const input: Record<string, unknown> = { projectId, candidateId };
      if (name) input.name = name;

      const data = await executeGraphQL<{ createShortlist?: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        createShortlistMutation,
        { input },
      );

      const id = data?.createShortlist?.id;
      if (!id) {
        throw new Error('Failed to create shortlist: no id returned');
      }
      return { success: true, shortlistId: id, projectId, candidateId, message: `Added candidate to shortlist (id: ${id})` };
    },
  },

  {
    definition: {
      name: 'add_candidates_to_shortlist',
      description:
        'Add multiple candidates to the shortlist for a job. Creates one shortlist row per candidate.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          candidateIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of candidate IDs to add to the shortlist',
          },
        },
        required: ['projectId', 'candidateIds'],
      },
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string;
      const candidateIds = args.candidateIds as string[];
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        throw new Error('candidateIds must be a non-empty array');
      }

      const data = candidateIds.map((candidateId) => ({ projectId, candidateId }));
      const result = await executeGraphQL<{ createShortlists?: Array<{ id: string }> }>(
        config.baseUrl,
        config.apiToken,
        createManyShortlistsMutation,
        { data },
      );

      const created = result?.createShortlists ?? [];
      return {
        success: true,
        projectId,
        added: created.length,
        shortlistIds: created.map((c) => c.id),
        message: `Added ${created.length} candidate(s) to shortlist for job`,
      };
    },
  },

  {
    definition: {
      name: 'list_cv_sents',
      description:
        'List CV Sent records (candidates sent to client for a job). Optionally filter by projectId.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Optional job ID to filter by' },
          limit: { type: 'number', description: 'Max records to return (default: 50)' },
        },
      },
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const filter: Record<string, unknown> = {};
      if (projectId) filter.projectId = { eq: projectId };

      const result = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindCvsent,
        { filter, limit, orderBy: [{ createdAt: 'DescNullsLast' }] },
      );

      const list = extractCvSents(result);
      return { count: list.length, cvSents: list };
    },
  },

  {
    definition: {
      name: 'move_candidate_to_cv_sent',
      description:
        'Move a candidate to CV Sent for a job: creates a CV Sent record and optionally updates the candidate status to CV Sent.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID' },
          projectId: { type: 'string', description: 'Project ID' },
          name: { type: 'string', description: 'Optional label for the CV Sent record (e.g. candidate name)' },
          updateCandidateStatus: {
            type: 'boolean',
            description: 'If true, set candidate status to CV Sent (default: true)',
          },
        },
        required: ['candidateId', 'projectId'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const projectId = args.projectId as string;
      const name = (args.name as string) ?? 'CV Sent';
      const updateCandidateStatus = args.updateCandidateStatus !== false;

      const cvSentInput: Record<string, unknown> = { candidateId, projectId, name };
      const cvSentResult = await executeGraphQL<{ createCvSent?: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        createCvsentMutation,
        { input: cvSentInput },
      );

      const cvSentId = cvSentResult?.createCvSent?.id;
      if (!cvSentId) {
        throw new Error('Failed to create CV Sent record');
      }

      if (updateCandidateStatus) {
        try {
          await executeGraphQL(
            config.baseUrl,
            config.apiToken,
            graphQltoUpdateOneCandidate,
            { idToUpdate: candidateId, input: { status: 'CV_SENT' } },
          );
        } catch {
          // CV Sent record was created; status update is best-effort
        }
      }

      return {
        success: true,
        cvSentId,
        candidateId,
        projectId,
        message: `Moved candidate to CV Sent (id: ${cvSentId})${updateCandidateStatus ? ' and updated candidate status' : ''}.`,
      };
    },
  },
];
