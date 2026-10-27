import {
  type ScenarioTrace,
  type ToolCall,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/run-scenario';

// Turns a trace into the answer to "which path did the prompts take?": the
// skills and sections loaded, the track, the sources, the questions asked, the
// rubric, and the tool calls in order.

export type PathReport = {
  skillsLoaded: string[];
  track: string;
  sources: string[];
  questions: string[];
  rubric: string[];
  enrichment: string[];
  shortlist: string[];
  steps: string[];
};

const SOURCE_TOOLS = new Set([
  'search_bright_data_business',
  'google_serp_search',
  'search_linkedin_people',
  'search_linkedin_companies',
  'search_linkedin_from_url',
  'search_harvest_leads',
  'search_harvest_accounts',
  'search_apollo_people',
  'search_apollo_companies',
  'exa_web_search',
  'find_role_at_companies',
]);

const FITMENT_TOOLS = new Set(['preview_ai_column', 'run_ai_column']);

type Criterion = { key?: unknown; mustHave?: unknown };

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

const criteriaOf = (call: ToolCall): Criterion[] => {
  const fitment = call.args.fitment;

  if (typeof fitment === 'object' && fitment !== null) {
    const criteria = (fitment as { criteria?: unknown }).criteria;

    return Array.isArray(criteria) ? (criteria as Criterion[]) : [];
  }

  return [];
};

const questionTexts = (call: ToolCall): string[] => {
  const questions = call.args.questions;

  if (!Array.isArray(questions)) {
    return ['(question text not captured)'];
  }

  return questions.map((question) =>
    typeof question === 'object' && question !== null
      ? String((question as { question?: unknown }).question ?? '')
      : String(question),
  );
};

const describeCall = (call: ToolCall): string => {
  const { tool, args } = call;

  switch (tool) {
    case 'load_skills':
      return `${asStrings(args.skillNames).join('+')} sections=${
        args.sections === undefined
          ? 'default'
          : asStrings(args.sections).join(',')
      }`;
    case 'search_bright_data_business':
      return `entity=${String(args.entity)} query="${String(args.query ?? '').slice(0, 160)}"`;
    case 'find_role_at_companies':
      return `roles=${JSON.stringify(args.roles)} fromProject=${String(args.fromProject)} companies=${
        Array.isArray(args.companies) ? args.companies.length : 'none'
      }`;
    case 'preview_ai_column':
    case 'run_ai_column': {
      const criteria = criteriaOf(call);

      if (criteria.length > 0) {
        return `stage=${String((args.fitment as { stage?: unknown }).stage)} ${criteria
          .map(
            (criterion) =>
              `${criterion.mustHave === true ? 'MUST' : 'nice'} ${String(criterion.key)}`,
          )
          .join('; ')}`;
      }

      if (typeof args.description === 'string') {
        return `enrich description="${args.description.slice(0, 120)}"`;
      }

      return JSON.stringify(args).slice(0, 140);
    }
    case 'generate_table_view':
      return `tab=${String(args.tab)} description="${String(args.description ?? '').slice(0, 120)}"`;
    case 'apply_table_view':
      return args.clear === true
        ? 'clear'
        : `tab=${String(args.tab)} filters=${JSON.stringify(args.filters ?? null).slice(0, 80)}`;
    case 'ask_questions':
      return questionTexts(call).join(' | ').slice(0, 300);
    default:
      return JSON.stringify(args).slice(0, 140);
  }
};

const inferTrack = (calls: ToolCall[]): string => {
  const searches = calls.filter(
    (call) => call.tool === 'search_bright_data_business',
  );
  const companySearch = searches.some((call) => call.args.entity === 'company');
  const peopleSearch = searches.some((call) => call.args.entity === 'people');
  const findRole = calls.some((call) => call.tool === 'find_role_at_companies');
  const linkedinPeople = calls.some(
    (call) => call.tool === 'search_linkedin_people',
  );

  if (companySearch && findRole) {
    return 'company-first: companies, then find_role_at_companies';
  }

  if (findRole) {
    return 'people-by-company: find_role_at_companies';
  }

  if (companySearch && !peopleSearch) {
    return 'companies only (no people step reached)';
  }

  if (peopleSearch || linkedinPeople) {
    return 'people: a population search';
  }

  return 'none reached before the run ended';
};

export const describePath = (trace: ScenarioTrace): PathReport => {
  console.log('trace', trace);
  const calls = trace.calls.filter((call) => call.tool !== 'learn_tools');
  const fitmentCalls = calls.filter((call) => FITMENT_TOOLS.has(call.tool));
  const lastRubric = [...fitmentCalls]
    .reverse()
    .map(criteriaOf)
    .find((criteria) => criteria.length > 0);

  console.log('fitmentCalls', fitmentCalls);
  console.log('lastRubric', lastRubric);
  console.log('calls', calls);

  const enrichment = calls
    .filter(
      (call) =>
        FITMENT_TOOLS.has(call.tool) &&
        call.args.description !== undefined &&
        call.args.fitment === undefined,
    )
    .map((call) => `${call.tool}: ${describeCall(call)}`);
  const shortlist = calls
    .filter(
      (call) =>
        call.tool === 'generate_table_view' || call.tool === 'apply_table_view',
    )
    .map((call) => `${call.tool}: ${describeCall(call)}`);

  return {
    skillsLoaded: calls
      .filter((call) => call.tool === 'load_skills')
      .map(describeCall),
    track: inferTrack(calls),
    sources: [
      ...new Set(
        calls
          .filter((call) => SOURCE_TOOLS.has(call.tool))
          .map((call) =>
            call.tool === 'search_bright_data_business'
              ? `${call.tool} (${String(call.args.entity)})`
              : call.tool,
          ),
      ),
    ],
    questions: calls
      .filter((call) => call.tool === 'ask_questions')
      .flatMap(questionTexts),
    rubric: (lastRubric ?? []).map(
      (criterion) =>
        `${criterion.mustHave === true ? 'MUST' : 'nice'} ${String(criterion.key)}`,
    ),
    enrichment,
    shortlist,
    steps: calls.map(
      (call, index) => `${index + 1}. ${call.tool}: ${describeCall(call)}`,
    ),
  };
};

export const renderPath = (prompt: string, report: PathReport): string =>
  [
    `# Path for: ${prompt}`,
    '',
    `**Track:** ${report.track}`,
    `**Sources:** ${report.sources.join(', ') || 'none'}`,
    '',
    '## Skills loaded',
    ...report.skillsLoaded.map((line) => `- ${line}`),
    '',
    '## Questions asked',
    ...(report.questions.length > 0
      ? report.questions.map((line) => `- ${line}`)
      : ['- none']),
    '',
    '## Rubric (last fitment call)',
    ...(report.rubric.length > 0
      ? report.rubric.map((line) => `- ${line}`)
      : ['- none']),
    '',
    '## Enrichment columns',
    ...(report.enrichment.length > 0
      ? report.enrichment.map((line) => `- ${line}`)
      : ['- none']),
    '',
    '## Shortlist views',
    ...(report.shortlist.length > 0
      ? report.shortlist.map((line) => `- ${line}`)
      : ['- none']),
    '',
    '## Tool calls in order',
    ...report.steps,
    '',
  ].join('\n');
