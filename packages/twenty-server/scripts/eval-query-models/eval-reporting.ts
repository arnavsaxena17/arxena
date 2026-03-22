import { ALL_MODELS, type PromptMode, type SearchType } from './constants';
import type { EvalModel, EvalRequirement, OverallSummary, RunResult } from './eval-types';
import type { AnySearchRequest } from './schemas';
import { EVAL_MODEL, type ScoreBreakdown } from './scoring';

const DIM_LABELS: Record<SearchType, [string, string, string, string, string, string]> = {
  recruiter:       ['Stem/3', 'Filt/4', 'Cov/2', 'Sig/1', 'Loc/2', 'KwD/2'],
  sales_navigator: ['Stem/3', 'Filt/4', 'Cov/2', 'Sig/1', 'Loc/2', 'KwD/2'],
  classic:         ['KwQ/3',  'Filt/4', 'Cov/2', 'Sig/1', 'Loc/2', 'KwD/2'],
};

export function printModelTable(
  title: string,
  models: typeof ALL_MODELS,
  results: RunResult[],
  searchType: SearchType,
  promptMode?: PromptMode,
): void {
  const W = 100;
  const labels = DIM_LABELS[searchType];
  console.log(`\n${'═'.repeat(W)}`);
  console.log(`${title}   [${searchType.toUpperCase()}]`);
  console.log('─'.repeat(W));
  console.log(
    'Model'.padEnd(26) +
    'Score/14'.padStart(10) +
    labels[0].padStart(9)  +
    labels[1].padStart(9)  +
    labels[2].padStart(8)  +
    labels[3].padStart(8)  +
    labels[4].padStart(7)  +
    labels[5].padStart(7)  +
    'Errs'.padStart(6) +
    'AvgMs'.padStart(8) +
    'Cost/req'.padStart(11) +
    'Cost/1k'.padStart(11),
  );
  console.log('─'.repeat(W));

  const summaries = models.map(model => {
    const mr = results.filter(r =>
      r.modelId === model.id &&
      r.searchType === searchType &&
      (promptMode == null || r.promptMode === promptMode),
    );
    const scored = mr.filter(r => r.score !== null);
    const errors = mr.filter(r => r.error !== null).length;
    const totalCost = mr.reduce((s, r) => s + r.costUsd, 0);
    if (scored.length === 0) return { model, avg: null, errors, avgMs: 0, avgCost: 0, totalCost };
    const avg: ScoreBreakdown = {
      dim1:  scored.reduce((s, r) => s + (r.score?.dim1 ?? 0), 0) / scored.length,
      dim2:  scored.reduce((s, r) => s + (r.score?.dim2 ?? 0), 0) / scored.length,
      dim3:  scored.reduce((s, r) => s + (r.score?.dim3 ?? 0), 0) / scored.length,
      dim4:  scored.reduce((s, r) => s + (r.score?.dim4 ?? 0), 0) / scored.length,
      dim5:  scored.reduce((s, r) => s + (r.score?.dim5 ?? 0), 0) / scored.length,
      dim6:  scored.reduce((s, r) => s + (r.score?.dim6 ?? 0), 0) / scored.length,
      total: scored.reduce((s, r) => s + (r.score?.total ?? 0), 0) / scored.length,
    };
    const avgMs   = mr.reduce((s, r) => s + r.durationMs, 0) / mr.length;
    const avgCost = totalCost / mr.length;
    return { model, avg, errors, avgMs, avgCost, totalCost };
  });

  summaries.sort((a, b) => (b.avg?.total ?? -1) - (a.avg?.total ?? -1));

  for (const { model, avg, errors, avgMs, avgCost, totalCost } of summaries) {
    if (!avg) {
      console.log(`${model.label.padEnd(26)}  ALL ERRORS  cost=$${totalCost.toFixed(5)}`);
      continue;
    }
    console.log(
      model.label.padEnd(26) +
      avg.total.toFixed(1).padStart(10) +
      avg.dim1.toFixed(1).padStart(9)   +
      avg.dim2.toFixed(1).padStart(9)   +
      avg.dim3.toFixed(1).padStart(8)   +
      avg.dim4.toFixed(1).padStart(8)   +
      avg.dim5.toFixed(1).padStart(7)   +
      avg.dim6.toFixed(1).padStart(7)   +
      String(errors).padStart(6) +
      `${Math.round(avgMs)}ms`.padStart(8) +
      `$${avgCost.toFixed(5)}`.padStart(11) +
      `$${(avgCost * 1000).toFixed(2)}`.padStart(11),
    );
  }
  console.log('─'.repeat(W));
}

