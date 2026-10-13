import { callRestAPIGet } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
import { SEARCH_WIKIDATA_COMPANIES_INPUT_DESCRIPTOR } from '../utils/McpToolSchemas';

export const wikidataTools: McpTool[] = [
  {
    definition: {
      name: 'search_wikidata_companies',
      description:
        'Fetch structured company details from Wikidata. Prefer domain/URL lookup (official website P856). Falls back to company name search. Returns HQ, industry, employees, executives, stock listing, and Wikidata/Wikipedia IDs.',
      inputSchema: descriptorToInputSchema(
        SEARCH_WIKIDATA_COMPANIES_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const { domain, name, limit } = args as {
        domain?: string;
        name?: string;
        limit?: number;
      };

      const hasDomain =
        typeof domain === 'string' && domain.trim().length > 0;
      const hasName = typeof name === 'string' && name.trim().length > 0;

      if (!hasDomain && !hasName) {
        throw new Error(
          'Provide at least one of: domain (preferred) or name.',
        );
      }

      if (hasDomain) {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'wikidata',
          'companies/by-domain',
          { domain: domain!.trim() },
        );
      }

      const queryParams: Record<string, string> = {
        name: name!.trim(),
      };

      if (typeof limit === 'number' && Number.isFinite(limit)) {
        queryParams.limit = String(limit);
      }

      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'wikidata',
        'companies/by-name',
        queryParams,
      );
    },
  },
];
