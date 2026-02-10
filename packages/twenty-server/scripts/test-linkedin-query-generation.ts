/**
 * Test Runner for LinkedIn Query Generation
 * Runs the multi-agent system with 10 sample requirements from the Downloads project.
 * Output format matches the linkedin-query-generator npm test.
 */

import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { LinkedinQueryGenerationModule } from '../src/engine/core-modules/linkedin-query-generation/linkedin-query-generation.module';
import { LinkedinQueryGenerationService } from '../src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { TEST_REQUIREMENTS } from './test-linkedin-query-generation.requirements';

// Load .env from twenty-server package when run via yarn workspace
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // dotenv optional
}

type TestCase = (typeof TEST_REQUIREMENTS)[number];

async function runSingleTest(
  testCase: TestCase,
  service: LinkedinQueryGenerationService,
): Promise<{ result: Awaited<ReturnType<LinkedinQueryGenerationService['generateSearchQuerySet']>> } | { error: string }> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${testCase.id}: ${testCase.name}`);
  console.log('='.repeat(80));
  console.log(`Requirement: ${testCase.requirement}`);
  console.log('');

  try {
    console.log('🚀 Starting LinkedIn Search Query Generation');
    console.log('📝 Raw Requirement:', testCase.requirement);
    console.log('');
    const verbose = process.env.VERBOSE === '1' || process.env.DEBUG === '1';
    if (verbose) {
      console.log('📢 Verbose logging enabled (VERBOSE=1 or DEBUG=1)');
    }
    console.log('🚀 Aerx Starting LinkedIn Search Query Generation');
    const queryIpLocation =
      process.env.QUERY_IP_LOCATION ?? 'Mumbai, India';
    const result = await service.generateSearchQuerySet(testCase.requirement, {
      verbose,
      queryIpLocation,
    });

    const { parsed_requirement, master_lists, primary_query, splitting_strategy, final_query_set, metadata } = result;

    console.log('🔍 Stage 1: Parsing and classifying requirement...');
    console.log(`✅ Stage 1 Complete (${metadata.agent1_time_ms}ms)`);
    console.log(`   Query Type: ${parsed_requirement.query_type} - ${parsed_requirement.query_type_description}`);
    console.log(`   Companies: ${parsed_requirement.target_companies.length} found`);
    console.log(`   Domain Expertise: ${parsed_requirement.domain_expertise.join(', ')}`);
    console.log('');

    console.log('📋 Stage 2: Generating master lists...');
    console.log(`✅ Stage 2 Complete (${metadata.agent2_time_ms}ms)`);
    console.log(`   Keyword terms: ${master_lists.keywords.term_count}`);
    console.log(`   Job title terms: ${master_lists.job_titles.term_count}`);
    console.log(`   Use company filter: ${master_lists.companies.use_company_filter}`);
    console.log(`   Companies: ${master_lists.companies.all_companies.length}`);
    console.log('');

    console.log('🔨 Stage 3: Constructing query set...');
    console.log(`✅ Stage 3 Complete (${metadata.agent3_time_ms}ms)`);
    console.log(
      `   Primary query terms: Keywords=${primary_query.term_counts.keywords}, Job Title=${primary_query.term_counts.job_title}`,
    );
    console.log(`   Splitting needed: ${primary_query.needs_splitting}`);
    console.log(
      `   Strategy: ${splitting_strategy.strategy_type} - ${splitting_strategy.strategy_description}`,
    );
    console.log(`   Final queries: ${final_query_set.search_query_set.length}`);
    console.log('');

    console.log('✨ Generation Complete!');
    console.log(`⏱️  Total time: ${metadata.processing_time_ms}ms`);
    console.log(`📊 Generated ${metadata.total_queries_generated} search queries`);
    console.log('');

    const validation = service.validateQuerySet(final_query_set);

    console.log('📊 Validation Results:');
    console.log(`   Valid: ${validation.valid ? '✅' : '❌'}`);
    if (validation.errors.length > 0) {
      console.log('   Errors:');
      validation.errors.forEach((err) => console.log(`     ❌ ${err}`));
    }
    if (validation.warnings.length > 0) {
      console.log('   Warnings:');
      validation.warnings.forEach((warn) => console.log(`     ⚠️  ${warn}`));
    }

    console.log('\n📋 Final Query Set:');
    console.log(JSON.stringify(final_query_set, null, 2));

    return { result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Test failed:', message);
    return { error: message };
  }
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_KEY) {
    console.error('\n❌ ERROR: OPENAI_KEY environment variable is required');
    console.error('   Set it with: export OPENAI_KEY=your_key_here');
    process.exit(1);
  }

  console.log('🤖 Using OpenAI API');
  console.log('🚀 Running all test cases...\n');

  const app = await Test.createTestingModule({
    imports: [LinkedinQueryGenerationModule],
  }).compile();

  const service = app.get(LinkedinQueryGenerationService);

  const outputDir = path.join(process.cwd(), 'test-results', 'linkedin-query-generation');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const testId = process.env.TEST_ID ? parseInt(process.env.TEST_ID, 10) : null;
  const testCases = testId
    ? TEST_REQUIREMENTS.filter((t) => t.id === testId)
    : TEST_REQUIREMENTS;

  if (testId && testCases.length === 0) {
    console.error(`❌ Test case ${testId} not found`);
    process.exit(1);
  }

  const results: Array<{
    test_case: TestCase;
    result?: Awaited<ReturnType<LinkedinQueryGenerationService['generateSearchQuerySet']>>;
    error?: string;
    status: 'success' | 'failed';
  }> = [];
  const startTime = Date.now();

  for (const testCase of testCases) {
    const outcome = await runSingleTest(testCase, service);

    if ('result' in outcome) {
      results.push({ test_case: testCase, result: outcome.result, status: 'success' });

      const filename = path.join(
        outputDir,
        `test_${testCase.id}_${testCase.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
      );
      fs.writeFileSync(filename, JSON.stringify(outcome.result, null, 2));
      console.log(`💾 Saved: ${filename}\n`);
    } else {
      results.push({ test_case: testCase, error: outcome.error, status: 'failed' });
    }
  }

  const totalTime = Date.now() - startTime;
  const summary = {
    total_tests: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    total_time_ms: totalTime,
    average_time_ms: totalTime / results.length,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify({ summary, results }, null, 2),
  );

  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  console.log(`Total tests: ${summary.total_tests}`);
  console.log(`✅ Successful: ${summary.successful}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⏱️  Total time: ${summary.total_time_ms}ms`);
  console.log(`⏱️  Average time: ${summary.average_time_ms.toFixed(2)}ms`);
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
