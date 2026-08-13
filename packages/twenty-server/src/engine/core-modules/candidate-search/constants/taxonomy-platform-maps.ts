import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

const normalizeTaxonomyLabel = (value: string | null | undefined): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

// LinkedIn Sales Nav function facet IDs (shared by Unipile + Harvest).
// Seeded from battle-tested Harvest IDs; remaining roots mapped to closest SN function.
export const SALES_NAV_FUNCTION_ROOT_TO_IDS: Record<string, string> = {
  accounting: '1',
  administrative: '2',
  secretarial: '2',
  design: '3',
  'arts and design': '3',
  'business development': '4',
  partnerships: '4',
  consulting: '6',
  education: '9',
  engineering: '8',
  entrepreneurship: '9',
  finance: '10',
  banking: '10',
  trading: '10',
  healthcare: '11',
  'human resources': '12',
  technology: '13',
  'information technology': '13',
  legal: '14',
  marketing: '15',
  operations: '18',
  'supply chain': '21',
  product: '19',
  'product management': '19',
  projects: '20',
  'program and project management': '20',
  'real estate': '23',
  research: '24',
  sales: '25',
  'support service': '26',
  'customer success and support': '26',
  customerservice: '26',
  corporate: '18',
  government: '5',
  aviation: '18',
  events: '15',
};

// std grade level / category → Sales Nav seniority enums
export const SALES_NAV_GRADE_TO_SENIORITIES: Record<
  string,
  LinkedInSeniorityType[]
> = {
  leadership: [
    'owner/partner',
    'cxo',
    'vice_president',
    'director',
    'experienced_manager',
  ],
  ceo: ['owner/partner', 'cxo'],
  senior: ['vice_president', 'director', 'experienced_manager', 'strategic'],
  mid: [
    'experienced_manager',
    'entry_level_manager',
    'strategic',
    'senior',
  ],
  entry: ['entry_level', 'in_training', 'senior'],
  intern: ['in_training'],
};

// Apollo person_seniorities values
export type ApolloPersonSeniority =
  | 'owner'
  | 'founder'
  | 'c_suite'
  | 'partner'
  | 'vp'
  | 'head'
  | 'director'
  | 'manager'
  | 'senior'
  | 'entry'
  | 'intern';

export const APOLLO_GRADE_TO_SENIORITIES: Record<
  string,
  ApolloPersonSeniority[]
> = {
  leadership: [
    'owner',
    'founder',
    'c_suite',
    'partner',
    'vp',
    'head',
    'director',
  ],
  ceo: ['owner', 'founder', 'c_suite', 'partner'],
  senior: ['vp', 'head', 'director'],
  mid: ['manager', 'senior', 'head'],
  entry: ['entry', 'intern', 'senior'],
  intern: ['intern'],
};

// Apollo master_* department for function-root searches
export const APOLLO_FUNCTION_ROOT_TO_MASTER: Record<string, string> = {
  engineering: 'master_engineering_technical',
  technology: 'master_information_technology',
  'information technology': 'master_information_technology',
  product: 'master_product',
  'product management': 'master_product',
  design: 'master_design',
  education: 'master_education',
  finance: 'master_finance',
  banking: 'master_finance',
  trading: 'master_finance',
  'human resources': 'master_human_resources',
  legal: 'master_legal',
  marketing: 'master_marketing',
  healthcare: 'master_medical_health',
  operations: 'master_operations',
  'supply chain': 'master_operations',
  corporate: 'master_operations',
  aviation: 'master_operations',
  sales: 'master_sales',
  'business development': 'master_sales',
  partnerships: 'master_sales',
  consulting: 'master_consulting',
  'support service': 'master_sales',
  research: 'master_engineering_technical',
  projects: 'master_engineering_technical',
  administrative: 'master_operations',
  secretarial: 'master_operations',
  'real estate': 'master_operations',
  government: 'master_operations',
  events: 'master_marketing',
  accounting: 'master_finance',
};

