import OpenAI from 'openai';
import { CompanyCultureService } from '../services/company-culture.service';
import { CompetitorClassificationService } from '../services/competitor-classification.service';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { LocationClusterService } from '../services/location-cluster.service';
import { OrgChartMappingService } from '../services/org-chart-mapping.service';
import { QueryUnderstanding } from '../types/candidate-search-request.type';

export type ToolContext = {
  knowledgeBase: KnowledgeBaseService;
  companyCulture: CompanyCultureService;
  orgChartMapping: OrgChartMappingService;
  locationCluster: LocationClusterService;
  competitorClassification: CompetitorClassificationService;
  apiToken?: string;
};

/**
 * Get available knowledge retrieval tools for OpenAI function calling
 */
export function getKnowledgeRetrievalTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_recruiting_knowledge',
        description:
          'Fetch recruiting domain knowledge on a specific topic. Use this to get expert recruiting insights, best practices, and domain-specific knowledge.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description:
                'The topic to get knowledge about (e.g., "org structure fitment", "location fallback strategies", "executive search patterns")',
            },
            context: {
              type: 'string',
              description:
                'Additional context about the query or situation to help provide relevant knowledge',
            },
          },
          required: ['topic'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_company_culture',
        description:
          'Get company culture classification (promoter-driven, family-run, MNC, startup, etc.) for a company. Use this to match candidates from similar company cultures.',
        parameters: {
          type: 'object',
          properties: {
            companyName: {
              type: 'string',
              description: 'The name of the company to classify',
            },
            industry: {
              type: 'string',
              description: 'The industry the company operates in (optional)',
            },
          },
          required: ['companyName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_org_structure_pattern',
        description:
          'Get organizational structure patterns for a role, company size, and industry. Use this to understand reporting relationships and role equivalence.',
        parameters: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              description: 'The job title or role (e.g., "CEO", "VP Operations", "EA to MD")',
            },
            companySize: {
              type: 'object',
              description: 'Company size range with min and max employee count',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
            },
            industry: {
              type: 'string',
              description: 'The industry the company operates in',
            },
          },
          required: ['role', 'companySize', 'industry'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_location_clusters',
        description:
          'Get nearby industrial clusters and fallback locations for a given location. Use this for location fallback strategies when primary location has no candidates.',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The primary location (e.g., "Mt Abu", "Surat")',
            },
            industry: {
              type: 'string',
              description: 'The industry context (optional, helps identify relevant clusters)',
            },
          },
          required: ['location'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_competitor_tiers',
        description:
          'Get competitor tier classifications (Tier 1, Tier 2, Tier 3) for companies in an industry. Use this to prioritize exact competitors in search.',
        parameters: {
          type: 'object',
          properties: {
            industry: {
              type: 'string',
              description: 'The industry to get competitor tiers for',
            },
            companyType: {
              type: 'string',
              description: 'Company type (e.g., "manufacturing", "services")',
            },
          },
          required: ['industry'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_similar_successful_searches',
        description:
          'Find similar past searches that were successful. Use this to learn from previous search patterns and apply successful strategies.',
        parameters: {
          type: 'object',
          properties: {
            primaryRole: {
              type: 'string',
              description: 'The primary role being searched for',
            },
            industry: {
              type: 'array',
              items: { type: 'string' },
              description: 'Industries mentioned in the query',
            },
            location: {
              type: 'string',
              description: 'Primary location from the query',
            },
            seniorityLevel: {
              type: 'string',
              description: 'Seniority level (entry, mid, senior, executive, c_level)',
            },
          },
          required: ['primaryRole'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_role_equivalence',
        description:
          'Get role equivalence mapping between different company sizes. Use this to understand that "VP in 1000-person company" ≈ "Director in 100-person company".',
        parameters: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              description: 'The role to find equivalents for',
            },
            sourceCompanySize: {
              type: 'object',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
              description: 'Source company size range',
            },
            targetCompanySize: {
              type: 'object',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
              description: 'Target company size range',
            },
            industry: {
              type: 'string',
              description: 'Industry context',
            },
          },
          required: ['role', 'sourceCompanySize', 'targetCompanySize', 'industry'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_reporting_structure',
        description:
          'Get reporting structure information for a role in a company of given size and industry. Use this to understand who reports to whom.',
        parameters: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              description: 'The role to get reporting structure for',
            },
            companySize: {
              type: 'object',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
            },
            industry: {
              type: 'string',
              description: 'Industry context',
            },
          },
          required: ['role', 'companySize', 'industry'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_org_structure_match',
        description:
          'Analyze if a candidate profile matches target organizational structure requirements. Use this for executive search validation.',
        parameters: {
          type: 'object',
          properties: {
            candidateRole: {
              type: 'string',
              description: "Candidate's current role",
            },
            candidateCompanySize: {
              type: 'object',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
            },
            targetRole: {
              type: 'string',
              description: 'Target role being searched for',
            },
            targetCompanySize: {
              type: 'object',
              properties: {
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
              },
            },
            industry: {
              type: 'string',
              description: 'Industry context',
            },
          },
          required: [
            'candidateRole',
            'candidateCompanySize',
            'targetRole',
            'targetCompanySize',
            'industry',
          ],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'classify_company_culture',
        description:
          'Classify a company by culture type. Use this to match candidates from similar company cultures.',
        parameters: {
          type: 'object',
          properties: {
            companyName: {
              type: 'string',
              description: 'Company name to classify',
            },
            industry: {
              type: 'string',
              description: 'Industry context',
            },
            context: {
              type: 'string',
              description:
                'Additional context about the company (e.g., "promoter-driven", "family-run")',
            },
          },
          required: ['companyName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'find_similar_culture_companies',
        description:
          'Find companies with similar culture type. Use this to expand search to similar company cultures.',
        parameters: {
          type: 'object',
          properties: {
            cultureType: {
              type: 'string',
              description:
                'Culture type (promoter_driven, family_run, mnc, startup, psu, pe_backed, listed)',
            },
            industry: {
              type: 'string',
              description: 'Industry to search within',
            },
            location: {
              type: 'string',
              description: 'Location context (optional)',
            },
          },
          required: ['cultureType', 'industry'],
        },
      },
    },
  ];
}

/**
 * Execute a tool function by name
 */
export async function executeKnowledgeTool(
  toolName: string,
  args: any,
  context: ToolContext,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_recruiting_knowledge':
        return await getRecruitingKnowledge(args.topic, args.context);

      case 'get_company_culture':
        return await getCompanyCulture(
          context.companyCulture,
          args.companyName,
          args.industry,
          args.context,
          context.apiToken,
        );

      case 'get_org_structure_pattern':
        return await getOrgStructurePattern(
          context.orgChartMapping,
          args.role,
          args.companySize,
          args.industry,
        );

      case 'get_location_clusters':
        return await getLocationClusters(
          context.locationCluster,
          args.location,
          args.industry,
          context.apiToken,
        );

      case 'get_competitor_tiers':
        return await getCompetitorTiers(
          context.competitorClassification,
          args.industry,
          args.companyType,
          context.apiToken,
        );

      case 'get_similar_successful_searches':
        return await getSimilarSuccessfulSearches(
          context.knowledgeBase,
          args.primaryRole,
          args.industry,
          args.location,
          args.seniorityLevel,
        );

      case 'get_role_equivalence':
        return await getRoleEquivalence(
          context.orgChartMapping,
          args.role,
          args.sourceCompanySize,
          args.targetCompanySize,
          args.industry,
        );

      case 'get_reporting_structure':
        return await getReportingStructure(
          context.orgChartMapping,
          args.role,
          args.companySize,
          args.industry,
        );

      case 'analyze_org_structure_match':
        return await analyzeOrgStructureMatch(
          context.orgChartMapping,
          args.candidateRole,
          args.candidateCompanySize,
          args.targetRole,
          args.targetCompanySize,
          args.industry,
        );

      case 'classify_company_culture':
        return await classifyCompanyCulture(
          context.companyCulture,
          args.companyName,
          args.industry,
          args.context,
          context.apiToken,
        );

      case 'find_similar_culture_companies':
        return await findSimilarCultureCompanies(
          context.companyCulture,
          args.cultureType,
          args.industry,
          args.location,
        );

      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
        });
    }
  } catch (error) {
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Tool implementation functions

async function getRecruitingKnowledge(
  topic: string,
  context?: string,
): Promise<string> {
  // This would contain recruiting domain knowledge
  // For now, return structured knowledge based on topic
  const knowledgeBase: Record<string, string> = {
    'org structure fitment':
      'Structure is strategy. Clients want candidates from aligned positions in org charts of similar companies. Role equivalence depends on company size: VP in 10K+ company manages entire assets, while VP in 1K company is like C-suite. Executive Director in ONGC (10K+) manages oil fields, while ED in 1K company is like CEO. Job titles vary by company size and industry. Service companies like Accenture use "Managing Director" for P&L heads, while manufacturing uses "MD" for CEO role. Always consider company size when matching roles.',
    'location fallback strategies':
      'For remote locations (tier 2/3 towns), identify nearby industrial clusters. Example: Mt Abu has no candidates, so try Rajasthan → Gujarat (industrial clusters). Candidates from nearby clusters are more likely to relocate. For tier 2/3 locations, prioritize candidates from nearby large cities or industrial hubs.',
    'executive search patterns':
      'Executive searches require org chart mapping. For "EA to MD", look for EAs/PAs of other promoters in similar companies. For CEO searches, consider COO, Head of Operations as alternatives. Site heads of large companies can be CEOs for smaller companies. Always consider company culture match: promoter-driven companies prefer candidates from other promoter-driven companies.',
    'company culture matching':
      'Promoter-driven companies prefer candidates from other promoter-driven or family-run businesses. MNC candidates may not fit in small promoter-owned companies. Family-run businesses often want candidates from other family-run businesses. Consider cultural fitment when matching candidates.',
    'role equivalence':
      'Role equivalence by company size: VP in 1000-person company ≈ Director in 100-person company. Executive Director in 10K+ company ≈ CEO in 1K company. Plant Manager in large MNC ≈ GM Operations in smaller company. Always map roles based on company size and organizational structure.',
  };

  const knowledge = knowledgeBase[topic.toLowerCase()] || `Knowledge about ${topic} is not available in the knowledge base.`;
  return JSON.stringify({
    topic,
    knowledge,
    context: context || null,
  });
}

async function getCompanyCulture(
  service: CompanyCultureService,
  companyName: string,
  industry?: string,
  context?: string,
  apiToken?: string,
): Promise<string> {
  const culture = await service.classifyCompanyCulture(companyName, industry, context, apiToken);
  return JSON.stringify(culture);
}

async function getOrgStructurePattern(
  service: OrgChartMappingService,
  role: string,
  companySize: { min?: number; max?: number },
  industry: string,
): Promise<string> {
  const patterns = await service.getOrgStructurePattern(role, companySize, industry);
  return JSON.stringify({ patterns: patterns.map(p => ({
    reportingTo: p.reportingTo,
    manages: p.manages,
    level: p.level,
    equivalentRoles: p.equivalentRoles,
    companySizeContext: p.companySizeContext,
  })) });
}

async function getLocationClusters(
  service: LocationClusterService,
  location: string,
  industry?: string,
  apiToken?: string,
): Promise<string> {
  const clusters = await service.getLocationClusters(location, industry, apiToken);
  return JSON.stringify(clusters);
}

async function getCompetitorTiers(
  service: CompetitorClassificationService,
  industry: string,
  companyType?: string,
  apiToken?: string,
): Promise<string> {
  const tiers = await service.getCompetitorTiers(industry, companyType, apiToken);
  return JSON.stringify(tiers);
}

async function getSimilarSuccessfulSearches(
  service: KnowledgeBaseService,
  primaryRole: string,
  industry?: string[],
  location?: string,
  seniorityLevel?: string,
): Promise<string> {
  const queryUnderstanding: QueryUnderstanding = {
    primaryRole,
    roleVariations: [],
    industry: industry || null,
    locationHierarchy: {
      primary: location || '',
      secondary: null,
      regional: null,
    },
    seniorityLevel: (seniorityLevel as any) || null,
    explicitRequirements: [],
    preferredRequirements: [],
    needsClarification: false,
  };

  const similar = service.findSimilarSearches(queryUnderstanding, 5);
  return JSON.stringify({
    similarSearches: similar.map((s) => ({
      queryHash: s.queryHash,
      primaryRole: s.queryUnderstanding.primaryRole,
      successfulStrategies: s.strategyResults
        .filter((sr) => sr.successRate > 0.7)
        .map((sr) => ({
          strategyLabel: sr.strategyLabel,
          successRate: sr.successRate,
        })),
      timestamp: s.timestamp,
    })),
  });
}

async function getRoleEquivalence(
  service: OrgChartMappingService,
  role: string,
  sourceCompanySize: { min?: number; max?: number },
  targetCompanySize: { min?: number; max?: number },
  industry: string,
): Promise<string> {
  const equivalence = await service.mapRoleEquivalence(
    role,
    sourceCompanySize,
    targetCompanySize,
    industry,
  );
  return JSON.stringify(equivalence);
}

async function getReportingStructure(
  service: OrgChartMappingService,
  role: string,
  companySize: { min?: number; max?: number },
  industry: string,
): Promise<string> {
  const structure = await service.getReportingLevel(role, companySize, industry);
  return JSON.stringify(structure);
}

async function analyzeOrgStructureMatch(
  service: OrgChartMappingService,
  candidateRole: string,
  candidateCompanySize: { min?: number; max?: number },
  targetRole: string,
  targetCompanySize: { min?: number; max?: number },
  industry: string,
): Promise<string> {
  const match = await service.findOrgStructureMatches(
    {
      role: candidateRole,
      companySize: candidateCompanySize,
    },
    {
      role: targetRole,
      companySize: targetCompanySize,
      industry,
    },
  );
  return JSON.stringify(match);
}

async function classifyCompanyCulture(
  service: CompanyCultureService,
  companyName: string,
  industry?: string,
  context?: string,
  apiToken?: string,
): Promise<string> {
  const culture = await service.classifyCompanyCulture(companyName, industry, context, apiToken);
  return JSON.stringify(culture);
}

async function findSimilarCultureCompanies(
  service: CompanyCultureService,
  cultureType: string,
  industry: string,
  location?: string,
): Promise<string> {
  const companies = await service.findSimilarCultureCompanies(
    cultureType as any,
    industry,
    location,
  );
  return JSON.stringify({ companies });
}

