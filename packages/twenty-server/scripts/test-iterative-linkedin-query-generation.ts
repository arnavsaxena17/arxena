/**
 * Test Runner for Iterative LinkedIn Query Generation
 * Picks one of the first five requirements from leadership_requirements.txt,
 * runs the iterative query generation flow, and logs the generated query set.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IterativeQuerySetResult } from '../src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { IterativeLinkedinQueryGenerationService } from '../src/engine/core-modules/linkedin-query-generation/services/iterative-linkedin-query-generation.service';
import { LinkedinQueryGenerationService } from '../src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';

type LeadershipRequirement = {
  id: number;
  requirement: string;
};

const DEFAULT_STEERING_MESSAGE =
  'Broaden beyond telecom equipment vendors. Prioritize partner-sales leaders with B2B channel ownership across enterprise technology companies in Gujarat, and avoid overly narrow title plus keyword overlap.';

// Load .env from twenty-server package when run via yarn workspace
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // dotenv optional
}

function loadLeadershipRequirements(): LeadershipRequirement[] {
  const filePath = path.join(__dirname, '..', '..', '..', 'leadership_requirements.txt');
  const raw = fs.readFileSync(filePath, 'utf8');

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[A-Z][A-Za-z\s&/-]+$/.test(line))
    .slice(0, 5)
    .map((requirement, index) => ({
      id: index + 1,
      requirement,
    }));
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_KEY) {
    console.error('\n❌ ERROR: OPENAI_KEY environment variable is required');
    console.error('   Set it with: export OPENAI_KEY=your_key_here');
    process.exit(1);
  }

  const leadershipRequirements = loadLeadershipRequirements();

  if (leadershipRequirements.length === 0) {
    console.error('❌ No leadership requirements found');
    process.exit(1);
  }

  const requestedIndex = process.env.REQUIREMENT_INDEX
    ? parseInt(process.env.REQUIREMENT_INDEX, 10)
    : null;

  const chosenRequirement =
    requestedIndex && requestedIndex >= 1 && requestedIndex <= leadershipRequirements.length
      ? leadershipRequirements[requestedIndex - 1]
      : leadershipRequirements[
          Math.floor(Math.random() * leadershipRequirements.length)
        ];

  console.log(`\n${'='.repeat(90)}`);
  console.log('Iterative LinkedIn Query Generation Test');
  console.log('='.repeat(90));
  console.log(`Requirement Pool: first ${leadershipRequirements.length} entries from leadership_requirements.txt`);
  console.log(`Selected Requirement #${chosenRequirement.id}`);
  console.log(`Requirement: ${chosenRequirement.requirement}`);
  console.log(`Mode: ${process.env.ITERATIVE_MODE ?? 'offline'}`);
  console.log('');

  const service = new IterativeLinkedinQueryGenerationService(
    new LinkedinQueryGenerationService(null),
    {} as any,
    {} as any,
  );
  const mode =
    process.env.ITERATIVE_MODE === 'live' ? 'live' : 'offline';
  const queryIpLocation = process.env.QUERY_IP_LOCATION ?? 'Mumbai, India';
  const steeringMessage =
    process.env.STEERING_MESSAGE?.trim() || DEFAULT_STEERING_MESSAGE;
  const runSteering = process.env.RUN_STEERING !== '0';

  const startTime = Date.now();
  const initialResult = await service.generateIterativeSearchQuerySet(
    chosenRequirement.requirement,
    {
      mode,
      queryIpLocation,
      searchType: 'classic',
      maxIterations: 4,
      returnAlternatives: true,
      verbose: process.env.VERBOSE === '1' || process.env.DEBUG === '1',
    },
  );
  let steeredResult: IterativeQuerySetResult | null = null;

  if (runSteering) {
    const steeredRequirement = [
      `Base requirement: ${chosenRequirement.requirement}`,
      `User steering updates:\n1. ${steeringMessage}`,
    ].join('\n\n');
    steeredResult = await service.generateIterativeSearchQuerySet(
      steeredRequirement,
      {
        mode,
        queryIpLocation,
        searchType: 'classic',
        maxIterations: 4,
        returnAlternatives: true,
        verbose: process.env.VERBOSE === '1' || process.env.DEBUG === '1',
      },
    );
  }
  const elapsed = Date.now() - startTime;

  console.log('Initial Verification Summary:');
  console.log(JSON.stringify(initialResult.verification_summary, null, 2));
  console.log('');

  console.log('Initial Target Profile Preview:');
  console.log(JSON.stringify(initialResult.target_profile_preview ?? null, null, 2));
  console.log('');

  console.log('Initial Query Set:');
  console.log(JSON.stringify(initialResult.final_query_set, null, 2));
  console.log('');

  console.log('Initial Ranked Alternatives:');
  console.log(
    JSON.stringify(
      initialResult.ranked_alternatives.map((alternative, index) => ({
        rank: index + 1,
        score: alternative.score,
        summary: alternative.summary,
        rejection_reason: alternative.rejection_reason,
        query_count: alternative.query_set.search_query_set.length,
      })),
      null,
      2,
    ),
  );
  console.log('');

  console.log('Initial Iterations:');
  console.log(
    JSON.stringify(
      initialResult.iterations.map((iteration) => ({
        round: iteration.round,
        winner_candidate_id: iteration.winner_candidate_id,
        winner_score: iteration.winner_score,
        improvement_from_previous: iteration.improvement_from_previous,
        candidates: iteration.candidates.map((candidate) => ({
          candidate_id: candidate.candidate_id,
          label: candidate.label,
          score: candidate.score,
          summary: candidate.summary,
        })),
      })),
      null,
      2,
    ),
  );
  console.log('');

  if (steeredResult) {
    console.log('Steering Message:');
    console.log(steeringMessage);
    console.log('');

    console.log('Final Verification Summary After Steering:');
    console.log(JSON.stringify(steeredResult.verification_summary, null, 2));
    console.log('');

    console.log('Final Target Profile Preview After Steering:');
    console.log(JSON.stringify(steeredResult.target_profile_preview ?? null, null, 2));
    console.log('');

    console.log('Final Query Set After Steering:');
    console.log(JSON.stringify(steeredResult.final_query_set, null, 2));
    console.log('');
  }

  const outputDir = path.join(
    process.cwd(),
    'test-results',
    'iterative-linkedin-query-generation',
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const safeName = chosenRequirement.requirement
    .slice(0, 80)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();

  const outputFile = path.join(
    outputDir,
    `requirement_${chosenRequirement.id}_${safeName}.json`,
  );

  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        selectedRequirement: chosenRequirement,
        steeringMessage: runSteering ? steeringMessage : null,
        elapsedMs: elapsed,
        initialResult,
        steeredResult,
      },
      null,
      2,
    ),
  );

  console.log(`Saved full result: ${outputFile}`);
  console.log(`Elapsed: ${elapsed}ms`);
  console.log(`${'='.repeat(90)}\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