// Leaf Apollo department/subdepartment slugs keyed by std function (normalized)
export const APOLLO_STD_FUNCTION_TO_DEPARTMENTS: Record<string, string[]> = {
  // Human Resources
  'human resources': [
    'culture_diversity_inclusion',
    'employee_labor_relations',
    'health_safety',
    'human_resource_information_system',
    'human_resources',
    'hr_business_partner',
    'learning_development',
    'organizational_development',
    'recruiting_talent_acquisition',
    'talent_management',
    'workforce_mangement',
    'people_operations',
  ],
  'hr business partner': ['hr_business_partner'],
  recruiting: ['recruiting_talent_acquisition'],
  'talent acquisition': ['recruiting_talent_acquisition'],
  'learning and development': ['learning_development'],
  'people operations': ['people_operations'],
  // Engineering & Technical
  engineering: ['engineering_technical', 'software_development'],
  'software development': ['software_development'],
  'software engineering': ['software_development'],
  'data science': ['data_science'],
  devops: ['devops'],
  'artificial intelligence': ['artificial_intelligence_machine_learning'],
  'machine learning': ['artificial_intelligence_machine_learning'],
  'quality assurance': ['test_quality_assurance'],
  'ui / ux': ['ui_ux'],
  'web development': ['web_development'],
  // Information Technology
  'information technology': ['information_technology'],
  it: ['information_technology'],
  infrastructure: ['infrastructure'],
  'information security': ['information_security'],
  // Product
  product: ['product_management', 'product_development'],
  'product management': ['product_management'],
  'product development': ['product_development'],
  // Design
  design: ['all_design'],
  'product design': ['product_or_ui_ux_design'],
  'ui/ux design': ['product_or_ui_ux_design'],
  // Finance
  finance: ['finance'],
  accounting: ['accounting'],
  'financial planning': ['financial_planning_analysis'],
  treasury: ['treasury'],
  tax: ['tax'],
  // Marketing
  marketing: ['marketing'],
  'product marketing': ['product_marketing'],
  'digital marketing': ['digital_marketing'],
  'content marketing': ['content_marketing'],
  // Sales
  sales: ['sales'],
  'business development': ['business_development'],
  'account management': ['account_management'],
  'customer success': ['customer_success'],
  // Legal
  legal: ['legal'],
  'legal counsel': ['legal_counsel'],
  compliance: ['compliance'],
  // Operations
  operations: ['operations'],
  'supply chain': ['supply_chain'],
  logistics: ['logistics'],
  // Consulting
  consulting: ['consultant'],
  consultant: ['consultant'],
  // Education
  education: ['teacher', 'professor'],
  teacher: ['teacher'],
  professor: ['professor'],
  // Medical
  healthcare: ['medicine', 'medical_administration'],
  nursing: ['nursing'],
  // C-Suite leaves
  executive: ['executive'],
  founder: ['founder'],
  'sales leader': ['sales_leader'],
};

export type ResolvePlatformFiltersInput = {
  functionRoot?: string | null;
  stdFunction?: string | null;
  stdGrade?: string | null;
};

export type SalesNavResolvedFilters = {
  functionIds: string[];
  seniorities: LinkedInSeniorityType[];
};

export type ApolloResolvedFilters = {
  person_department_or_subdepartments: string[];
  person_seniorities: ApolloPersonSeniority[];
};

const normalizeRootKey = (value: string): string =>
  normalizeTaxonomyLabel(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compactRootKey = (value: string): string =>
  normalizeRootKey(value).replace(/\s+/g, '');

export const resolveSalesNavFunctionIdsForRoot = (
  functionRoot?: string | null,
): string | undefined => {
  const normalized = normalizeRootKey(functionRoot ?? '');
  if (!normalized || normalized === 'fullcompany') {
    return undefined;
  }

  const compact = compactRootKey(normalized);
  const direct =
    SALES_NAV_FUNCTION_ROOT_TO_IDS[normalized] ??
    SALES_NAV_FUNCTION_ROOT_TO_IDS[compact];

  if (direct) {
    return direct;
  }

  for (const [key, functionId] of Object.entries(SALES_NAV_FUNCTION_ROOT_TO_IDS)) {
    if (compactRootKey(key) === compact) {
      return functionId;
    }
  }

  return undefined;
};

export const resolveSalesNavFilters = (
  input: ResolvePlatformFiltersInput,
): SalesNavResolvedFilters => {
  const functionIds: string[] = [];
  const rootId = resolveSalesNavFunctionIdsForRoot(
    input.functionRoot ?? input.stdFunction,
  );
  if (rootId) {
    functionIds.push(rootId);
  }

  const gradeKey = normalizeRootKey(input.stdGrade ?? '');
  const seniorities =
    (gradeKey ? SALES_NAV_GRADE_TO_SENIORITIES[gradeKey] : undefined) ?? [];

  return {
    functionIds,
    seniorities: [...seniorities],
  };
};

export const resolveApolloFilters = (
  input: ResolvePlatformFiltersInput,
): ApolloResolvedFilters => {
  const departments: string[] = [];
  const stdFunction = normalizeRootKey(input.stdFunction ?? '');
  const functionRoot = normalizeRootKey(input.functionRoot ?? '');

  if (stdFunction) {
    const leaf =
      APOLLO_STD_FUNCTION_TO_DEPARTMENTS[stdFunction] ??
      APOLLO_STD_FUNCTION_TO_DEPARTMENTS[compactRootKey(stdFunction)];
    if (leaf?.length) {
      departments.push(...leaf);
    }
  }

  if (departments.length === 0 && functionRoot) {
    const master =
      APOLLO_FUNCTION_ROOT_TO_MASTER[functionRoot] ??
      APOLLO_FUNCTION_ROOT_TO_MASTER[compactRootKey(functionRoot)];
    if (master) {
      departments.push(master);
    } else {
      // Fallback: expand known leaf lists when master is missing
      const leafFallback =
        APOLLO_STD_FUNCTION_TO_DEPARTMENTS[functionRoot] ??
        APOLLO_STD_FUNCTION_TO_DEPARTMENTS[compactRootKey(functionRoot)];
      if (leafFallback?.length) {
        departments.push(...leafFallback);
      }
    }
  }

  const gradeKey = normalizeRootKey(input.stdGrade ?? '');
  const seniorities =
    (gradeKey ? APOLLO_GRADE_TO_SENIORITIES[gradeKey] : undefined) ?? [];

  return {
    person_department_or_subdepartments: [...new Set(departments)],
    person_seniorities: [...seniorities],
  };
};