export function computeOverallSummaries(models: EvalModel[], results: RunResult[]): OverallSummary[] {
  const rows = models.map(model => {
    const mr = results.filter(r => r.modelId === model.id);
    const scored = mr.filter(r => r.score !== null);
    const errors = mr.filter(r => r.error !== null).length;
    const totalCost = mr.reduce((s, r) => s + r.costUsd, 0);
    if (scored.length === 0) return { model, avgTotal: null, errors, avgMs: 0, avgCost: 0 };
    const avgTotal = scored.reduce((s, r) => s + (r.score?.total ?? 0), 0) / scored.length;
    const avgMs    = mr.reduce((s, r) => s + r.durationMs, 0) / mr.length;
    const avgCost  = totalCost / mr.length;
    return { model, avgTotal, errors, avgMs, avgCost };
  });
  rows.sort((a, b) => (b.avgTotal ?? -1) - (a.avgTotal ?? -1));
  return rows;
}

export function printOverallModelRanking(overallSummaries: OverallSummary[]): void {
  const W = 100;
  console.log(`\n${'═'.repeat(W)}`);
  console.log('OVERALL MODEL RANKING  (avg across all search types × all requirements)');
  console.log('─'.repeat(W));
  console.log(
    'Model'.padEnd(26) + 'OverallScore'.padStart(14) + 'Errs'.padStart(6) +
    'AvgMs'.padStart(8) + 'Cost/req'.padStart(11) + 'Cost/1k'.padStart(11),
  );
  console.log('─'.repeat(W));

  overallSummaries.forEach(({ model, avgTotal, errors, avgMs, avgCost }, rank) => {
    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '  ';
    if (avgTotal === null) {
      console.log(`  ${medal} ${model.label.padEnd(24)}  ALL ERRORS`);
    } else {
      console.log(
        `  ${medal} ${model.label.padEnd(24)}` +
        avgTotal.toFixed(1).padStart(14) +
        String(errors).padStart(6) +
        `${Math.round(avgMs)}ms`.padStart(8) +
        `$${avgCost.toFixed(5)}`.padStart(11) +
        `$${(avgCost * 1000).toFixed(2)}`.padStart(11),
      );
    }
  });
  console.log('─'.repeat(W));
}

export function printPerRequirementScores(
  reqs: EvalRequirement[],
  searchTypes: SearchType[],
  results: RunResult[],
): void {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('PER-REQUIREMENT × PER-TYPE SCORES  (best model per cell)');
  console.log('─'.repeat(70));

  for (const req of reqs) {
    console.log(`\n  ${req.label}`);
    for (const st of searchTypes) {
      const reqResults = results
        .filter(r => r.reqId === req.id && r.searchType === st)
        .sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1));
      const best = reqResults[0];
      if (best?.score) {
        const s = best.score;
        process.stdout.write(`    [${st.padEnd(15)}] best: ${best.modelLabel.padEnd(20)}  ${s.total}/14`);
        process.stdout.write(`  (d1=${s.dim1.toFixed(0)} d2=${s.dim2.toFixed(0)} d3=${s.dim3.toFixed(0)} d4=${s.dim4.toFixed(0)} d5=${s.dim5.toFixed(0)} d6=${s.dim6.toFixed(0)})\n`);
      } else {
        console.log(`    [${st.padEnd(15)}] best: ${best?.modelLabel ?? 'N/A'}  ALL ERRORS`);
      }
    }
  }
}

export function printTokenUsageSummary(
  models: EvalModel[],
  results: RunResult[],
  overallSummaries: OverallSummary[],
): void {
  const W = 100;
  const totalEvalCost = results.reduce((s, r) => s + r.evalCostUsd, 0);
  console.log(`\n${'═'.repeat(W)}`);
  console.log(`TOKEN USAGE  (generation cost + LLM eval cost via ${EVAL_MODEL})`);
  console.log('─'.repeat(W));
  console.log(
    'Model'.padEnd(26) +
    'TotalIn'.padStart(10) + 'Cached'.padStart(9) + 'TotalOut'.padStart(10) +
    'GenCost'.padStart(12) + 'EvalCost'.padStart(12) +
    'TotalCost'.padStart(12) + 'per-1k-reqs'.padStart(14),
  );
  console.log('─'.repeat(W));
  for (const { model, avgCost } of overallSummaries) {
    const mr          = results.filter(r => r.modelId === model.id);
    const totalIn     = mr.reduce((s, r) => s + r.inputTokens,   0);
    const totalCached = mr.reduce((s, r) => s + r.cachedTokens,  0);
    const totalOut    = mr.reduce((s, r) => s + r.outputTokens,  0);
    const genCost     = mr.reduce((s, r) => s + r.costUsd,       0);
    const evalCost    = mr.reduce((s, r) => s + r.evalCostUsd,   0);
    const fullCost    = genCost + evalCost;
    const perK        = (avgCost ?? 0) * 1000;
    const cacheStr    = totalIn > 0 && totalCached > 0
      ? `${totalCached}(${Math.round(totalCached / totalIn * 100)}%)`
      : String(totalCached);
    console.log(
      model.label.padEnd(26) +
      String(totalIn).padStart(10) +
      cacheStr.padStart(9) +
      String(totalOut).padStart(10) +
      `$${genCost.toFixed(4)}`.padStart(12) +
      `$${evalCost.toFixed(4)}`.padStart(12) +
      `$${fullCost.toFixed(4)}`.padStart(12) +
      `$${perK.toFixed(2)}/1k`.padStart(14),
    );
  }
  console.log(`  Eval model (${EVAL_MODEL}) total: $${totalEvalCost.toFixed(4)} for ${results.length} scored queries`);
  console.log(`${'═'.repeat(W)}\n`);
}

