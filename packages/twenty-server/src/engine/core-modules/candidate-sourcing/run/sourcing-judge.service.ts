import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  buildJudgeFlags,
  buildJudgeModelFields,
  buildJudgePrompt,
  JUDGE_COST_PER_ROW_USD,
  JUDGE_LEVEL_KEY,
  JUDGE_OUTCOME_KEY,
  JUDGE_QUESTIONS_KEY,
  JUDGE_SCORE_KEY,
  JUDGE_VERDICTS_KEY,
  judgeFlagHash,
  parseJudgeAnswer,
  rollUpJudgement,
  shouldTriageBeforeJudge,
  type JudgeEvidenceLevel,
  type JudgeFlag,
  type JudgeOutcome,
  type JudgeResult,
  type JudgeVerdict,
} from 'src/engine/core-modules/candidate-sourcing/run/judge.util';
import { triageRow } from 'src/engine/core-modules/candidate-sourcing/run/triage.util';
import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';
import { getFitmentThreshold } from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-threshold.util';
import {
  toRecordForModel,
  wholeRecordFields,
} from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import {
  OutreachTabService,
  type OutreachTabRow,
} from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { normalizeLinkedinProfileKey } from 'src/engine/core-modules/outreach-command/utils/person-identity.util';
import {
  SOURCING_REJECTED_BY_KEY,
  SOURCING_STAGE_KEY,
  type SourcingRejection,
  type SourcingStage,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-pool.util';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';
import { JEV_OPENROUTER_MODEL_ID } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';

// A verdict on one flag for one person at one evidence level does not go
// stale within a hiring cycle; the company x role pair cache keeps a year too
const VERDICT_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// Row keys the judge writes, so they never leak into the next judgement
const JUDGE_OWN_KEYS = [
  JUDGE_OUTCOME_KEY,
  JUDGE_SCORE_KEY,
  JUDGE_LEVEL_KEY,
  JUDGE_VERDICTS_KEY,
  JUDGE_QUESTIONS_KEY,
  SOURCING_STAGE_KEY,
  SOURCING_REJECTED_BY_KEY,
  'sourcingProvenance',
  'fitmentOutcome',
  'fitmentScore',
  'fitmentReason',
];

export type SourcingJudgeRun = {
  results: Map<string, JudgeResult>;
  counts: Record<JudgeOutcome, number>;
  // Rows the model was asked about; cached rows cost nothing
  modelRows: number;
  cachedRows: number;
  triaged: number;
  costUsd: number;
};

const stageOf = (
  outcome: JudgeOutcome,
  level: JudgeEvidenceLevel,
): SourcingStage | undefined => {
  switch (outcome) {
    case 'fail':
      return 'rejected';
    case 'qualified':
    case 'to_confirm':
      return 'verified';
    case 'unknown':
      return level === 'full' ? 'full' : undefined;
  }
};

// An unparseable URL yields no key, so it falls back to name and employer
// rather than sharing one cache entry across people
const personKeyOf = (row: OutreachTabRow): string => {
  const linkedinKey = isNonEmptyString(row.linkedinUrl)
    ? normalizeLinkedinProfileKey(row.linkedinUrl)
    : '';

  return isNonEmptyString(linkedinKey)
    ? linkedinKey
    : `${row.name}|${row.companyName ?? ''}`.trim().toLowerCase();
};

@Injectable()
export class SourcingJudgeService {
  private readonly logger = new Logger(SourcingJudgeService.name);

  constructor(
    private readonly aiFilterEngineService: AiFilterEngineService,
    private readonly outreachTabService: OutreachTabService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private verdictKey(
    workspaceId: string,
    personKey: string,
    flag: JudgeFlag,
    level: JudgeEvidenceLevel,
  ): string {
    return `sourcing-verdict:${workspaceId}:${personKey}:${judgeFlagHash(flag)}:${level}`;
  }

  // Judges the rows, writes outcome, verdicts, questions and stage onto the
  // People tab in one queued write, and returns what the stop rules need
  async judgeRows({
    workspaceId,
    projectId,
    rows,
    spec,
    level,
    request,
  }: {
    workspaceId: string;
    projectId: string;
    rows: OutreachTabRow[];
    spec: SourcingSpec;
    level: JudgeEvidenceLevel;
    request?: string;
  }): Promise<SourcingJudgeRun> {
    const flags = buildJudgeFlags(spec);
    const threshold = getFitmentThreshold();
    const run: SourcingJudgeRun = {
      results: new Map(),
      counts: { qualified: 0, unknown: 0, to_confirm: 0, fail: 0 },
      modelRows: 0,
      cachedRows: 0,
      triaged: 0,
      costUsd: 0,
    };
    const valuesByRowId = new Map<string, Record<string, unknown>>();
    const now = new Date().toISOString();

    let toJudge = rows;

    if (shouldTriageBeforeJudge(rows.length)) {
      toJudge = [];

      for (const row of rows) {
        const verdict = triageRow(row, spec);

        if (verdict.pass) {
          toJudge.push(row);
          continue;
        }

        run.triaged += 1;
        valuesByRowId.set(row.id, {
          [SOURCING_STAGE_KEY]: 'rejected',
          [SOURCING_REJECTED_BY_KEY]: {
            by: 'triage',
            flags: verdict.missed,
            at: now,
          } satisfies SourcingRejection,
        });
      }
    }

    const verdictsByRow = await this.collectVerdicts({
      workspaceId,
      rows: toJudge,
      flags,
      level,
      request,
      run,
    });

    for (const row of toJudge) {
      const verdicts = verdictsByRow.get(row.id) ?? {};
      const result = rollUpJudgement({ flags, verdicts, level, threshold });
      const stage = stageOf(result.outcome, level);

      run.results.set(row.id, result);
      run.counts[result.outcome] += 1;
      valuesByRowId.set(row.id, {
        [JUDGE_OUTCOME_KEY]: result.outcome,
        [JUDGE_SCORE_KEY]: Math.round(result.score * 100),
        [JUDGE_LEVEL_KEY]: level,
        [JUDGE_VERDICTS_KEY]: Object.fromEntries(
          Object.entries(verdicts).map(([key, verdict]) => [
            key,
            verdict?.settledBy !== undefined
              ? `${verdict.verdict}:${verdict.settledBy}`
              : verdict?.verdict,
          ]),
        ),
        ...(result.questions.length > 0 && {
          [JUDGE_QUESTIONS_KEY]: result.questions,
        }),
        ...(stage !== undefined && { [SOURCING_STAGE_KEY]: stage }),
        ...(result.outcome === 'fail' && {
          [SOURCING_REJECTED_BY_KEY]: {
            by: 'judge',
            flags: [...result.failedMustHaves, ...result.confirmedRedFlags],
            at: now,
          } satisfies SourcingRejection,
        }),
      });
    }

    if (valuesByRowId.size > 0) {
      await this.outreachTabService.writeOtherFields({
        workspaceId,
        projectId,
        tab: 'people',
        valuesByRowId,
      });
    }

    return run;
  }

  // Cached verdicts first; the model is asked only about the flags a row has
  // no verdict for, and rows that miss the same flags share one request shape
  private async collectVerdicts({
    workspaceId,
    rows,
    flags,
    level,
    request,
    run,
  }: {
    workspaceId: string;
    rows: OutreachTabRow[];
    flags: JudgeFlag[];
    level: JudgeEvidenceLevel;
    request?: string;
    run: SourcingJudgeRun;
  }): Promise<Map<string, Record<string, JudgeVerdict>>> {
    const verdictsByRow = new Map<string, Record<string, JudgeVerdict>>();
    const missingByShape = new Map<
      string,
      { flags: JudgeFlag[]; rows: OutreachTabRow[] }
    >();

    for (const row of rows) {
      const personKey = personKeyOf(row);
      const verdicts: Record<string, JudgeVerdict> = {};
      const missing: JudgeFlag[] = [];

      for (const flag of flags) {
        const cached = await this.cache
          .get<JudgeVerdict>(
            this.verdictKey(workspaceId, personKey, flag, level),
          )
          .catch(() => undefined);

        if (cached !== undefined && cached !== null) {
          verdicts[flag.key] = cached;
        } else {
          missing.push(flag);
        }
      }

      verdictsByRow.set(row.id, verdicts);

      if (missing.length === 0) {
        run.cachedRows += 1;
        continue;
      }

      const shape = missing.map((flag) => flag.key).join('|');
      const group = missingByShape.get(shape) ?? { flags: missing, rows: [] };

      group.rows.push(row);
      missingByShape.set(shape, group);
    }

    for (const group of missingByShape.values()) {
      const records = group.rows.map(toRecordForModel);
      const spec: FilterSpec = {
        name: 'sourcing-judge',
        subject: 'person',
        criteria: buildJudgePrompt({ flags: group.flags, level, request }),
        fields: buildJudgeModelFields(group.flags),
        model: JEV_OPENROUTER_MODEL_ID,
        metadataFields: wholeRecordFields({
          records,
          preferredFields: [
            'name',
            'title',
            'headline',
            'companyName',
            'location',
          ],
          excludedFields: JUDGE_OWN_KEYS,
        }),
        allowUnknown: true,
      };

      try {
        const { verdicts } = await this.aiFilterEngineService.run(
          records,
          spec,
        );
        const rowById = new Map(group.rows.map((row) => [row.id, row]));

        run.modelRows += group.rows.length;

        for (const verdict of verdicts) {
          const row = rowById.get(verdict.id);

          if (row === undefined || verdict.status !== 'answered') {
            continue;
          }

          const rowVerdicts = verdictsByRow.get(row.id) ?? {};
          const personKey = personKeyOf(row);

          for (const flag of group.flags) {
            const parsed = parseJudgeAnswer(verdict.answers[flag.key]);

            rowVerdicts[flag.key] = parsed;
            await this.cache
              .set(
                this.verdictKey(workspaceId, personKey, flag, level),
                parsed,
                VERDICT_CACHE_TTL_MS,
              )
              .catch(() => undefined);
          }

          verdictsByRow.set(row.id, rowVerdicts);
        }
      } catch (error) {
        // An unanswered row stays unknown: it is judged again next round
        this.logger.warn(
          `Sourcing judge call failed for ${group.rows.length} rows: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    run.costUsd = run.modelRows * JUDGE_COST_PER_ROW_USD;

    return verdictsByRow;
  }
}
