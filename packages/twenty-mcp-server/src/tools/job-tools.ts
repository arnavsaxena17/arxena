import type { Job, Jobs } from 'twenty-shared';
import { graphqlToAddNewJob, graphqlToFindManyJobs } from 'twenty-shared';

import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI, callRestAPIPatch } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractJobs(data: unknown): Job[] {
  const result = data as { jobs: Jobs };
  return result?.jobs?.edges?.map((e) => e.node) ?? [];
}

/** When the assistant injects assistantThreadId, persist the active job on that thread (REST). */
async function patchAssistantThreadJobId(
  config: { baseUrl: string; apiToken: string },
  assistantThreadId: string | undefined,
  jobId: string,
): Promise<void> {
  if (
    !assistantThreadId ||
    !UUID_REGEX.test(assistantThreadId) ||
    !UUID_REGEX.test(jobId)
  ) {
    return;
  }
  try {
    await callRestAPIPatch(
      config.baseUrl,
      config.apiToken,
      'assistant',
      `threads/${assistantThreadId}`,
      { jobId },
    );
  } catch (err) {
    console.error('Failed to attach job to assistant thread:', err);
  }
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
      description:
        'Get detailed information about a specific job by its ID. When called from the assistant with a thread context, the job is attached to that assistant thread.',
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
      const assistantThreadId = args.assistantThreadId as string | undefined;

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
        'get-job-by-id',
        { jobId },
      );

      const resultObj = result as { status?: string; job?: { id?: string } };
      if (
        resultObj?.status === 'Success' &&
        typeof resultObj.job?.id === 'string' &&
        resultObj.job.id === jobId
      ) {
        await patchAssistantThreadJobId(config, assistantThreadId, jobId);
      }

      return result;
    },
  },

  {
    definition: {
      name: 'find_job_by_name',
      description:
        'Search for jobs by name or company. Returns matching jobs with their IDs. If exactly one job matches, it is attached to the current assistant thread (when invoked from the assistant). Use get_job_by_id to attach after disambiguating multiple matches.',
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
      const assistantThreadId = args.assistantThreadId as string | undefined;

      const filter: Record<string, unknown> = {
        name: { ilike: `%${nameQuery}%` },
      };
      if (activeOnly) {
        filter.isActive = { eq: true };
      }

      const variables = {
        filter,
        limit: 10,
        orderBy: [{ position: 'AscNullsFirst' }],
      };

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyJobs,
        variables,
      );

      const jobs = extractJobs(data);
      if (jobs.length === 1 && jobs[0]?.id) {
        await patchAssistantThreadJobId(config, assistantThreadId, jobs[0].id);
      }
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
        'Create a new job opening in Arxena. Returns the new job ID. IMPORTANT: companyId must be an Arxena company UUID (from list_companies, get_company_by_id, or create_company), never a LinkedIn numeric ID. When assistantThreadId is provided, the new job is attached to that assistant thread.',
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
          assistantThreadId: {
            type: 'string',
            description:
              'ID of the assistant thread invoking this tool. When provided, the created job is attached to this thread.',
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
      const assistantThreadId = args.assistantThreadId as string | undefined;

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

      if (assistantThreadId && UUID_REGEX.test(assistantThreadId)) {
        try {
          await callRestAPIPatch(
            config.baseUrl,
            config.apiToken,
            'assistant',
            `threads/${assistantThreadId}`,
            { jobId },
          );
        } catch (err) {
          console.error('Failed to attach job to assistant thread:', err);
        }
      }

      return {
        success: true,
        jobId,
        assistantThreadId: assistantThreadId ?? null,
        message: `Job "${name}" created with ID ${jobId}`,
      };
    },
  },
];
