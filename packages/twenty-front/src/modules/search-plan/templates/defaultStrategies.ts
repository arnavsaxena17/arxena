import { StrategyTemplate } from '../types/SearchStrategy';

export const DEFAULT_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'broad-search',
    name: 'Broad Search Strategy',
    description: 'Minimal filtering with maximum enrichments for comprehensive candidate discovery',
    tree: {
      treeVersion: '1.0',
      rootNodeId: 'root_1',
      nodes: {
        root_1: {
          id: 'root_1',
          name: 'Search Strategy Decider',
          prompt: 'Analyze the job description and determine the optimal search strategy. Job Title: {jobTitle}, Company: {company}, Industry: {industry}',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'company', 'industry'],
          outputSchema: [
            { name: 'strategy', type: 'string', description: 'Recommended search strategy' },
            { name: 'focus', type: 'string', description: 'Primary focus area' }
          ],
          outputDestination: 'intermediate',
          children: ['search_param_1', 'enrichment_1', 'filter_1']
        },
        search_param_1: {
          id: 'search_param_1',
          name: 'LinkedIn Search Parameters Generator',
          prompt: 'Generate comprehensive LinkedIn search parameters for broad search. Focus on: {focus}. Job Title: {jobTitle}, Company: {company}, Industry: {industry}',
          model: 'gpt-4o-mini',
          inputSources: ['focus', 'jobTitle', 'company', 'industry'],
          outputSchema: [
            { name: 'keywords', type: 'string', description: 'Primary search keywords' },
            { name: 'industry', type: 'array<string>', description: 'Industry filters' },
            { name: 'location', type: 'array<string>', description: 'Location filters' },
            { name: 'company', type: 'array<string>', description: 'Company filters' },
            { name: 'network_distance', type: 'array<number>', description: 'Network distance filters' },
            { name: 'seniority', type: 'array<string>', description: 'Seniority level filters' },
            { name: 'function', type: 'array<string>', description: 'Function/department filters' },
            { name: 'searchType', type: 'string', description: 'LinkedIn search type (classic/sales_navigator/recruiter)' },
            { name: 'searchCategory', type: 'string', description: 'Search category (people/companies/jobs/posts)' }
          ],
          outputDestination: 'searchParameters',
          children: [],
          parent: 'root_1',
          searchType: 'classic',
          searchCategory: 'people'
        },
        enrichment_1: {
          id: 'enrichment_1',
          name: 'Skills Assessment',
          prompt: 'Assess candidate technical skills and experience level',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'technicalSkills', type: 'array<string>', description: 'Technical skills found' },
            { name: 'experienceLevel', type: 'string', description: 'Experience level assessment' }
          ],
          outputDestination: 'enrichments',
          children: [],
          parent: 'root_1'
        },
        filter_1: {
          id: 'filter_1',
          name: 'Basic Filter',
          prompt: 'Apply basic location and industry filters',
          model: 'gpt-4o-mini',
          inputSources: ['location', 'industry'],
          outputSchema: [
            { name: 'locationFilter', type: 'string', description: 'Location filter value' },
            { name: 'industryFilter', type: 'string', description: 'Industry filter value' }
          ],
          outputDestination: 'filters',
          children: [],
          parent: 'root_1'
        }
      },
      edges: [
        { from: 'root_1', to: 'search_param_1' },
        { from: 'root_1', to: 'enrichment_1' },
        { from: 'root_1', to: 'filter_1' }
      ]
    }
  },
  {
    id: 'narrow-search',
    name: 'Narrow Search Strategy',
    description: 'Precise parameters with minimal enrichments for targeted candidate discovery',
    tree: {
      treeVersion: '1.0',
      rootNodeId: 'root_2',
      nodes: {
        root_2: {
          id: 'root_2',
          name: 'Precision Search Decider',
          prompt: 'Analyze job requirements for precise targeting. Job Title: {jobTitle}, Required Skills: {requiredSkills}',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'targetKeywords', type: 'array<string>', description: 'Targeted keywords' },
            { name: 'seniority', type: 'string', description: 'Required seniority level' }
          ],
          outputDestination: 'intermediate',
          children: ['search_param_2', 'filter_2']
        },
        search_param_2: {
          id: 'search_param_2',
          name: 'Sales Navigator Parameters',
          prompt: 'Generate precise Sales Navigator search parameters. Target: {targetKeywords}, Seniority: {seniority}',
          model: 'gpt-4o-mini',
          inputSources: ['targetKeywords', 'seniority'],
          outputSchema: [
            { name: 'keywords', type: 'string', description: 'Precise search keywords' },
            { name: 'industry_include', type: 'array<string>', description: 'Industries to include' },
            { name: 'industry_exclude', type: 'array<string>', description: 'Industries to exclude' },
            { name: 'location_include', type: 'array<string>', description: 'Locations to include' },
            { name: 'location_exclude', type: 'array<string>', description: 'Locations to exclude' },
            { name: 'company_include', type: 'array<string>', description: 'Companies to include' },
            { name: 'company_exclude', type: 'array<string>', description: 'Companies to exclude' },
            { name: 'seniority_include', type: 'array<string>', description: 'Seniority levels to include' },
            { name: 'seniority_exclude', type: 'array<string>', description: 'Seniority levels to exclude' },
            { name: 'function_include', type: 'array<string>', description: 'Functions to include' },
            { name: 'function_exclude', type: 'array<string>', description: 'Functions to exclude' },
            { name: 'company_headcount', type: 'array<object>', description: 'Company headcount ranges' },
            { name: 'tenure', type: 'array<object>', description: 'Tenure ranges' },
            { name: 'network_distance_sales', type: 'array<string>', description: 'Network distance filters' },
            { name: 'searchType', type: 'string', description: 'LinkedIn search type' },
            { name: 'searchCategory', type: 'string', description: 'Search category' }
          ],
          outputDestination: 'searchParameters',
          children: [],
          parent: 'root_2',
          searchType: 'sales_navigator',
          searchCategory: 'people'
        },
        filter_2: {
          id: 'filter_2',
          name: 'Seniority Filter',
          prompt: 'Apply seniority and experience filters',
          model: 'gpt-4o-mini',
          inputSources: ['seniority'],
          outputSchema: [
            { name: 'seniorityFilter', type: 'string', description: 'Seniority filter' },
            { name: 'experienceFilter', type: 'string', description: 'Experience range filter' }
          ],
          outputDestination: 'filters',
          children: [],
          parent: 'root_2'
        }
      },
      edges: [
        { from: 'root_2', to: 'search_param_2' },
        { from: 'root_2', to: 'filter_2' }
      ]
    }
  },
  {
    id: 'executive-search',
    name: 'Executive Search Strategy',
    description: 'Senior level focus with leadership enrichments for executive positions',
    tree: {
      treeVersion: '1.0',
      rootNodeId: 'root_3',
      nodes: {
        root_3: {
          id: 'root_3',
          name: 'Executive Search Decider',
          prompt: 'Analyze executive job requirements. Job Title: {jobTitle}, Company: {company}, Industry: {industry}',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'company', 'industry'],
          outputSchema: [
            { name: 'leadershipKeywords', type: 'array<string>', description: 'Leadership-focused keywords' },
            { name: 'executiveLevel', type: 'string', description: 'Executive level assessment' }
          ],
          outputDestination: 'intermediate',
          children: ['search_param_3', 'enrichment_3', 'filter_3']
        },
        search_param_3: {
          id: 'search_param_3',
          name: 'LinkedIn Recruiter Parameters',
          prompt: 'Generate executive-level LinkedIn Recruiter search parameters. Leadership: {leadershipKeywords}, Level: {executiveLevel}',
          model: 'gpt-4o-mini',
          inputSources: ['leadershipKeywords', 'executiveLevel'],
          outputSchema: [
            { name: 'keywords', type: 'string', description: 'Executive search keywords' },
            { name: 'role_recruiter', type: 'array<object>', description: 'Role filters with priority levels' },
            { name: 'skills_recruiter', type: 'array<object>', description: 'Skills filters with priority levels' },
            { name: 'company_recruiter', type: 'array<object>', description: 'Company filters with priority levels' },
            { name: 'seniority_recruiter_include', type: 'array<string>', description: 'Executive seniority levels to include' },
            { name: 'seniority_recruiter_exclude', type: 'array<string>', description: 'Seniority levels to exclude' },
            { name: 'company_headcount_recruiter', type: 'array<object>', description: 'Company headcount ranges' },
            { name: 'tenure_recruiter', type: 'object', description: 'Tenure requirements' },
            { name: 'network_distance_recruiter', type: 'array<string>', description: 'Network distance filters' },
            { name: 'spotlights', type: 'array<string>', description: 'LinkedIn Recruiter spotlights' },
            { name: 'recruiting_activity', type: 'array<object>', description: 'Recruiting activity filters' },
            { name: 'searchType', type: 'string', description: 'LinkedIn search type' },
            { name: 'searchCategory', type: 'string', description: 'Search category' }
          ],
          outputDestination: 'searchParameters',
          children: [],
          parent: 'root_3',
          searchType: 'recruiter',
          searchCategory: 'people'
        },
        enrichment_3: {
          id: 'enrichment_3',
          name: 'Leadership Assessment',
          prompt: 'Assess leadership experience and executive qualities',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'leadershipExperience', type: 'string', description: 'Leadership experience assessment' },
            { name: 'teamSize', type: 'string', description: 'Team size managed' },
            { name: 'executivePresence', type: 'string', description: 'Executive presence score' }
          ],
          outputDestination: 'enrichments',
          children: [],
          parent: 'root_3'
        },
        filter_3: {
          id: 'filter_3',
          name: 'Executive Filters',
          prompt: 'Apply executive-level filters',
          model: 'gpt-4o-mini',
          inputSources: ['executiveLevel'],
          outputSchema: [
            { name: 'seniorityFilter', type: 'string', description: 'Seniority filter (VP+)' },
            { name: 'experienceFilter', type: 'string', description: 'Experience filter (10+ years)' }
          ],
          outputDestination: 'filters',
          children: [],
          parent: 'root_3'
        }
      },
      edges: [
        { from: 'root_3', to: 'search_param_3' },
        { from: 'root_3', to: 'enrichment_3' },
        { from: 'root_3', to: 'filter_3' }
      ]
    }
  },
  {
    id: 'tech-hiring',
    name: 'Tech Hiring Strategy',
    description: 'Skills-focused with technical enrichments for technology positions',
    tree: {
      treeVersion: '1.0',
      rootNodeId: 'root_4',
      nodes: {
        root_4: {
          id: 'root_4',
          name: 'Tech Hiring Decider',
          prompt: 'Analyze technical job requirements. Job Title: {jobTitle}, Required Skills: {requiredSkills}',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'techKeywords', type: 'array<string>', description: 'Technology-focused keywords' },
            { name: 'techLevel', type: 'string', description: 'Technical level assessment' }
          ],
          outputDestination: 'intermediate',
          children: ['search_param_4', 'enrichment_4', 'filter_4']
        },
        search_param_4: {
          id: 'search_param_4',
          name: 'Tech Keywords',
          prompt: 'Generate technical search keywords. Tech: {techKeywords}, Level: {techLevel}',
          model: 'gpt-4o-mini',
          inputSources: ['techKeywords', 'techLevel'],
          outputSchema: [
            { name: 'keywords', type: 'array<string>', description: 'Technical search keywords' },
            { name: 'skillFilters', type: 'array<string>', description: 'Technical skill filters' }
          ],
          outputDestination: 'searchParameters',
          children: [],
          parent: 'root_4'
        },
        enrichment_4: {
          id: 'enrichment_4',
          name: 'Technical Skills Assessment',
          prompt: 'Assess technical skills and coding experience',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'programmingLanguages', type: 'array<string>', description: 'Programming languages known' },
            { name: 'frameworks', type: 'array<string>', description: 'Frameworks and tools' },
            { name: 'techExperience', type: 'string', description: 'Technical experience level' }
          ],
          outputDestination: 'enrichments',
          children: [],
          parent: 'root_4'
        },
        filter_4: {
          id: 'filter_4',
          name: 'Tech Filters',
          prompt: 'Apply technical skill filters',
          model: 'gpt-4o-mini',
          inputSources: ['techLevel'],
          outputSchema: [
            { name: 'skillFilter', type: 'string', description: 'Technical skill filter' },
            { name: 'experienceFilter', type: 'string', description: 'Tech experience filter' }
          ],
          outputDestination: 'filters',
          children: [],
          parent: 'root_4'
        }
      },
      edges: [
        { from: 'root_4', to: 'search_param_4' },
        { from: 'root_4', to: 'enrichment_4' },
        { from: 'root_4', to: 'filter_4' }
      ]
    }
  },
  {
    id: 'sales-hiring',
    name: 'Sales Hiring Strategy',
    description: 'Industry + quota-carrying experience focus for sales positions',
    tree: {
      treeVersion: '1.0',
      rootNodeId: 'root_5',
      nodes: {
        root_5: {
          id: 'root_5',
          name: 'Sales Hiring Decider',
          prompt: 'Analyze sales job requirements. Job Title: {jobTitle}, Industry: {industry}',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'industry'],
          outputSchema: [
            { name: 'salesKeywords', type: 'array<string>', description: 'Sales-focused keywords' },
            { name: 'salesLevel', type: 'string', description: 'Sales level assessment' }
          ],
          outputDestination: 'intermediate',
          children: ['search_param_5', 'enrichment_5', 'filter_5']
        },
        search_param_5: {
          id: 'search_param_5',
          name: 'Sales Keywords',
          prompt: 'Generate sales search keywords. Sales: {salesKeywords}, Level: {salesLevel}',
          model: 'gpt-4o-mini',
          inputSources: ['salesKeywords', 'salesLevel'],
          outputSchema: [
            { name: 'keywords', type: 'array<string>', description: 'Sales search keywords' },
            { name: 'titleFilters', type: 'array<string>', description: 'Sales title filters' }
          ],
          outputDestination: 'searchParameters',
          children: [],
          parent: 'root_5'
        },
        enrichment_5: {
          id: 'enrichment_5',
          name: 'Sales Performance Assessment',
          prompt: 'Assess sales performance and quota achievement',
          model: 'gpt-4o-mini',
          inputSources: ['jobTitle', 'requiredSkills'],
          outputSchema: [
            { name: 'quotaExperience', type: 'string', description: 'Quota-carrying experience' },
            { name: 'salesPerformance', type: 'string', description: 'Sales performance assessment' },
            { name: 'industryExperience', type: 'string', description: 'Industry-specific sales experience' }
          ],
          outputDestination: 'enrichments',
          children: [],
          parent: 'root_5'
        },
        filter_5: {
          id: 'filter_5',
          name: 'Sales Filters',
          prompt: 'Apply sales-specific filters',
          model: 'gpt-4o-mini',
          inputSources: ['salesLevel'],
          outputSchema: [
            { name: 'salesFilter', type: 'string', description: 'Sales experience filter' },
            { name: 'industryFilter', type: 'string', description: 'Industry experience filter' }
          ],
          outputDestination: 'filters',
          children: [],
          parent: 'root_5'
        }
      },
      edges: [
        { from: 'root_5', to: 'search_param_5' },
        { from: 'root_5', to: 'enrichment_5' },
        { from: 'root_5', to: 'filter_5' }
      ]
    }
  }
];
