import type { Project, Projects } from 'twenty-shared/arx';
import {
  graphqlToAddNewProject,
  graphqlToFindManyProjects,
} from 'twenty-shared/graphql';

import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI, callRestAPIPatch } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractProjects(data: unknown): Project[] {
  const result = data as { projects: Projects };
  return result?.projects?.edges?.map((e) => e.node) ?? [];
}

/** When the assistant injects assistantThreadId, persist the active job on that thread (REST). */
async function patchAssistantThreadProjectId(
  config: { baseUrl: string; apiToken: string },
  assistantThreadId: string | undefined,
  projectId: string,
): Promise<void> {
  if (
    !assistantThreadId ||
    !UUID_REGEX.test(assistantThreadId) ||
    !UUID_REGEX.test(projectId)
  ) {
    return;
  }
  try {
    await callRestAPIPatch(
      config.baseUrl,
      config.apiToken,
      'assistant',
      `threads/${assistantThreadId}`,
      { projectId },
    );
  } catch (err) {
    console.error('Failed to attach job to assistant thread:', err);
  }
}

export const projectTools: McpTool[] = [
  {
    definition: {
      name: 'list_active_projects',
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
        graphqlToFindManyProjects,
        {
          filter: { isActive: { eq: true } },
          limit,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      );

      const projects = extractProjects(data);
      return {
        count: projects.length,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          jobCode: project.jobCode,
          jobLocation: project.jobLocation,
          isActive: project.isActive,
          company: project.company,
          salaryBracket: project.salaryBracket,
          createdAt: project.createdAt,
        })),
      };
    },
  },

  {
    definition: {
      name: 'get_project_by_id',
      description:
        'Get detailed information about a specific project by its ID. When called from the assistant with a thread context, the project is attached to that assistant thread.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The unique ID of the project',
          },
        },
        required: ['projectId'],
      },
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string;
      const assistantThreadId = args.assistantThreadId as string | undefined;

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
        'get-project-by-id',
        { projectId },
      );

      const resultObj = result as { status?: string; project?: { id?: string } };
      if (
        resultObj?.status === 'Success' &&
        typeof resultObj.project?.id === 'string' &&
        resultObj.project.id === projectId
      ) {
        await patchAssistantThreadProjectId(config, assistantThreadId, projectId);
      }

      return result;
    },
  },

  {
    definition: {
      name: 'find_project_by_name',
      description:
        'Search for projects by name or company. Returns matching projects with their IDs. If exactly one project matches, it is attached to the current assistant thread (when invoked from the assistant). Use get_project_by_id to attach after disambiguating multiple matches.',
      inputSchema: {
        type: 'object',
        properties: {
          nameQuery: {
            type: 'string',
            description: 'Partial project name to search for (case-insensitive)',
          },
          activeOnly: {
            type: 'boolean',
            description: 'If true, only return active projects (default: true)',
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
        graphqlToFindManyProjects,
        variables,
      );

      const projects = extractProjects(data);
      if (projects.length === 1 && projects[0]?.id) {
        await patchAssistantThreadProjectId(
          config,
          assistantThreadId,
          projects[0].id,
        );
      }
      return {
        count: projects.length,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          jobCode: project.jobCode,
          jobLocation: project.jobLocation,
          isActive: project.isActive,
          company: project.company,
        })),
      };
    },
  },

  {
    definition: {
      name: 'create_project',
      description:
        'Create a new job opening in Arxena. Returns the new job ID. IMPORTANT: companyId must be an Arxena company UUID (from list_companies, get_company_by_id, or create_company), never a LinkedIn numeric ID. When assistantThreadId is provided, the new job is attached to that assistant thread.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project title or name',
          },
          jobLocation: {
            type: 'string',
            description: 'Project location (e.g. city, remote)',
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
      console.log("workspaceMemberId in create project:", config.workspaceMemberId);
      const data = await executeGraphQL<{ createProject: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlToAddNewProject,
        { input },
      );

      const projectId = data?.createProject?.id;
      if (!projectId) {
        throw new Error('Failed to create project: no id returned');
      }
      if (!UUID_REGEX.test(projectId)) {
        throw new Error(
          `Backend returned non-UUID projectId "${projectId}". Project IDs must always be UUIDs.`,
        );
      }

      if (assistantThreadId && UUID_REGEX.test(assistantThreadId)) {
        try {
          await callRestAPIPatch(
            config.baseUrl,
            config.apiToken,
            'assistant',
            `threads/${assistantThreadId}`,
            { projectId },
          );
        } catch (err) {
          console.error('Failed to attach job to assistant thread:', err);
        }
      }

      return {
        success: true,
        projectId,
        assistantThreadId: assistantThreadId ?? null,
        message: `Project "${name}" created with ID ${projectId}`,
      };
    },
  },
];
