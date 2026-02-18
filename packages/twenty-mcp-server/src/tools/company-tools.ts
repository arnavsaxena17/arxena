import { CreateOneCompany, graphqlToFindManyCompanies } from 'twenty-shared';

import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

type CompanyNode = {
  id: string;
  name?: string;
  domainName?: string | null;
  descriptionOneliner?: string | null;
  linkedinLink?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

type CompaniesConnection = {
  companies?: {
    edges?: Array<{ node: CompanyNode }>;
  };
};

function extractCompanies(data: unknown): CompanyNode[] {
  const result = data as CompaniesConnection;
  return result?.companies?.edges?.map((e) => e.node) ?? [];
}

export const companyTools: McpTool[] = [
  {
    definition: {
      name: 'list_companies',
      description:
        'List companies in Arxena. Returns company IDs, names, domain, and description. Use this to get company IDs before creating jobs.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of companies to return (default: 30)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const limit = typeof args.limit === 'number' ? args.limit : 30;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyCompanies,
        { limit },
      );

      const companies = extractCompanies(data);
      return {
        count: companies.length,
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          domainName: c.domainName,
          descriptionOneliner: c.descriptionOneliner,
          linkedinUrl: c.linkedinLink?.primaryLinkUrl,
          createdAt: c.createdAt,
        })),
      };
    },
  },

  {
    definition: {
      name: 'get_company_by_id',
      description: 'Get detailed information about a specific company by its ID.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            description: 'The unique ID of the company',
          },
        },
        required: ['companyId'],
      },
    },
    handler: async (args, config) => {
      const companyId = args.companyId as string;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyCompanies,
        { filter: { id: { eq: companyId } }, limit: 1 },
      );

      const companies = extractCompanies(data);
      if (companies.length === 0) {
        return { error: `No company found with ID: ${companyId}` };
      }

      const c = companies[0];
      return {
        id: c.id,
        name: c.name,
        domainName: c.domainName,
        descriptionOneliner: c.descriptionOneliner,
        linkedinUrl: c.linkedinLink?.primaryLinkUrl,
        linkedinLabel: c.linkedinLink?.primaryLinkLabel,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    },
  },

  {
    definition: {
      name: 'find_company_by_name',
      description:
        'Find a company by name, searching locally first, then LinkedIn if not found. Returns company ID, name, LinkedIn URL, and source (local or linkedin). Useful for finding companies when you only have a name.',
      inputSchema: {
        type: 'object',
        properties: {
          companyName: {
            type: 'string',
            description: 'Company name to search for',
          },
        },
        required: ['companyName'],
      },
    },
    handler: async (args, config) => {
      const companyName = args.companyName as string;

      if (!companyName || companyName.trim().length === 0) {
        throw new Error('Company name is required');
      }

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'org-chart',
        'companies/find-by-name',
        { companyName: companyName.trim() },
      );

      return result;
    },
  },

  // {
  //   definition: {
  //     name: 'find_companies_by_name',
  //     description:
  //       'Search for companies by name or domain. Returns matching companies with their IDs.',
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         nameQuery: {
  //           type: 'string',
  //           description: 'Partial company name or domain to search for (case-insensitive)',
  //         },
  //         limit: {
  //           type: 'number',
  //           description: 'Maximum number of companies to return (default: 10)',
  //         },
  //       },
  //       required: ['nameQuery'],
  //     },
  //   },
  //   handler: async (args, config) => {
  //     const nameQuery = args.nameQuery as string;
  //     const limit = typeof args.limit === 'number' ? args.limit : 10;

  //     const data = await executeGraphQL(
  //       config.baseUrl,
  //       config.apiToken,
  //       graphqlToFindManyCompanies,
  //       {
  //         filter: { name: { like: `%${nameQuery}%` } },
  //         limit,
  //       },
  //     );

  //     const companies = extractCompanies(data);
  //     return {
  //       count: companies.length,
  //       companies: companies.map((c) => ({
  //         id: c.id,
  //         name: c.name,
  //         domainName: c.domainName,
  //         descriptionOneliner: c.descriptionOneliner,
  //       })),
  //     };
  //   },
  // },

  {
    definition: {
      name: 'create_company',
      description:
        'Create a new company in Arxena. Returns the new company ID. Use this before creating jobs that belong to a company.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Company name',
          },
          domainName: {
            type: 'string',
            description: 'Company domain (e.g. "acme.com")',
          },
          descriptionOneliner: {
            type: 'string',
            description: 'Short one-line description of the company',
          },
          linkedinUrl: {
            type: 'string',
            description: 'LinkedIn company page URL',
          },
        },
        required: ['name'],
      },
    },
    handler: async (args, config) => {
      const name = args.name as string;
      const domainName = args.domainName as string | undefined;
      const descriptionOneliner = args.descriptionOneliner as string | undefined;
      const linkedinUrl = args.linkedinUrl as string | undefined;

      const input: Record<string, unknown> = { name };
      if (domainName !== undefined) input.domainName = domainName;
      if (descriptionOneliner !== undefined) input.descriptionOneliner = descriptionOneliner;
      if (linkedinUrl !== undefined) {
        input.linkedinLink = {
          primaryLinkUrl: linkedinUrl,
          primaryLinkLabel: 'LinkedIn',
        };
      }

      const data = await executeGraphQL<{ createCompany: { id: string } }>(
        config.baseUrl,
        config.apiToken,
        CreateOneCompany,
        { input },
      );

      const companyId = data?.createCompany?.id;
      if (!companyId) {
        throw new Error('Failed to create company: no id returned');
      }

      return {
        success: true,
        companyId,
        message: `Company "${name}" created with ID ${companyId}`,
      };
    },
  },
];
