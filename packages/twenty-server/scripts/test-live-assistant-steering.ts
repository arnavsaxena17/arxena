import * as fs from 'fs';
import * as path from 'path';

const baseUrl = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:3000';
const token = process.env.ASSISTANT_BEARER_TOKEN;

if (!token) {
  throw new Error('ASSISTANT_BEARER_TOKEN is required');
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

type SearchQuery = {
  keywords: string | null;
  job_title: string | null;
  company: string[] | null;
  location: string[] | null;
  years_of_experience: string | null;
};

type TargetProfilePreviewItem = {
  archetype: string;
  sample_profile: string;
  retrieval_focus: 'title' | 'keywords' | 'mixed';
};

type IterativeQuerySetResult = {
  final_query_set: {
    search_query_set: SearchQuery[];
  };
  ranked_alternatives: Array<{
    query_set: {
      search_query_set: SearchQuery[];
    };
    score: number;
    summary: string;
    rejection_reason?: string | null;
  }>;
  iterations: Array<{
    round: number;
    winner_candidate_id: string;
    winner_score: number;
    improvement_from_previous: number | null;
  }>;
  verification_summary: {
    mode: 'offline' | 'live';
    final_score: number;
    termination_reason:
      | 'max_iterations_reached'
      | 'good_enough'
      | 'no_meaningful_improvement';
    live_preview_used: boolean;
    live_preview_fallback_reason?: string | null;
  };
  target_profile_preview?: {
    recruiter_validation_question: string;
    positive_examples: TargetProfilePreviewItem[];
    negative_examples: TargetProfilePreviewItem[];
  };
};

type LeadershipRequirement = {
  id: number;
  requirement: string;
};

function loadLeadershipRequirements(limit = 5): LeadershipRequirement[] {
  const filePath = path.join(__dirname, '..', '..', '..', 'leadership_requirements.txt');
  const raw = fs.readFileSync(filePath, 'utf8');

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[A-Z][A-Za-z\s&/-]+$/.test(line))
    .slice(0, limit)
    .map((requirement, index) => ({
      id: index + 1,
      requirement,
    }));
}

async function generateIterativeQuerySet(
  requirement: string,
): Promise<IterativeQuerySetResult> {
  const response = await fetch(`${baseUrl}/linkedin-query-generation/generate/iterative`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      rawRequirement: requirement,
      mode: process.env.ITERATIVE_MODE === 'live' ? 'live' : 'offline',
      searchType: process.env.SEARCH_TYPE ?? 'classic',
      queryIpLocation: process.env.QUERY_IP_LOCATION ?? 'Mumbai, India',
      maxIterations: Number(process.env.MAX_ITERATIONS ?? 4),
      returnAlternatives: true,
      verbose: process.env.VERBOSE === '1' || process.env.DEBUG === '1',
      model: process.env.SEARCH_QUERY_GENERATOR_MODEL,
    }),
  });

  const json = (await response.json()) as IterativeQuerySetResult | { message?: string };

  if (!response.ok) {
    throw new Error(
      `Iterative generation failed (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  return json as IterativeQuerySetResult;
}

function summarizeResult(
  requirement: LeadershipRequirement,
  result: IterativeQuerySetResult,
) {
  return {
    id: requirement.id,
    requirement: requirement.requirement,
    archetypePreview: result.target_profile_preview ?? null,
    evaluation: result.verification_summary,
    finalQueryCount: result.final_query_set.search_query_set.length,
    finalQueries: result.final_query_set.search_query_set,
    topAlternative:
      result.ranked_alternatives.length > 0
        ? {
            score: result.ranked_alternatives[0].score,
            summary: result.ranked_alternatives[0].summary,
            queryCount: result.ranked_alternatives[0].query_set.search_query_set.length,
          }
        : null,
    iterations: result.iterations,
  };
}

async function main(): Promise<void> {
  const requirements = loadLeadershipRequirements(5);

  if (requirements.length === 0) {
    throw new Error('No leadership requirements found');
  }

  console.log(`Running iterative query evaluation for ${requirements.length} leadership requirements`);
  console.log(`Backend: ${baseUrl}`);
  console.log(`Mode: ${process.env.ITERATIVE_MODE === 'live' ? 'live' : 'offline'}`);
  console.log('');

  const reports: Array<ReturnType<typeof summarizeResult>> = [];
  const failures: Array<{
    id: number;
    requirement: string;
    error: string;
  }> = [];

  for (const requirement of requirements) {
    console.log(`Requirement #${requirement.id}`);
    console.log(requirement.requirement);

    try {
      const result = await generateIterativeQuerySet(requirement.requirement);
      const summary = summarizeResult(requirement, result);
      reports.push(summary);

      console.log('Archetype preview:');
      console.log(JSON.stringify(summary.archetypePreview, null, 2));
      console.log('Evaluation:');
      console.log(JSON.stringify(summary.evaluation, null, 2));
      console.log('Final query set:');
      console.log(JSON.stringify(summary.finalQueries, null, 2));
      console.log('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        id: requirement.id,
        requirement: requirement.requirement,
        error: message,
      });
      console.log(`Request failed: ${message}`);
      console.log('');
    }
  }

  const aggregate = {
    totalRequirements: reports.length,
    attemptedRequirements: requirements.length,
    failedRequirements: failures.length,
    averageFinalScore:
      reports.length > 0
        ? reports.reduce((sum, report) => sum + report.evaluation.final_score, 0) /
          reports.length
        : null,
    livePreviewUsedCount: reports.filter(
      (report) => report.evaluation.live_preview_used,
    ).length,
    requirementsWithAlternatives: reports.filter(
      (report) => report.topAlternative !== null,
    ).length,
  };

  const outputDir = path.join(
    process.cwd(),
    'test-results',
    'live-assistant-steering',
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(
    outputDir,
    `leadership_requirements_batch_${process.env.ITERATIVE_MODE === 'live' ? 'live' : 'offline'}.json`,
  );

  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        baseUrl,
        mode: process.env.ITERATIVE_MODE === 'live' ? 'live' : 'offline',
        queryIpLocation: process.env.QUERY_IP_LOCATION ?? 'Mumbai, India',
        aggregate,
        reports,
        failures,
      },
      null,
      2,
    ),
  );

  console.log('Aggregate summary:');
  console.log(JSON.stringify(aggregate, null, 2));
  console.log(`Saved report: ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
