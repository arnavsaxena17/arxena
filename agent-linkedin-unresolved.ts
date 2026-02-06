import fs from 'fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import path from 'path';
import { z } from 'zod';
import {
  classicPeopleSearchSchema,
} from './packages/twenty-server/src/engine/core-modules/candidate-search/schemas/linkedin-classic-people-search.schema';
import {
  recruiterPeopleSearchSchema,
} from './packages/twenty-server/src/engine/core-modules/candidate-search/schemas/linkedin-recruiter-people-search.schema';
import {
  salesNavigatorPeopleSearchSchema,
} from './packages/twenty-server/src/engine/core-modules/candidate-search/schemas/linkedin-sales-navigator-people-search.schema';
import {
  queryConstructorSchema,
  type QueryConstructorResult,
} from './packages/twenty-server/src/engine/core-modules/candidate-search/schemas/query-constructor.schema';
import {
  mapQueryConstructorToUnresolved,
} from './packages/twenty-server/src/engine/core-modules/candidate-search/utils/query-constructor-mapper.util';

type SearchType = 'classic' | 'sales_navigator' | 'recruiter';

const DEFAULT_REQUIREMENTS_FILE = path.join(process.cwd(), 'elaborate_requirements.txt');
const DEFAULT_COUNT = 6;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BOOLTREE_DIR = path.join(process.cwd(), 'tools', 'booltrees');
const TRUTH_TREE_PATH = path.join(BOOLTREE_DIR, 'final_names_truth_tree_25042022.json');
const GRADES_TREE_PATH = path.join(BOOLTREE_DIR, 'truth_tree_grades_13042023.json');

const headerRegex = /^[A-Z][A-Za-z\s&/]+$/;

type TruthTreeNode = {
  key?: number;
  name?: string;
  final_name?: string;
  and?: string;
  or?: string;
  not?: string;
  auto_entry?: string;
  auto_mid?: string;
  auto_leadership?: string;
  sum_count?: number;
};

type TruthTree = {
  class?: string;
  nodeDataArray?: TruthTreeNode[];
};

let cachedTruthTree: TruthTree | null = null;
let cachedGradesTree: TruthTree | null = null;

function isRequirementLine(line: string): boolean {
  if (!line) return false;
  if (line.length < 40) return false;
  if (headerRegex.test(line)) return false;
  if (!/[0-9]/.test(line)) return false;
  if (!/(years|under|days|L\b|Cr\b|ESOP)/i.test(line)) return false;
  return true;
}

function loadTruthTreeOnce(filePath: string): TruthTree {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as TruthTree;
}

function getTruthTree(): TruthTree {
  if (!cachedTruthTree) {
    cachedTruthTree = loadTruthTreeOnce(TRUTH_TREE_PATH);
  }
  return cachedTruthTree;
}

function getGradesTree(): TruthTree {
  if (!cachedGradesTree) {
    cachedGradesTree = loadTruthTreeOnce(GRADES_TREE_PATH);
  }
  return cachedGradesTree;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

function splitTerms(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function scoreTruthNode(tokens: Set<string>, node: TruthTreeNode): number {
  const andTerms = splitTerms(node.and);
  if (!andTerms.length) return 0;

  for (const t of andTerms) {
    if (!tokens.has(t)) return 0;
  }

  const notTerms = splitTerms(node.not);
  for (const t of notTerms) {
    if (tokens.has(t)) return 0;
  }

  const orTerms = splitTerms(node.or);
  let bonus = 0;
  if (orTerms.length) {
    bonus = orTerms.some((t) => tokens.has(t)) ? 1 : 0;
  }

  return andTerms.length + bonus;
}

function findTopTruthNodes(
  tokens: Set<string>,
  tree: TruthTree,
  limit: number,
): TruthTreeNode[] {
  const nodes = tree.nodeDataArray ?? [];
  const scored = nodes
    .map((node) => ({ node, score: scoreTruthNode(tokens, node) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.node);
}

 

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, 'true');
    }
  }

  const count = Number(args.get('count') ?? DEFAULT_COUNT);
  const file = args.get('file') ?? DEFAULT_REQUIREMENTS_FILE;
  const outFile = args.get('out');
  const searchType = args.get('searchType');
  const random = args.get('random') === 'true';
  const normalizedSearchType: SearchType | undefined =
    searchType === 'classic' || searchType === 'sales_navigator' || searchType === 'recruiter'
      ? searchType
      : undefined;

  return {
    count: Number.isFinite(count) && count > 0 ? count : DEFAULT_COUNT,
    file,
    outFile,
    searchType: normalizedSearchType,
    random,
  };
}

