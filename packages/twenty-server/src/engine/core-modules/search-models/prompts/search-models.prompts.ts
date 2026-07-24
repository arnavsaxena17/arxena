import { z } from 'zod';

import {
  CandidateProfile,
  CandidateShortlistDecision,
  CandidateStructuredFields,
  InformationCollectionPlan,
  SearchExpectation,
  SearchQueryPlan,
  SearchStrategy,
  SearchStrategyPlan,
  StrategyRubricEvaluation,
} from '../types/search-models.types';

type PromptDefinition = {
  system: string;
  user: string;
};

const PROMPT_1 = 'Analyze the brief, highlight gaps, and explain what to collect next.';
const PROMPT_2 =
    'Use the context to design multiple sourcing strategies with clear actions and risks.';
const PROMPT_3 =
    'Convert the selected strategies into search queries, enrichments, and filters.';
const PROMPT_4 = `Here is a candidate :
    The search expects the job title to be :

    The search expects the company to be :

    The search expects the location to be :

    The search expects the salary to be :

    The search expects the experience to be :

    The search expects the education to be :

    The search expects the skills to be :

    The search expects the certifications to be :

    The search expects the languages to be :

    The shortlisting criteria is :

    If the company is not a good fit, then reject the candidate
    If the location is not a good fit, then reject the candidate
    If the salary is not a good fit, then reject the candidate
    If the experience is not a good fit, then reject the candidate
    If the education is not a good fit, then reject the candidate
    If the skills are not a good fit, then reject the candidate
    If the certifications are not a good fit, then reject the candidate
    If the languages are not a good fit, then reject the candidate`;

const formatList = (items?: string[]) => {
  if (!items || items.length === 0) {
    return 'None provided';
  }

  return items.join(', ');
};

const buildCandidateSnapshot = (candidate: CandidateProfile): string => {
  return `Name: ${candidate.name || 'Unknown'}
Current Title: ${candidate.currentTitle || 'Unknown'}
Current Company: ${candidate.currentCompany || 'Unknown'}
Current Location: ${candidate.currentLocation || 'Unknown'}
Preferred Location: ${candidate.preferredLocation || 'Unknown'}
Total Experience (years): ${candidate.totalExperienceYears ?? 'Unknown'}
Current Compensation: ${candidate.currentCompensation || 'Unknown'}
Expected Compensation: ${candidate.expectedCompensation || 'Unknown'}
Education: ${formatList(candidate.education)}
Skills: ${formatList(candidate.skills)}
Certifications: ${formatList(candidate.certifications)}
Languages: ${formatList(candidate.languages)}
Achievements: ${formatList(candidate.achievements)}
Notes: ${candidate.notes || 'None'}`;
};

const buildExpectationSnapshot = (expectations?: SearchExpectation): string => {
  if (!expectations) {
    return 'No explicit expectations were provided. Use the natural language query to derive constraints.';
  }

  return `Job Title: ${expectations.jobTitle || 'Not specified'}
Company: ${expectations.company || 'Not specified'}
Location: ${expectations.location || 'Not specified'}
Salary: ${expectations.salary || 'Not specified'}
Experience: ${expectations.experience || 'Not specified'}
Education: ${expectations.education || 'Not specified'}
Skills: ${expectations.skills || 'Not specified'}
Certifications: ${expectations.certifications || 'Not specified'}
Languages: ${expectations.languages || 'Not specified'}
Shortlisting Criteria: ${expectations.shortlistingCriteria || 'Not specified'}`;
};