// Short display names for search types and prompt modes in the comparison table
const ST_ABBREV: Record<SearchType, string> = {
  recruiter:       'Recruiter',
  sales_navigator: 'SalesNav',
  classic:         'Classic',
};
const PM_ABBREV: Record<PromptMode, string> = {
  detailed: 'det',
  simple:   'sim',
  agent:    'agt',
};
const COL_SCORE = 7;  // per-mode score column width
const COL_DELTA = 6;  // Δ vs detailed column width

function centreInWidth(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  const pad = w - s.length;
  const left  = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

export function printPromptComparisonTable(
  models: EvalModel[],
  results: RunResult[],
  searchTypes: SearchType[],
): void {
  // Determine which prompt modes are actually present in the results
  const activeModes = (['detailed', 'simple', 'agent'] as PromptMode[]).filter(pm =>
    results.some(r => r.promptMode === pm),
  );

  // Each search-type group = (score col × nModes) + (Δ col × (nModes-1)) + 1 gap
  const nModes = activeModes.length;
  const groupW = nModes * COL_SCORE + (nModes - 1) * COL_DELTA + 1;
  const MODEL_W = 26;
  const W = MODEL_W + searchTypes.length * groupW;

  console.log(`\n${'═'.repeat(W)}`);
  console.log('PROMPT COMPARISON  (avg score/14 per model × search type × prompt mode)');
  console.log('─'.repeat(W));

  // Line 1: search type group headers
  const line1 = ' '.repeat(MODEL_W) +
    searchTypes.map(st => centreInWidth(ST_ABBREV[st], groupW)).join('');

  // Line 2: mode sub-headers (score cols) + Δ headers
  const line2 = ' '.repeat(MODEL_W) +
    searchTypes.map(() => {
      let s = '';
      for (let i = 0; i < activeModes.length; i++) {
        s += PM_ABBREV[activeModes[i]].padStart(COL_SCORE);
        if (i < activeModes.length - 1) s += 'Δ'.padStart(COL_DELTA);
      }
      s += ' ';
      return s;
    }).join('');

  console.log(line1);
  console.log(line2);
  console.log('─'.repeat(W));

  const avg = (rs: RunResult[]) =>
    rs.length === 0 ? null : rs.reduce((s, r) => s + (r.score?.total ?? 0), 0) / rs.length;

  for (const model of models) {
    let row = model.label.padEnd(MODEL_W);
    for (const st of searchTypes) {
      const modeAvgs = activeModes.map(pm =>
        avg(results.filter(r => r.modelId === model.id && r.searchType === st && r.promptMode === pm && r.score !== null)),
      );
      const baseline = modeAvgs[0]; // detailed (or whatever is first)

      for (let i = 0; i < activeModes.length; i++) {
        const v = modeAvgs[i];
        row += (v != null ? v.toFixed(1) : 'N/A').padStart(COL_SCORE);
        if (i < activeModes.length - 1) {
          const delta = v != null && baseline != null && i > 0 ? v - baseline : null;
          row += (delta != null ? (delta >= 0 ? '+' : '') + delta.toFixed(1) : '─').padStart(COL_DELTA);
        }
      }
      row += ' ';
    }
    console.log(row);
  }
  console.log('─'.repeat(W));
  console.log('  Δ = mode − detailed  (positive = that mode is better than detailed)\n');
}

export function printSampleQueriesBySearchType(
  searchTypes: SearchType[],
  models: EvalModel[],
  reqs: EvalRequirement[],
  results: RunResult[],
): void {
  for (const st of searchTypes) {
    const stResults = results.filter(r => r.searchType === st && r.score !== null);
    if (stResults.length === 0) continue;
    const byModel = models.map(m => ({
      model: m,
      avg: stResults.filter(r => r.modelId === m.id).reduce((s, r) => s + (r.score?.total ?? 0), 0) /
           (stResults.filter(r => r.modelId === m.id).length || 1),
    })).sort((a, b) => b.avg - a.avg);
    const bestModel = byModel[0];
    if (!bestModel) continue;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`SAMPLE QUERIES [${st.toUpperCase()}] — BEST MODEL: ${bestModel.model.label}  (avg ${bestModel.avg.toFixed(1)}/14)`);
    console.log('═'.repeat(70));
    for (const req of reqs.slice(0, 3)) {
      const r = results.find(x => x.modelId === bestModel.model.id && x.reqId === req.id && x.searchType === st);
      if (!r || r.error || r.queries.length === 0) continue;
      console.log(`\n  [${req.label}]`);
      r.queries.forEach((q, i) => {
        const { api: _a, category: _c, ...clean } = q as AnySearchRequest & { api?: string; category?: string };
        console.log(`  Query ${i + 1}:`);
        console.log('  ' + JSON.stringify(clean, null, 2).split('\n').join('\n  '));
      });
    }
  }
}