function loadRequirements(filePath: string, count: number, random: boolean): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const requirements = lines.filter(isRequirementLine);
  if (!random) {
    return requirements.slice(0, count);
  }

  const shuffled = requirements.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

const domainSchema = z.object({
  primary_domain: z.enum([
    'sales',
    'marketing',
    'hr',
    'finance',
    'legal',
    'operations',
    'supply_chain',
    'engineering',
    'product',
    'it_infra',
    'data_analytics',
    'customer_success',
    'general_management',
    'other',
  ]),
  secondary_domains: z.array(z.string()).max(3).nullable(),
  reasoning: z.string().nullable(),
});

const subdomainSchema = z.object({
  subdomains: z.array(z.string()).min(1).max(6),
  role_function: z.string(),
  reasoning: z.string().nullable(),
});

const gradeSchema = z.object({
  seniority_band: z.enum(['entry', 'mid', 'senior', 'leadership', 'cxo']),
  title_markers: z.array(z.string()).max(8).nullable(),
  reasoning: z.string().nullable(),
});

const AGENT_SYSTEM_PROMPT = `
You are a single recruiter-grade LinkedIn search agent.
Goal: maximize recall. Precision is secondary.
Generate multiple complementary searches to cover the candidate space.

RECRUITER MENTAL MODEL (how profiles are written):
1) JOB TITLE FIELD = HR/organization label (generic)
2) HEADLINE/KEYWORDS = how people want to be found (aspirational)
3) DESCRIPTION = what they actually do (detailed)

Search construction principles:
- Default to Keywords Primary unless the title is highly standardized.
- Job titles are organizational labels; keywords reflect real work.
- Company filters are only for explicit company targeting or strong industry/company-type constraints.
- Seniority splits improve recall without overlap.
- Expect title variance; include adjacent titles when in doubt.
- Treat any truth-tree hints as OPTIONAL guidance; do not over-filter.
- Prioritize recall: broaden titles and keywords to capture how profiles are written.
- If a truth-tree hint conflicts with the requirement, ignore the hint.

Output: Query Constructor JSON (linkedin_searches) that follows schema.

Key rules:
1) Create 3-6 searches unless the role is extremely narrow.
2) Use different strategies (role family split, seniority split, domain split, geography split).
3) Do NOT include salary, age, notice period, or "impossible" constraints.
4) Keep keywords and job_title concise; max 6 OR terms per parameter.
5) Prefer title variants in job_title; domain/skills in keywords.
6) Put locations only in the location field (not in keywords).
7) Only use company field when explicitly demanded (specific companies or company category).
8) Bias toward broader coverage: include synonyms and adjacent titles.
9) If requirement implies strict company/account targeting, prefer sales_navigator.
10) If requirement implies recruiter-grade specificity, prefer recruiter.
11) Otherwise use classic.
`;

function buildAgentUserPrompt(requirement: string, truthContext: string): string {
  return `
Requirement:
${requirement}

Instructions:
- Analyze the requirement like a recruiter.
- Use the truth-tree context below to improve recall and seniority splits.
- Fill parsed_requirement, title_analysis, company_analysis, and linkedin_searches.
- Each linkedin_searches entry must include linkedin_boolean_search { keywords, job_title, company, location }.
- Output should maximize recall with multiple searches.

${truthContext}
`;
}

const BOOLEAN_STYLE_GUIDE = [
  'Max 6 OR terms per parameter.',
  'Put locations in location field only.',
  'Keep keywords for function/domain; job_title for title variants.',
  'Avoid salary, notice period, and age constraints.',
  'Split by seniority bands when title patterns differ.',
  'Prefer recall; include adjacent titles and synonyms.',
];

function gradeTokensForBand(band: z.infer<typeof gradeSchema>['seniority_band']): string[] {
  switch (band) {
    case 'entry':
      return ['intern', 'trainee', 'associate', 'assistant', 'executive', 'officer', 'analyst'];
    case 'mid':
      return ['manager', 'lead', 'senior associate', 'assistant manager'];
    case 'senior':
      return ['senior manager', 'head', 'director', 'general manager', 'gm'];
    case 'leadership':
      return ['vp', 'svp', 'avp', 'president', 'chief', 'director', 'head'];
    case 'cxo':
      return ['ceo', 'cfo', 'cto', 'coo', 'cpo', 'ciso', 'chro', 'cmo', 'cdo'];
    default:
      return [];
  }
}