const formatValue = (value: string | number | boolean | null | undefined): string => {
  if (value === undefined || value === null || value === '') {
    return 'Not provided';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return `${value}`;
};

const buildStructuredFieldRubric = (
  structured?: CandidateStructuredFields,
): string => {
  if (!structured) {
    return 'No structured candidate fields were supplied. Use the general snapshot only.';
  }

  const lines: string[] = [];
  const push = (label: string, value: string | number | boolean | null | undefined, guidance: string) => {
    lines.push(`${label}: ${formatValue(value)}
    Guidance: ${guidance}`);
  };

  push(
    'jsUserName',
    structured.jsUserName,
    'Validate the identity matches the resume/source profile and is a real executive-level candidate.',
  );
  push(
    'jobTitle',
    structured.jobTitle,
    'Check that the headline title reflects strategic leadership (Head, Director, VP) aligning with the JD.',
  );
  push(
    'keySkills',
    structured.keySkills,
    'Cross-verify foundational skills with JD core capabilities (strategy, planning, power infrastructure).',
  );
  push(
    'focusedSkills',
    structured.focusedSkills,
    'Ensure focus skills include corporate strategy, market analysis, capital allocation, and sector expertise.',
  );
  push(
    'interestedSkills',
    structured.interestedSkills,
    'Use to gauge growth appetite; flag if missing skills critical for role.',
  );

  (['ug', 'pg', 'ppg'] as const).forEach((key) => {
    const label = `education.${key}`;
    const record = structured.education?.[key];
    push(`${label}.institute`, record?.institute, 'Confirm pedigree and relevance (tier-1 MBA or engineering preferred).');
    push(`${label}.course`, record?.course, 'Check discipline relevance (business, strategy, engineering).');
    push(`${label}.specialization`, record?.specialization, 'Ensure specialization supports corporate strategy/operations.');
    push(`${label}.year`, record?.year, 'Verify recency and seniority alignment.');
  });

  (['current', 'previous'] as const).forEach((key) => {
    const label = `employment.${key}`;
    const record = structured.employment?.[key];
    push(`${label}.designation`, record?.designation, 'Assess seniority and whether role covers strategy/enterprise planning.');
    push(`${label}.organization`, record?.organization, 'Check industry overlap (power, manufacturing, infra).');
    push(`${label}.startDate`, record?.startDate, 'Use to compute tenure and stability.');
    push(`${label}.endDate`, record?.endDate || (label.includes('current') ? '' : undefined), 'Confirm current status and notice implications.');
  });

  push('ctcInfo.lacs', structured.ctcInfo?.lacs, 'Ensure current comp aligns with JD range and expectations.');
  push('ctcInfo.thousands', structured.ctcInfo?.thousands, 'Use for precise compensation comparisons.');
  push('ctcInfo.currency', structured.ctcInfo?.currency, 'Cross-check currency relevance (₹ expected).');

  push('experience.years', structured.experience?.years, 'Verify total years meet the minimum (12-15 years).');
  push('experience.months', structured.experience?.months, 'Capture additional tenure precision.');

  push('currentLocation', structured.currentLocation, 'Must match JD base location or be relocatable.');
  push('preferredLocations', structured.preferredLocations, 'Confirm preference includes JD location.');
  push('salaryDisclosed', structured.salaryDisclosed, 'Transparency helps validate compensation fit.');
  push(
    'immediateAvailabilty',
    structured.immediateAvailabilty,
    'Notice/availability must align with business urgency (<=90 days ideal).',
  );
  push('avgResponseTime', structured.avgResponseTime, 'Gauge responsiveness for outreach prioritization.');
  push('noticePeriod', structured.noticePeriod, 'Long notice periods may require negotiation; note risk.');
  push('modifyDateLabel', structured.modifyDateLabel, 'Use recency to estimate data freshness.');
  push('activeDateLabel', structured.activeDateLabel, 'Higher priority if active recently.');

  return lines.join('\n\n');
};

export const InformationPlanSchema: z.ZodType<InformationCollectionPlan> = z
  .object({
    summary: z.string(),
    missingInformation: z.array(
      z.object({
        field: z.string(),
        whyItMatters: z.string(),
        recommendedSources: z.array(z.string()),
      }),
    ),
  })
  .strict();

export const StrategyPlanSchema: z.ZodType<SearchStrategyPlan> = z
  .object({
    strategies: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        triggers: z.array(z.string()),
        riskLevel: z.enum(['low', 'medium', 'high']),
        steps: z.array(z.string()),
        targetPoolSize: z.string(),
      }),
    ),
    recommendedNextActions: z.array(z.string()),
  })
  .strict();

export const QueryPlanSchema: z.ZodType<SearchQueryPlan> = z
  .object({
    searchQueries: z.array(
      z.object({
        label: z.string(),
        query: z.string(),
        rationale: z.string(),
      }),
    ),
    enrichments: z.array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    ),
    filters: z.array(
      z.object({
        field: z.string(),
        include: z.array(z.string()),
        exclude: z.array(z.string()).optional(),
        rationale: z.string(),
      }),
    ),
  })
  .strict();

export const ShortlistDecisionSchema: z.ZodType<CandidateShortlistDecision> = z
  .object({
    isShortlisted: z.boolean(),
    score: z.number(),
    summary: z.string(),
    satisfiedCriteria: z.array(z.string()),
    unmetCriteria: z.array(
      z.object({
        criterion: z.string(),
        reason: z.string(),
      }),
    ),
    finalRecommendation: z.string(),
  })
  .strict();

