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

type OrchestratorGenerateResult = {
  final_query_set: {
    search_query_set: SearchQuery[];
  };
  metadata: {
    processing_time_ms: number;
    total_queries_generated: number;
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

async function generateQuerySet(requirement: string): Promise<OrchestratorGenerateResult> {
  const response = await fetch(`${baseUrl}/linkedin-query-generation/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      rawRequirement: requirement,
      queryIpLocation: process.env.QUERY_IP_LOCATION ?? 'Mumbai, India',
      verbose: process.env.VERBOSE === '1' || process.env.DEBUG === '1',
      model: process.env.SEARCH_QUERY_GENERATOR_MODEL,
    }),
  });

  const json = (await response.json()) as OrchestratorGenerateResult | { message?: string };

  if (!response.ok) {
    throw new Error(
      `Query set generation failed (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  return json as OrchestratorGenerateResult;
}

function summarizeResult(
  requirement: LeadershipRequirement,
  result: OrchestratorGenerateResult,
) {
  return {
    id: requirement.id,
    requirement: requirement.requirement,
    metadata: result.metadata,
    finalQueryCount: result.final_query_set.search_query_set.length,
    finalQueries: result.final_query_set.search_query_set,
  };
}

async function main(): Promise<void> {
  const requirements = loadLeadershipRequirements(5);

  if (requirements.length === 0) {
    throw new Error('No leadership requirements found');
  }

  console.log(`Running LinkedIn query generation for ${requirements.length} leadership requirements`);
  console.log(`Backend: ${baseUrl}`);
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
      const result = await generateQuerySet(requirement.requirement);
      const summary = summarizeResult(requirement, result);
      reports.push(summary);

      console.log('Metadata:');
      console.log(JSON.stringify(summary.metadata, null, 2));
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
    averageProcessingTimeMs:
      reports.length > 0
        ? reports.reduce((sum, report) => sum + report.metadata.processing_time_ms, 0) /
          reports.length
        : null,
  };

  const outputDir = path.join(
    process.cwd(),
    'test-results',
    'live-assistant-steering',
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, 'leadership_requirements_batch.json');

  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        baseUrl,
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