function selectTruthNodesByContext(
  requirement: string,
  subdomains: string[],
  gradeBand: z.infer<typeof gradeSchema>['seniority_band'],
): { roleNodes: TruthTreeNode[]; gradeNodes: TruthTreeNode[] } {
  const tokens = tokenize([requirement, ...subdomains].join(' '));
  const truthTree = getTruthTree();
  const gradesTree = getGradesTree();
  const roleNodes = findTopTruthNodes(tokens, truthTree, 10);

  const gradeTokenSet = new Set(gradeTokensForBand(gradeBand));
  const gradeNodes = findTopTruthNodes(gradeTokenSet, gradesTree, 8);

  return { roleNodes, gradeNodes };
}

function buildFocusedTruthContext(
  requirement: string,
  subdomains: string[],
  gradeBand: z.infer<typeof gradeSchema>['seniority_band'],
): string {
  const { roleNodes, gradeNodes } = selectTruthNodesByContext(
    requirement,
    subdomains,
    gradeBand,
  );

  const roleLines = roleNodes.map((node) => {
    const name = node.final_name || node.name || 'unknown';
    const entry = node.auto_entry ? `entry: ${node.auto_entry}` : '';
    const mid = node.auto_mid ? `mid: ${node.auto_mid}` : '';
    const lead = node.auto_leadership ? `leadership: ${node.auto_leadership}` : '';
    const parts = [entry, mid, lead].filter(Boolean).join(' | ');
    return `- ${name}${parts ? ` -> ${parts}` : ''}`;
  });

  const gradeLines = gradeNodes.map((node) => {
    const name = node.final_name || node.name || 'unknown';
    return `- ${name} (and: ${node.and || ''}${node.or ? ` | or: ${node.or}` : ''})`;
  });

  return [
    `Role/function hints for ${subdomains.join(', ') || 'general'}:`,
    ...(roleLines.length ? roleLines : ['- (none)']),
    '',
    `Seniority/grade hints (${gradeBand}):`,
    ...(gradeLines.length ? gradeLines : ['- (none)']),
    '',
    `Boolean style guide: ${BOOLEAN_STYLE_GUIDE.join(' ')}`,
  ].join('\n');
}

async function classifyDomain(openai: OpenAI, requirement: string) {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: 'Classify the requirement into a top-level domain.' },
      { role: 'user', content: requirement },
    ],
    response_format: zodResponseFormat(domainSchema, 'domain'),
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Domain classifier returned empty content');
  return domainSchema.parse(JSON.parse(content));
}

async function classifySubdomain(openai: OpenAI, requirement: string, domain: string) {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: `Identify 1-6 subdomains within ${domain}.` },
      { role: 'user', content: requirement },
    ],
    response_format: zodResponseFormat(subdomainSchema, 'subdomain'),
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Subdomain classifier returned empty content');
  return subdomainSchema.parse(JSON.parse(content));
}

async function classifyGrade(openai: OpenAI, requirement: string) {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: 'Identify the seniority band for this requirement.' },
      { role: 'user', content: requirement },
    ],
    response_format: zodResponseFormat(gradeSchema, 'grade'),
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Grade classifier returned empty content');
  return gradeSchema.parse(JSON.parse(content));
}

async function callAgent(
  openai: OpenAI,
  requirement: string,
  truthContext: string,
): Promise<QueryConstructorResult> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: buildAgentUserPrompt(requirement, truthContext) },
    ],
    response_format: zodResponseFormat(queryConstructorSchema, 'queryConstructor'),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Agent returned empty content');
  }

  return queryConstructorSchema.parse(JSON.parse(content));
}

function extractUnresolvedArray(
  searchType: SearchType,
  queryConstructor: QueryConstructorResult,
): unknown[] {
  const generated = mapQueryConstructorToUnresolved(queryConstructor, searchType);
  if (searchType === 'classic') {
    return generated.classicPeopleSearchStrategies?.map((s) => s.parameters) ?? [];
  }
  if (searchType === 'sales_navigator') {
    return generated.salesNavigatorPeopleSearchStrategies?.map((s) => s.parameters) ?? [];
  }
  return generated.recruiterPeopleSearchStrategies?.map((s) => s.parameters) ?? [];
}

