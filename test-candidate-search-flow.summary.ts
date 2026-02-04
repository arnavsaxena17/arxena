import type { TestResult } from './test-candidate-search-flow.types';

export function countUrlsGenerated(results: TestResult[]): number {
  return results.reduce((count, r) => {
    if (!r.linkedInUrls) return count;
    return (
      count +
      Object.values(r.linkedInUrls).reduce((urlCount, url) => {
        if (url === null) return urlCount;
        if (Array.isArray(url)) return urlCount + url.filter((u) => u !== null).length;
        return urlCount + 1;
      }, 0)
    );
  }, 0);
}

export function countCandidatesFound(results: TestResult[]): number {
  return results.reduce((count, r) => {
    if (!r.searchResults) return count;
    return (
      count +
      Object.values(r.searchResults).reduce((resultCount, result) => {
        if (result && result.itemCount) return resultCount + result.itemCount;
        return resultCount;
      }, 0)
    );
  }, 0);
}

export function countValidationPages(results: TestResult[]): number {
  return results.reduce((count, r) => {
    if (!r.validationResults) return count;
    return (
      count +
      Object.values(r.validationResults).reduce((validationCount, validations) => {
        if (validations && Array.isArray(validations))
          return validationCount + validations.length;
        return validationCount;
      }, 0)
    );
  }, 0);
}

export function countScoredCandidates(results: TestResult[]): number {
  return results.reduce((count, r) => {
    if (!r.candidateScores) return count;
    return (
      count +
      Object.values(r.candidateScores).reduce((scoreCount, scores) => {
        if (scores && Array.isArray(scores)) return scoreCount + scores.length;
        return scoreCount;
      }, 0)
    );
  }, 0);
}

export function printSummary(
  results: TestResult[],
  requirementCount: number,
  totalTime: number,
): void {
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Raw Queries: ${requirementCount}`);
  console.log(`Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`Average Time per Query: ${(totalTime / requirementCount).toFixed(0)}ms`);

  const successful = results.filter(
    (r) =>
      !r.error &&
      (r.unresolvedParameters || r.resolvedParameters) &&
      (Object.keys(r.unresolvedParameters ?? {}).length > 0 ||
        Object.keys(r.resolvedParameters ?? {}).length > 0),
  );
  const failed = results.filter(
    (r) =>
      r.error ||
      (!r.unresolvedParameters && !r.resolvedParameters) ||
      (Object.keys(r.unresolvedParameters ?? {}).length === 0 &&
        Object.keys(r.resolvedParameters ?? {}).length === 0),
  );

  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`🔗 LinkedIn URLs Generated: ${countUrlsGenerated(results)}`);
  console.log(`🔍 Candidates Found: ${countCandidatesFound(results)}`);
  console.log(`✅ Validation Results: ${countValidationPages(results)} page(s)`);
  console.log(`⭐ Candidates Scored: ${countScoredCandidates(results)}`);

  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));
  console.log(JSON.stringify(results, null, 2));
  console.log('\n' + '='.repeat(80));
  console.log('Test completed!');
  console.log('='.repeat(80));
}