export const StrategyRubricSchema: z.ZodType<StrategyRubricEvaluation> = z
  .object({
    strategyName: z.string(),
    fitSummary: z.string(),
    rubric: z.array(
      z.object({
        field: z.string(),
        value: z.string(),
        guidance: z.string(),
        status: z.enum(['aligned', 'partial', 'misaligned', 'missing']),
        rationale: z.string(),
      }),
    ),
    recommendedAction: z.string(),
    riskNotes: z.string(),
  })
  .strict();

export class SearchModelsPrompts {
  static buildInformationPlanPrompt(
    naturalLanguageQuery: string,
    candidate: CandidateProfile,
  ): PromptDefinition {
    const prompt = {
      system: `You are an executive recruitment operations analyst. Break down sourcing requirements, highlight missing information, and map each gap to why it matters plus recommended sources.`,
      user: `Natural language search brief:
${naturalLanguageQuery}

Current candidate data snapshot:
${buildCandidateSnapshot(candidate)}

Task: ${PROMPT_1}.`,
    }
    console.log('Information plan prompt', JSON.stringify(prompt, null, 2));
    return prompt;
  }

  static buildStrategyPrompt(
    naturalLanguageQuery: string,
    candidate: CandidateProfile,
    infoPlan: InformationCollectionPlan,
  ): PromptDefinition {
    const prompt = {
      system: `You are a recruiting strategist. Use the provided context to design multiple sourcing approaches with triggers, risks, and concrete steps.`,
      user: `Natural language search brief:
${naturalLanguageQuery}

Candidate summary:
${buildCandidateSnapshot(candidate)}

Information collection plan:
${JSON.stringify(infoPlan, null, 2)}

Task: ${PROMPT_2}.`,
    }
    console.log('Strategy prompt', JSON.stringify(prompt, null, 2));
    return prompt;
  }

  static buildQueryPlanPrompt(
    naturalLanguageQuery: string,
    strategyPlan: SearchStrategyPlan,
  ): PromptDefinition {
    const prompt = {  
      system: `You are a boolean search and enrichment architect. Convert sourcing strategies into actionable search plans with labeled queries, enrichments, and filters.`,
      user: `Natural language search brief:
${naturalLanguageQuery}

Approved sourcing strategies:
${JSON.stringify(strategyPlan, null, 2)}

Task: ${PROMPT_3}.`,
    }
    console.log('Query plan prompt', JSON.stringify(prompt, null, 2));
    return prompt;
  }

  static buildShortlistPrompt(
    naturalLanguageQuery: string,
    candidate: CandidateProfile,
    expectations: SearchExpectation | undefined,
    queryPlan: SearchQueryPlan,
  ): PromptDefinition {
    const prompt = {
      system: `You are a senior recruiter responsible for shortlisting candidates using structured rubrics. Follow every rejection rule carefully.`,
      user: `Natural language search brief:
    ${naturalLanguageQuery}

    ${PROMPT_4}

    Candidate profile:
    ${buildCandidateSnapshot(candidate)}

    Search expectations:
    ${buildExpectationSnapshot(expectations)}

    Search execution plan:
    ${JSON.stringify(queryPlan, null, 2)}

    Return the final decision following the rubric.`,
    }
    console.log('Shortlist prompt', JSON.stringify(prompt, null, 2));
    return prompt;
  }

  static buildStrategyRubricPrompt(
    naturalLanguageQuery: string,
    candidate: CandidateProfile,
    strategy: SearchStrategy,
  ): PromptDefinition {
    const prompt = {
      system: `You are a recruitment quality auditor. For each search strategy you will build a field-by-field rubric showing whether the candidate supports this approach. Use the provided JSON schema and be decisive.`,
      user: `Natural language search brief:
      ${naturalLanguageQuery}

      Strategy under review:
      ${JSON.stringify(strategy, null, 2)}

      Candidate narrative snapshot:
      ${buildCandidateSnapshot(candidate)}

      Structured candidate fields and evaluation guidance:
      ${buildStructuredFieldRubric(candidate.structuredFields)}

      Task: Produce a rubric covering every listed field. Mark status as "aligned", "partial", "misaligned", or "missing". Reference concrete evidence in rationale and conclude with recommended action plus risks.`,
    }
    console.log('Strategy rubric prompt', JSON.stringify(prompt, null, 2));
    return prompt;
  }
}

export type InformationPlanOutput = InformationCollectionPlan;
export type StrategyPlanOutput = SearchStrategyPlan;
export type QueryPlanOutput = SearchQueryPlan;
export type ShortlistOutput = CandidateShortlistDecision;
export type StrategyRubricOutput = StrategyRubricEvaluation;