const CLASSIC_DEFAULTS = {
  keywords: null as string | null,
  industry: null as string[] | null,
  location: null as string[] | null,
  profile_language: null as string[] | null,
  network_distance: null as number[] | null,
  company: null as string[] | null,
  past_company: null as string[] | null,
  school: null as string[] | null,
  service: null as string[] | null,
  connections_of: null as string[] | null,
  followers_of: null as string[] | null,
  open_to: null as string[] | null,
  advanced_keywords: null as Record<string, string | null> | null,
};

function normalizeClassicParam(p: unknown): unknown {
  if (p == null || typeof p !== 'object') return p;
  const obj = p as Record<string, unknown>;
  const adv = obj.advanced_keywords;
  const normalizedAdv =
    adv != null && typeof adv === 'object'
      ? {
          first_name: (adv as Record<string, unknown>).first_name ?? null,
          last_name: (adv as Record<string, unknown>).last_name ?? null,
          title: (adv as Record<string, unknown>).title ?? null,
          company: (adv as Record<string, unknown>).company ?? null,
          school: (adv as Record<string, unknown>).school ?? null,
        }
      : null;
  const withDefaults = { ...CLASSIC_DEFAULTS, ...obj, advanced_keywords: normalizedAdv };
  for (const k of Object.keys(withDefaults) as (keyof typeof CLASSIC_DEFAULTS)[]) {
    if (withDefaults[k] === undefined) (withDefaults as Record<string, unknown>)[k] = null;
  }
  return withDefaults;
}

function validateUnresolved(searchType: SearchType, params: unknown[]): string[] {
  const schema =
    searchType === 'classic'
      ? classicPeopleSearchSchema
      : searchType === 'sales_navigator'
        ? salesNavigatorPeopleSearchSchema
        : recruiterPeopleSearchSchema;

  const issues: string[] = [];
  params.forEach((param, idx) => {
    const toValidate = searchType === 'classic' ? normalizeClassicParam(param) : param;
    const result = schema.safeParse(toValidate);
    if (!result.success) {
      issues.push(
        `${searchType}[${idx}] invalid: ${result.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
  });
  return issues;
}

async function main(): Promise<void> {
  const { count, file, outFile, searchType, random } = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required.');
  }

  if (!searchType) {
    throw new Error('searchType is required. Use --searchType classic|sales_navigator|recruiter');
  }

  if (!fs.existsSync(file)) {
    throw new Error(`Requirements file not found: ${file}`);
  }

  const requirements = loadRequirements(file, count, random);
  if (!requirements.length) {
    throw new Error('No valid requirements found in input file.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const results: Array<{
    requirement: string;
    search_type: SearchType;
    unresolved_parameters: unknown[];
    validation_issues: string[];
  }> = [];

  for (let i = 0; i < requirements.length; i += 1) {
    const requirement = requirements[i];
    const index = i + 1;
    console.log(`\n[${index}] Requirement: ${requirement}`);

    const domainResult = await classifyDomain(openai, requirement);
    const subdomainResult = await classifySubdomain(
      openai,
      requirement,
      domainResult.primary_domain,
    );
    const gradeResult = await classifyGrade(openai, requirement);
    const truthContext = buildFocusedTruthContext(
      requirement,
      subdomainResult.subdomains,
      gradeResult.seniority_band,
    );

    const queryConstructorResult = await callAgent(openai, requirement, truthContext);
    const unresolved = extractUnresolvedArray(searchType, queryConstructorResult);
    const validationIssues = validateUnresolved(searchType, unresolved);

    console.log(`[${index}] Search type: ${searchType}`);
    console.log(`[${index}] Unresolved parameters (${unresolved.length}):`);
    console.log(JSON.stringify(unresolved, null, 2));

    if (validationIssues.length) {
      console.log(`[${index}] Validation warnings:`);
      validationIssues.forEach((issue) => console.log(`  - ${issue}`));
    }

    results.push({
      requirement,
      search_type: searchType,
      unresolved_parameters: unresolved,
      validation_issues: validationIssues,
    });
  }

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log(`\nSaved results to ${outFile}`);
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
