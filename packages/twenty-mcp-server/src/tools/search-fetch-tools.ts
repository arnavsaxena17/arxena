import type { Project, Projects } from 'twenty-shared/arx';
import {
  graphqlToFindManyCompanies,
  graphqlToFindManyProjects,
} from 'twenty-shared/graphql';

import { executeGraphQL } from '../api/graphql-client';
import { fetchOrgChart } from '../api/org-chart-api';
import { callRestAPI } from '../api/rest-client';
import { ArxenaConfig } from '../config';
import { McpTool } from '../types/tool-types';
import { candidateTools } from './candidate-tools';
import { projectTools } from './project-tools';

type SearchResult = {
  id: string;
  title: string;
  url: string;
};

type FetchResult = {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, string>;
};

const buildOrgChartUrl = (slug: string): string =>
  `https://arxena.com/org-chart/${slug}`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extractProjects = (data: unknown): Project[] => {
  const result = data as { projects: Projects };
  return result?.projects?.edges?.map((edge) => edge.node) ?? [];
};

const extractCompanies = (
  data: unknown,
): Array<{ id: string; name?: string }> => {
  const result = data as {
    companies?: { edges?: Array<{ node: { id: string; name?: string } }> };
  };
  return result?.companies?.edges?.map((edge) => edge.node) ?? [];
};

const searchWorkspace = async (
  query: string,
  config: ArxenaConfig,
): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return results;
  }

  const companyResult = (await callRestAPI(
    config.baseUrl,
    config.apiToken,
    'org-chart',
    'companies/find-by-name',
    { companyName: query.trim() },
  )) as {
    found?: boolean;
    companyId?: string;
    companyName?: string;
  };

  if (companyResult.found && companyResult.companyId) {
    const companyName = companyResult.companyName ?? query.trim();
    results.push({
      id: `orgchart:${companyResult.companyId}`,
      title: `Org chart: ${companyName}`,
      url: buildOrgChartUrl(slugify(companyName)),
    });
  }

  const projectsData = await executeGraphQL(
    config.baseUrl,
    config.apiToken,
    graphqlToFindManyProjects,
    {
      filter: { isActive: { eq: true } },
      limit: 30,
      orderBy: [{ position: 'AscNullsFirst' }],
    },
  );

  for (const project of extractProjects(projectsData)) {
    if (project.name.toLowerCase().includes(normalizedQuery)) {
      results.push({
        id: `project:${project.id}`,
        title: `Project: ${project.name}`,
        url: '',
      });
    }
  }

  const companiesData = await executeGraphQL(
    config.baseUrl,
    config.apiToken,
    graphqlToFindManyCompanies,
    { limit: 30 },
  );

  for (const company of extractCompanies(companiesData)) {
    if ((company.name ?? '').toLowerCase().includes(normalizedQuery)) {
      const alreadyListed = results.some(
        (entry) => entry.id === `orgchart:${company.id}`,
      );
      if (!alreadyListed && company.name) {
        results.push({
          id: `orgchart:${company.id}`,
          title: `Org chart: ${company.name}`,
          url: buildOrgChartUrl(slugify(company.name)),
        });
      }
    }
  }

  const findCandidateTool = candidateTools.find(
    (tool) => tool.definition.name === 'find_candidate',
  );
  if (findCandidateTool) {
    const candidateMatches = (await findCandidateTool.handler(
      { name: query.trim(), limit: 10 },
      config,
    )) as {
      results?: Array<{
        candidates?: Array<{ candidateId: string; candidateName: string }>;
      }>;
    };

    for (const person of candidateMatches.results ?? []) {
      for (const candidate of person.candidates ?? []) {
        results.push({
          id: `candidate:${candidate.candidateId}`,
          title: `Candidate: ${candidate.candidateName}`,
          url: '',
        });
      }
    }
  }

  return results.slice(0, 20);
};

const fetchDocument = async (
  id: string,
  config: ArxenaConfig,
): Promise<FetchResult> => {
  const [type, resourceId] = id.split(':', 2);
  if (!type || !resourceId) {
    throw new Error(`Invalid document id: ${id}`);
  }

  if (type === 'orgchart') {
    const orgChart = await fetchOrgChart(config.baseUrl, config.apiToken, resourceId);
    const companyName =
      (orgChart as { companyName?: string }).companyName ?? resourceId;

    return {
      id,
      title: `Org chart: ${companyName}`,
      text: JSON.stringify(orgChart, null, 2),
      url: buildOrgChartUrl(slugify(companyName)),
      metadata: { type: 'orgchart', companyId: resourceId },
    };
  }

  if (type === 'project') {
    const getProjectTool = projectTools.find(
      (tool) => tool.definition.name === 'get_project_by_id',
    );
    if (!getProjectTool) {
      throw new Error('get_project_by_id tool is unavailable');
    }

    const projectResult = await getProjectTool.handler({ projectId: resourceId }, config);
    const projectName =
      (projectResult as { project?: { name?: string } })?.project?.name ?? resourceId;

    return {
      id,
      title: `Project: ${projectName}`,
      text: JSON.stringify(projectResult, null, 2),
      url: '',
      metadata: { type: 'project' },
    };
  }

  if (type === 'candidate') {
    const getCandidateTool = candidateTools.find(
      (tool) => tool.definition.name === 'get_candidate_details',
    );
    if (!getCandidateTool) {
      throw new Error('get_candidate_details tool is unavailable');
    }

    const candidateResult = await getCandidateTool.handler(
      { candidateId: resourceId },
      config,
    );
    const candidateName = String(
      (candidateResult as { candidate?: { name?: string } })?.candidate?.name ??
        resourceId,
    );

    return {
      id,
      title: `Candidate: ${candidateName}`,
      text: JSON.stringify(candidateResult, null, 2),
      url: '',
      metadata: { type: 'candidate' },
    };
  }

  throw new Error(`Unsupported document type in id: ${id}`);
};

export const searchFetchTools: McpTool[] = [
  {
    definition: {
      name: 'search',
      title: 'Search knowledge',
      description:
        'Search Arxena workspace knowledge: org charts, companies, jobs, candidates, and global ES people/companies indices (use search_people_index / search_companies_index for direct index search).',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query for companies, org charts, jobs, or candidates',
          },
        },
        required: ['query'],
      },
    },
    handler: async (args, config) => {
      const query = String(args.query ?? '').trim();
      if (!query) {
        throw new Error('query is required');
      }

      const results = await searchWorkspace(query, config);
      return { results };
    },
  },
  {
    definition: {
      name: 'fetch',
      title: 'Fetch document',
      description:
        'Fetch a full document by id returned from search (orgchart:{id}, project:{id}, candidate:{id}).',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Document id from search results',
          },
        },
        required: ['id'],
      },
    },
    handler: async (args, config) =>
      fetchDocument(String(args.id ?? ''), config),
  },
];
