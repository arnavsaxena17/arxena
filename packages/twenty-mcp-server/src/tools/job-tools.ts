import type { Job, Jobs } from 'twenty-shared';
import { graphqlToAddNewJob, graphqlToFindManyJobs } from 'twenty-shared';

import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractJobs(data: unknown): Job[] {
  const result = data as { jobs: Jobs };
  return result?.jobs?.edges?.map((e) => e.node) ?? [];
}

export const jobTools: McpTool[] = [
  {
    definition: {
      name: 'list_active_jobs',
      description:
        'List all active job openings for the current recruiter in Arxena. Returns job IDs, names, locations, and company info. Use this to get job IDs before creating candidates or searching for candidates by job.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of jobs to return (default: 30)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const limit = typeof args.limit === 'number' ? args.limit : 30;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyJobs,
        {
          filter: { isActive: { eq: true } },
          limit,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      );

      const jobs = extractJobs(data);
      return {
        count: jobs.length,
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          jobCode: j.jobCode,
          jobLocation: j.jobLocation,
          isActive: j.isActive,
          company: j.company,
          salaryBracket: j.salaryBracket,
          createdAt: j.createdAt,
        })),
      };
    },
  },

  {
    definition: {
      name: 'get_job_by_id',
      description: 'Get detailed information about a specific job by its ID.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The unique ID of the job',
          },
        },
        required: ['jobId'],
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string;

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
        'get-job-by-id',
        { jobId },
      );

      return result;
    },
  },

  {
    definition: {
      name: 'find_job_by_name',
      description:
        'Search for jobs by name or company. Returns matching jobs with their IDs. Useful when you know part of the job title or company name.',
      inputSchema: {
        type: 'object',
        properties: {
          nameQuery: {
            type: 'string',
            description: 'Partial job name to search for (case-insensitive)',
          },
          activeOnly: {
            type: 'boolean',
            description: 'If true, only return active jobs (default: true)',
          },
        },
        required: ['nameQuery'],
      },
    },
    handler: async (args, config) => {
      const nameQuery = args.nameQuery as string;
      const activeOnly = args.activeOnly !== false;

      const filter: Record<string, unknown> = {
        name: { like: `%${nameQuery}%` },
      };
      if (activeOnly) {
        filter.isActive = { eq: true };
      }

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyJobs,
        { filter, limit: 10 },
      );

      const jobs = extractJobs(data);
      return {
        count: jobs.length,
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          jobCode: j.jobCode,
          jobLocation: j.jobLocation,
          isActive: j.isActive,
          company: j.company,
        })),
      };
    },
  },

  {
    definition: {
      name: 'create_job',
      description:
        'Create a new job opening in Arxena. Returns the new job ID. IMPORTANT: companyId must be an Arxena company UUID (from list_companies, get_company_by_id, or create_company), never a LinkedIn numeric ID.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Job title or name',
          },
          jobLocation: {
            type: 'string',
            description: 'Job location (e.g. city, remote)',
          },
          companyId: {
            type: 'string',
            description:
              'Arxena company UUID this job belongs to (use list_companies, get_company_by_id, find_company_by_name, or create_company to get this ID). Do NOT pass LinkedIn IDs here.',
          },
        },
        required: ['name'],
      },
    },
    handler: async (args, config) => {
      const name = args.name as string;
      const jobLocation = args.jobLocation as string | undefined;
      const jobCode = args.jobCode as string | undefined;
      const companyId = args.companyId as string | undefined;

      if (companyId !== undefined && !UUID_REGEX.test(companyId)) {
        throw new Error(
          `Invalid companyId "${companyId}". companyId must be an Arxena company UUID (not a LinkedIn numeric ID).`,
        );
      }

      const input: Record<string, unknown> = {
        name,
        isActive: true,
      };
      if (jobLocation !== undefined) input.jobLocation = jobLocation;
      if (jobCode !== undefined) input.jobCode = jobCode;
      if (companyId !== undefined) input.companyId = companyId;
      if (config.workspaceMemberId) input.recruiterId = config.workspaceMemberId;
      console.log("workspaceMemberId in create job:", config.workspaceMemberId);
      const data = await executeGraphQL<{ createJob: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlToAddNewJob,
        { input },
      );

      const jobId = data?.createJob?.id;
      if (!jobId) {
        throw new Error('Failed to create job: no id returned');
      }
      if (!UUID_REGEX.test(jobId)) {
        throw new Error(
          `Backend returned non-UUID jobId "${jobId}". Job IDs must always be UUIDs.`,
        );
      }

      return {
        success: true,
        jobId,
        message: `Job "${name}" created with ID ${jobId}`,
      };
    },
  },
];
