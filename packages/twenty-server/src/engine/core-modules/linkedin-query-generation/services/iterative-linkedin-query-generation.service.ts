import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import type {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { mapLinkedinSearchQueriesToGeneratedParameters } from 'src/engine/core-modules/candidate-search/utils/linkedin-query-generation-mapper.util';
import {
  buildIterativeQueryRefinerUserPrompt,
  ITERATIVE_QUERY_REFINER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/iterative-query-refiner.prompt';
import {
  buildIterativeQueryVerifierUserPrompt,
  ITERATIVE_QUERY_VERIFIER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/iterative-query-verifier.prompt';
import {
  buildIterativeTargetProfileUserPrompt,
  ITERATIVE_TARGET_PROFILE_SYSTEM_PROMPT,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/iterative-target-profile.prompt';
import {
  iterativeQueryRefinerSchema,
  queryVerificationResultSchema,
  targetProfileSetSchema,
  type TargetProfileSet,
} from 'src/engine/core-modules/linkedin-query-generation/schemas';
import {
  IterativeGenerationMode,
  IterativeQueryCandidate,
  IterativeQuerySetResult,
  LivePreviewQueryResult,
  LivePreviewResult,
  OrchestratorResult,
  QueryIteration,
  QueryVerificationFinding,
  QueryVerificationResult,
  RankedAlternativeQuerySet,
  SearchQuery,
  SearchQuerySet,
  TargetProfilePreviewItem,
  TargetProfileValidationPreview,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type { LinkedInSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { LinkedinQueryGenerationService } from './linkedin-query-generation.service';

type PeopleSearchType = 'classic' | 'sales_navigator' | 'recruiter';

type IterativeOptions = {
  mode?: IterativeGenerationMode;
  searchType?: PeopleSearchType;
  queryIpLocation?: string;
  model?: string;
  temperature?: number;
  maxIterations?: number;
  returnAlternatives?: boolean;
  verbose?: boolean;
  apiToken?: string;
  onProgress?: (message: string) => void;
};

type StrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type CandidateEvaluation = {
  verification: QueryVerificationResult;
  livePreview: LivePreviewResult | null;
  finalScore: number;
};

type LlmOptions = {
  model?: string;
  temperature?: number;
};

@Injectable()
export class IterativeLinkedinQueryGenerationService {
  private readonly logger = new Logger(
    IterativeLinkedinQueryGenerationService.name,
  );
  private readonly improvementThreshold = 0.02;
  private readonly goodEnoughThreshold = 0.82;
  private readonly siblingOverlapCeiling = 0.38;
  private readonly minimumSuiteQueryCount = 2;
  private readonly minimumSuiteCoverageScore = 0.55;
  private readonly defaultModel =
    process.env.SEARCH_QUERY_GENERATOR_MODEL ||
    process.env.SEARCH_MODELS_OPENAI_MODEL ||
    'gpt-4o-mini';

  constructor(
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly resultValidationService: ResultValidationService,
  ) {}

  async generateIterativeSearchQuerySet(
    rawRequirement: string,
    options: IterativeOptions = {},
  ): Promise<IterativeQuerySetResult> {
    options.onProgress?.('Building initial LinkedIn query seed...');
    const mode = options.mode ?? 'offline';
    const maxIterations = Math.min(Math.max(options.maxIterations ?? 4, 1), 4);
    const searchType = options.searchType ?? 'classic';
    const returnAlternatives = options.returnAlternatives ?? true;
    const llmOptions: LlmOptions = {
      model: options.model,
      temperature: options.temperature,
    };

    const seedResult =
      await this.linkedinQueryGenerationService.generateSearchQuerySet(
        rawRequirement,
        {
          queryIpLocation: options.queryIpLocation,
          model: options.model,
          temperature: options.temperature,
          verbose: options.verbose,
        },
      );

    console.log(`Seed result generated from the OG linkedin query generation service, generate search query set: ${JSON.stringify(seedResult, null, 2)}`)

    options.onProgress?.('Generating target candidate archetypes...');
    const targetProfiles = await this.generateTargetProfiles(
      rawRequirement,
      seedResult,
      llmOptions,
    );
    const targetProfilePreview = this.buildTargetProfileValidationPreview(
      rawRequirement,
      targetProfiles,
    );
    
    console.log(`Target profiles generated from the OG linkedin query generation service, generate search query set: ${JSON.stringify(targetProfiles, null, 2)}`)


    const iterations: QueryIteration[] = [];
    const rankedCandidates = new Map<string, IterativeQueryCandidate>();
    let currentCandidates = this.buildSeedCandidates(seedResult, targetProfiles);

    console.log(`The current candidates are :: ${JSON.stringify(currentCandidates, null, 2)}`)
    let bestCandidate: IterativeQueryCandidate | null = null;
    let previousBestScore: number | null = null;
    let terminationReason:
      | 'max_iterations_reached'
      | 'good_enough'
      | 'no_meaningful_improvement' = 'max_iterations_reached';
    let livePreviewFallbackReason: string | null = null;
    let livePreviewUsed = false;

    for (let round = 1; round <= maxIterations; round += 1) {
      options.onProgress?.(
        `Evaluating iterative query candidates in round ${round}/${maxIterations}...`,
      );
      const evaluatedCandidates: IterativeQueryCandidate[] = [];

      for (const candidate of currentCandidates) {
        options.onProgress?.(`Scoring query candidate: ${candidate.label}`);
        const evaluation = await this.evaluateCandidate(
          rawRequirement,
          candidate,
          seedResult,
          targetProfiles,
          llmOptions,
          {
            mode,
            searchType,
            apiToken: options.apiToken,
          },
        );

        console.log(`Evaluation for candidate :: ${candidate.label} is :: ${JSON.stringify(evaluation, null, 2)}`)
        if (
          mode === 'live' &&
          evaluation.livePreview?.attempted &&
          evaluation.livePreview.succeeded
        ) {
          livePreviewUsed = true;
        }

        if (
          mode === 'live' &&
          evaluation.livePreview?.attempted &&
          !evaluation.livePreview.succeeded &&
          !livePreviewFallbackReason
        ) {
          livePreviewFallbackReason =
            evaluation.livePreview.fallback_reason ?? 'Live preview unavailable';
        }




        const evaluated: IterativeQueryCandidate = {
          ...candidate,
          score: evaluation.finalScore,
          summary: evaluation.verification.summary,
          verification_result: {
            ...evaluation.verification,
            score: evaluation.finalScore,
          },
          live_preview: evaluation.livePreview,
        };
        console.log(`Evaluated candidate :: ${JSON.stringify(evaluated, null, 2)}`)

        evaluatedCandidates.push(evaluated);
        rankedCandidates.set(evaluated.candidate_id, evaluated);
      }

      console.log(`Evaluated candidates :: ${JSON.stringify(evaluatedCandidates, null, 2)}`)

      evaluatedCandidates.sort((left, right) =>
        this.compareCandidatesForSelection(left, right),
      );
      console.log(`Sorted evaluated candidates :: ${JSON.stringify(evaluatedCandidates, null, 2)}`)
      const roundWinner = evaluatedCandidates[0];
      console.log(`Round winner :: ${JSON.stringify(roundWinner, null, 2)}`)
      options.onProgress?.(
        `Round ${round} best candidate: ${roundWinner.label} (score ${roundWinner.score.toFixed(2)})`,
      );
      const improvement =
        previousBestScore === null ? null : roundWinner.score - previousBestScore;
      console.log(`Improvement :: ${JSON.stringify(improvement, null, 2)}`)
      iterations.push({
        round,
        candidates: evaluatedCandidates,
        winner_candidate_id: roundWinner.candidate_id,
        winner_score: roundWinner.score,
        improvement_from_previous: improvement,
      });

      console.log(`Iterations :: ${JSON.stringify(iterations, null, 2)}`)

      if (
        !bestCandidate ||
        this.compareCandidatesForSelection(roundWinner, bestCandidate) < 0
      ) {
        bestCandidate = roundWinner;
      }

      if (roundWinner.score >= this.goodEnoughThreshold) {
        terminationReason = 'good_enough';
        break;
      }

      if (
        previousBestScore !== null &&
        improvement !== null &&
        improvement < this.improvementThreshold
      ) {
        terminationReason = 'no_meaningful_improvement';
        break;
      }

      previousBestScore = roundWinner.score;
      options.onProgress?.('Refining top query candidates for the next round...');
      currentCandidates = await this.buildRefinedCandidates(
        rawRequirement,
        seedResult,
        targetProfiles,
        evaluatedCandidates,
        round + 1,
        llmOptions,
      );

      if (currentCandidates.length === 0) {
        terminationReason = 'no_meaningful_improvement';
        break;
      }
    }

    if (!bestCandidate) {
      throw new Error('Failed to generate iterative LinkedIn query set');
    }

    console.log(`Best candidate :: ${JSON.stringify(bestCandidate, null, 2)}`)
    console.log(`Return alternatives :: ${returnAlternatives}`)
    const alternatives = returnAlternatives
      ? Array.from(rankedCandidates.values())
          .filter((candidate) => candidate.candidate_id !== bestCandidate?.candidate_id)
          .sort((left, right) => this.compareCandidatesForSelection(left, right))
          .slice(0, 5)
          .map<RankedAlternativeQuerySet>((candidate) => ({
            query_set: candidate.query_set,
            score: candidate.score,
            summary: candidate.summary,
            rejection_reason:
              candidate.rejection_reason ??
              `Lower score than selected candidate (${candidate.score.toFixed(2)}).`,
          }))
      : [];

    console.log(`Alternatives :: ${JSON.stringify(alternatives, null, 2)}`)

    this.logger.log(
      `Iterative final query set: ${JSON.stringify(bestCandidate.query_set, null, 2)}`,
    );
    const result = {
      final_query_set: bestCandidate.query_set,
      ranked_alternatives: alternatives,
      iterations,
      verification_summary: {
        mode,
        final_score: bestCandidate.score,
        termination_reason: terminationReason,
        live_preview_used: livePreviewUsed,
        live_preview_fallback_reason: livePreviewFallbackReason,
      },
      target_profile_preview: targetProfilePreview,
    }

    console.log(`Result :: ${JSON.stringify(result, null, 2)}`)
    return result;
  }

  private async generateTargetProfiles(
    rawRequirement: string,
    seedResult: OrchestratorResult,
    options: LlmOptions,
  ): Promise<TargetProfileSet> {
    return this.callLlm(
      ITERATIVE_TARGET_PROFILE_SYSTEM_PROMPT,
      buildIterativeTargetProfileUserPrompt(
        rawRequirement,
        seedResult.parsed_requirement,
        seedResult.master_lists,
      ),
      options,
      {
        schema: targetProfileSetSchema,
        name: 'iterativeTargetProfiles',
      },
    );
  }

  private buildTargetProfileValidationPreview(
    rawRequirement: string,
    targetProfiles: TargetProfileSet,
  ): TargetProfileValidationPreview {
    return {
      recruiter_validation_question:
        `Do these sample profiles match the recruiter intent in the requirement: "${rawRequirement}"?`,
      positive_examples: targetProfiles.positive_profiles
        .slice(0, 4)
        .map((profile) => this.buildTargetProfilePreviewItem(profile, false)),
      negative_examples: targetProfiles.negative_profiles
        .slice(0, 3)
        .map((profile) => this.buildTargetProfilePreviewItem(profile, true)),
    };
  }

  private buildTargetProfilePreviewItem(
    profile: TargetProfileSet['positive_profiles'][number],
    isNegative: boolean,
  ): TargetProfilePreviewItem {
    const focus = this.detectRetrievalFocus(profile);
    const title = profile.likely_titles[0];
    const keyword = profile.likely_keywords[0] ?? profile.must_have_signals[0];
    const secondarySignal =
      profile.must_have_signals.find((signal) => signal !== keyword) ??
      profile.optional_signals[0];

    const titleFragment = title ? `with job title "${title}"` : 'with an adjacent job title';
    const keywordFragment = keyword
      ? `and "${keyword}" elsewhere in the profile`
      : 'and the right functional evidence elsewhere in the profile';
    const secondaryFragment = secondarySignal
      ? `, especially signals like "${secondarySignal}"`
      : '';

    return {
      archetype: profile.archetype,
      retrieval_focus: focus,
      sample_profile: isNegative
        ? `Avoid someone ${titleFragment} ${keywordFragment}${secondaryFragment} if they mostly fit the "${profile.archetype}" false-positive pattern.`
        : `Surface someone ${titleFragment} ${keywordFragment}${secondaryFragment} if they fit the "${profile.archetype}" target pattern.`,
    };
  }

  private detectRetrievalFocus(
    profile: TargetProfileSet['positive_profiles'][number],
  ): 'title' | 'keywords' | 'mixed' {
    const hasTitles = profile.likely_titles.length > 0;
    const hasKeywords =
      profile.likely_keywords.length > 0 || profile.must_have_signals.length > 0;

    if (hasTitles && hasKeywords) {
      return 'mixed';
    }

    if (hasTitles) {
      return 'title';
    }

    return 'keywords';
  }

  private buildSeedCandidates(
    seedResult: OrchestratorResult,
    targetProfiles: TargetProfileSet,
  ): IterativeQueryCandidate[] {
    const baseQueries = seedResult.final_query_set.search_query_set;
    const candidates: IterativeQueryCandidate[] = [];

    candidates.push(
      this.createCandidate('seed-mixed', 'seed', 'mixed-seed', {
        search_query_set: this.deduplicateQuerySet(baseQueries),
      }),
    );

    candidates.push(
      this.createCandidate(
        'seed-title-only',
        'seed',
        'title-preferred',
        this.mapQueries(baseQueries, (query) => ({
          ...query,
          keywords: query.job_title ? null : query.keywords,
        })),
      ),
    );

    candidates.push(
      this.createCandidate(
        'seed-keyword-only',
        'seed',
        'keyword-preferred',
        this.mapQueries(baseQueries, (query) => ({
          ...query,
          job_title: query.keywords ? null : query.job_title,
        })),
      ),
    );

    candidates.push(
      this.createCandidate(
        'seed-broader-split',
        'seed',
        'broader-split',
        this.buildProfileDrivenBroadQueries(targetProfiles, baseQueries, false),
      ),
    );

    candidates.push(
      this.createCandidate(
        'seed-broader-relaxed-company',
        'seed',
        'broader-relaxed-company',
        this.buildProfileDrivenBroadQueries(targetProfiles, baseQueries, true),
      ),
    );

    return this.uniqueCandidates(candidates);
  }

  private async evaluateCandidate(
    rawRequirement: string,
    candidate: IterativeQueryCandidate,
    seedResult: OrchestratorResult,
    targetProfiles: TargetProfileSet,
    llmOptions: LlmOptions,
    options: {
      mode: IterativeGenerationMode;
      searchType: PeopleSearchType;
      apiToken?: string;
    },
  ): Promise<CandidateEvaluation> {
    const deterministicVerification = this.verifyQuerySet(candidate.query_set);
    let livePreview: LivePreviewResult | null = null;

    if (options.mode === 'live') {
      livePreview = await this.runLivePreview(
        rawRequirement,
        candidate.query_set,
        options.searchType,
        options.apiToken,
      );

      if (
        livePreview.fallback_reason &&
        !deterministicVerification.findings.some(
          (finding) => finding.code === 'live_preview_unavailable',
        )
      ) {
        deterministicVerification.findings.push({
          code: 'live_preview_unavailable',
          severity: 'info',
          message: livePreview.fallback_reason,
        });
      }
    }

    const llmVerification = await this.callLlm(
      ITERATIVE_QUERY_VERIFIER_SYSTEM_PROMPT,
      buildIterativeQueryVerifierUserPrompt({
        rawRequirement,
        parsedRequirement: seedResult.parsed_requirement,
        targetProfiles,
        querySet: candidate.query_set,
        deterministicVerification,
        livePreviewSummary: livePreview as unknown as Record<string, unknown> | null,
      }),
      llmOptions,
      {
        schema: queryVerificationResultSchema,
        name: 'iterativeQueryVerification',
      },
    );

    const mergedVerification = this.mergeVerifications(
      deterministicVerification,
      llmVerification,
      livePreview,
    );

    return {
      verification: mergedVerification,
      livePreview,
      finalScore: mergedVerification.score,
    };
  }

  private mergeVerifications(
    deterministic: QueryVerificationResult,
    llm: QueryVerificationResult,
    livePreview: LivePreviewResult | null,
  ): QueryVerificationResult {
    const findings = this.deduplicateFindings([
      ...deterministic.findings,
      ...llm.findings,
    ]);
    const recommendedActions = Array.from(
      new Set([
        ...deterministic.recommended_actions,
        ...llm.recommended_actions,
      ]),
    );
    const livePreviewScore =
      livePreview?.preview_score ?? llm.live_preview_score ?? null;
    const relevanceScore = this.averageNullable([
      llm.relevance_score,
      this.averageNullable(
        livePreview?.queries.map((query) => query.relevance_score ?? null) ?? [],
      ),
    ]);
    const penalty = findings.filter((finding) => finding.severity === 'error').length * 0.08;
    const score = this.clamp(
      deterministic.score * 0.35 +
        llm.score * 0.65 -
        penalty +
        (livePreviewScore ?? 0) * 0.05,
    );

    return {
      valid: deterministic.valid && llm.valid,
      score,
      overlap_score: this.clamp(
        deterministic.overlap_score * 0.5 + llm.overlap_score * 0.5,
      ),
      breadth_score: this.clamp(
        deterministic.breadth_score * 0.35 + llm.breadth_score * 0.65,
      ),
      constraint_load_score: this.clamp(
        deterministic.constraint_load_score * 0.6 +
          llm.constraint_load_score * 0.4,
      ),
      role_signal_score: this.clamp(
        deterministic.role_signal_score * 0.3 + llm.role_signal_score * 0.7,
      ),
      expected_candidate_volume_score: this.clamp(
        deterministic.expected_candidate_volume_score * 0.4 +
          llm.expected_candidate_volume_score * 0.4 +
          (livePreviewScore ?? llm.expected_candidate_volume_score) * 0.2,
      ),
      live_preview_score: livePreviewScore,
      relevance_score: relevanceScore,
      findings,
      recommended_actions:
        recommendedActions.length > 0 ? recommendedActions : ['preserve_location'],
      summary: llm.summary,
    };
  }

  private compareCandidatesForSelection(
    left: IterativeQueryCandidate,
    right: IterativeQueryCandidate,
  ): number {
    const leftQualified = this.isExhaustiveSuiteCandidate(left);
    const rightQualified = this.isExhaustiveSuiteCandidate(right);

    if (leftQualified !== rightQualified) {
      return leftQualified ? -1 : 1;
    }

    return right.score - left.score;
  }

  private isExhaustiveSuiteCandidate(candidate: IterativeQueryCandidate): boolean {
    const familyCoverageScore = this.calculateFamilyCoverageScore(candidate.query_set);

    return (
      candidate.verification_result.valid &&
      candidate.query_set.search_query_set.length >= this.minimumSuiteQueryCount &&
      familyCoverageScore >= this.minimumSuiteCoverageScore
    );
  }

  private async buildRefinedCandidates(
    rawRequirement: string,
    seedResult: OrchestratorResult,
    targetProfiles: TargetProfileSet,
    evaluatedCandidates: IterativeQueryCandidate[],
    nextRound: number,
    llmOptions: LlmOptions,
  ): Promise<IterativeQueryCandidate[]> {
    const topCandidates = evaluatedCandidates.slice(0, 2);
    const refined: IterativeQueryCandidate[] = [];

    for (const candidate of topCandidates) {
      refined.push(...this.buildFallbackRefinements(candidate, nextRound));

      const llmRefined = await this.callLlm(
        ITERATIVE_QUERY_REFINER_SYSTEM_PROMPT,
        buildIterativeQueryRefinerUserPrompt({
          rawRequirement,
          parsedRequirement: seedResult.parsed_requirement,
          targetProfiles,
          currentQuerySet: candidate.query_set,
          verification: candidate.verification_result,
          round: nextRound,
        }),
        llmOptions,
        {
          schema: iterativeQueryRefinerSchema,
          name: 'iterativeQueryRefiner',
        },
      );

      refined.push(
        this.createCandidate(
          `${candidate.candidate_id}-llm-r${nextRound}`,
          'refined',
          `${candidate.label}-llm-r${nextRound}`,
          this.normalizeQuerySetForRecall(
            {
              search_query_set: this.deduplicateQuerySet(
                llmRefined.refined_query_set.search_query_set,
              ),
            },
            { relaxCompanyOnSplit: true, addBroaderFallbacks: true },
          ),
          llmRefined.rationale,
        ),
      );
    }

    return this.uniqueCandidates(refined);
  }

  private buildFallbackRefinements(
    candidate: IterativeQueryCandidate,
    nextRound: number,
  ): IterativeQueryCandidate[] {
    const refined: IterativeQueryCandidate[] = [];
    const actions = candidate.verification_result.recommended_actions;

    if (actions.includes('split_mixed_query')) {
      refined.push(
        this.createCandidate(
          `${candidate.candidate_id}-split-r${nextRound}`,
          'refined',
          `${candidate.label}-split`,
          this.splitMixedQueries(candidate.query_set.search_query_set, false),
          'Split mixed title/keyword queries to reduce over-constraint.',
        ),
      );
    }

    if (actions.includes('relax_company_filter')) {
      refined.push(
        this.createCandidate(
          `${candidate.candidate_id}-relaxed-company-r${nextRound}`,
          'refined',
          `${candidate.label}-relaxed-company`,
          this.mapQueries(candidate.query_set.search_query_set, (query) => ({
            ...query,
            company: null,
          })),
          'Removed company filters from refined candidate to improve recall.',
        ),
      );
    }

    if (actions.includes('drop_job_title')) {
      refined.push(
        this.createCandidate(
          `${candidate.candidate_id}-drop-title-r${nextRound}`,
          'refined',
          `${candidate.label}-drop-title`,
          this.mapQueries(candidate.query_set.search_query_set, (query) => ({
            ...query,
            job_title: query.keywords ? null : query.job_title,
          })),
          'Dropped overlapping job title constraints from refined candidate.',
        ),
      );
    }

    if (actions.includes('drop_keywords')) {
      refined.push(
        this.createCandidate(
          `${candidate.candidate_id}-drop-keywords-r${nextRound}`,
          'refined',
          `${candidate.label}-drop-keywords`,
          this.mapQueries(candidate.query_set.search_query_set, (query) => ({
            ...query,
            keywords: query.job_title ? null : query.keywords,
          })),
          'Dropped overlapping keyword constraints from refined candidate.',
        ),
      );
    }

    return refined;
  }

  private verifyQuerySet(querySet: SearchQuerySet): QueryVerificationResult {
    const validation =
      this.linkedinQueryGenerationService.validateQuerySet(querySet);
    const findings: QueryVerificationFinding[] = [];
    const recommendedActions = new Set<QueryVerificationResult['recommended_actions'][number]>();
    const queryCount = Math.max(querySet.search_query_set.length, 1);
    const familyCoverageScore = this.calculateFamilyCoverageScore(querySet);
    const familyOverlapScore = this.calculateFamilyOverlapScore(querySet);

    for (const error of validation.errors) {
      findings.push({
        code: 'linkedin_limit_error',
        severity: 'error',
        message: error,
      });
      recommendedActions.add('enforce_limits');
    }

    for (const warning of validation.warnings) {
      findings.push({
        code: 'empty_field_warning',
        severity: 'warning',
        message: warning,
      });
    }

    const overlapValues = querySet.search_query_set.map((query) =>
      this.calculateQueryOverlap(query),
    );
    const overlapScore = this.average(overlapValues);
    const hasHighOverlapMixedQuery = querySet.search_query_set.some(
      (query) =>
        query.job_title &&
        query.keywords &&
        this.calculateQueryOverlap(query) >= 0.4,
    );

    if (hasHighOverlapMixedQuery) {
      findings.push({
        code: 'overlapping_title_keywords',
        severity: 'warning',
        message:
          'Job title and keywords overlap heavily in at least one query, which is likely to reduce recall.',
      });
      recommendedActions.add('split_mixed_query');
      recommendedActions.add('drop_job_title');
      recommendedActions.add('drop_keywords');
    }

    const averageConstraintLoad = this.average(
      querySet.search_query_set.map((query) => this.calculateConstraintLoad(query)),
    );
    const constraintLoadScore = this.clamp(1 - averageConstraintLoad / 4);

    if (averageConstraintLoad >= 3) {
      findings.push({
        code: 'constraint_load_high',
        severity: 'warning',
        message:
          'Queries stack too many restrictive dimensions at once, which risks low candidate volume.',
      });
      recommendedActions.add('add_broader_variant');
    }

    const companyUsageRatio =
      querySet.search_query_set.filter(
        (query) => (query.company?.length ?? 0) > 0,
      ).length / queryCount;

    if (companyUsageRatio >= 0.75) {
      findings.push({
        code: 'company_filter_too_strict',
        severity: 'info',
        message:
          'Most queries keep a company filter, so candidate recall may depend too much on example companies.',
      });
      recommendedActions.add('relax_company_filter');
    }

    const breadthScore = this.calculateBreadthScore(querySet);
    if (breadthScore < 0.45) {
      findings.push({
        code: 'low_breadth',
        severity: 'warning',
        message:
          'The query set is still narrow; broader variants should be preferred to improve candidate volume.',
      });
      recommendedActions.add('add_broader_variant');
    }

    if (queryCount < this.minimumSuiteQueryCount) {
      findings.push({
        code: 'low_breadth',
        severity: 'error',
        message:
          'The query set does not contain enough distinct query families to be exhaustive enough.',
      });
      recommendedActions.add('add_broader_variant');
    }

    if (familyCoverageScore < this.minimumSuiteCoverageScore) {
      findings.push({
        code: 'low_breadth',
        severity: queryCount < this.minimumSuiteQueryCount ? 'error' : 'warning',
        message:
          'The query set does not yet cover enough distinct title and keyword retrieval families to be an exhaustive suite.',
      });
      recommendedActions.add('add_broader_variant');
    }

    const duplicateCount =
      querySet.search_query_set.length - this.deduplicateQuerySet(querySet.search_query_set).length;
    if (duplicateCount > 0) {
      findings.push({
        code: 'duplicate_query_warning',
        severity: 'warning',
        message: `Detected ${duplicateCount} duplicate query variant(s).`,
      });
    }

    const exceedsSiblingOverlapCeiling =
      familyOverlapScore > this.siblingOverlapCeiling;

    if (exceedsSiblingOverlapCeiling) {
      findings.push({
        code: 'family_overlap_high',
        severity: 'error',
        message:
          'Sibling queries overlap too much semantically, so the final set is not MECE enough to keep as-is.',
      });
      recommendedActions.add('add_broader_variant');
    }

    const roleSignalScore = this.calculateRoleSignalScore(querySet);
    const expectedCandidateVolumeScore = this.clamp(
      breadthScore * 0.55 +
        (1 - overlapScore) * 0.2 +
        constraintLoadScore * 0.25,
    );
    const penalty =
      validation.errors.length * 0.25 +
      validation.warnings.length * 0.03 +
      duplicateCount * 0.04 +
      familyOverlapScore * 0.12 +
      (exceedsSiblingOverlapCeiling ? 0.18 : 0);
    const score = this.clamp(
      breadthScore * 0.35 +
        roleSignalScore * 0.25 +
        (1 - overlapScore) * 0.2 +
        expectedCandidateVolumeScore * 0.1 +
        constraintLoadScore * 0.07 +
        familyCoverageScore * 0.12 +
        (1 - familyOverlapScore) * 0.08 -
        penalty,
    );

    return {
      valid:
        validation.valid &&
        !exceedsSiblingOverlapCeiling &&
        queryCount >= this.minimumSuiteQueryCount &&
        familyCoverageScore >= this.minimumSuiteCoverageScore,
      score,
      overlap_score: overlapScore,
      breadth_score: breadthScore,
      constraint_load_score: constraintLoadScore,
      role_signal_score: roleSignalScore,
      expected_candidate_volume_score: expectedCandidateVolumeScore,
      live_preview_score: null,
      relevance_score: null,
      findings,
      recommended_actions:
        Array.from(recommendedActions).length > 0
          ? Array.from(recommendedActions)
          : ['preserve_location'],
      summary: this.buildVerificationSummary(
        score,
        breadthScore,
        overlapScore,
        findings,
      ),
    };
  }

  private async runLivePreview(
    rawRequirement: string,
    querySet: SearchQuerySet,
    searchType: PeopleSearchType,
    apiToken?: string,
  ): Promise<LivePreviewResult> {
    if (!apiToken) {
      return {
        attempted: true,
        succeeded: false,
        fallback_reason: 'Live preview skipped because no API token was available.',
        preview_score: null,
        queries: [],
      };
    }

    try {
      const accountId =
        await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
      const generated = mapLinkedinSearchQueriesToGeneratedParameters(
        querySet,
        searchType,
        rawRequirement,
      );
      const strategies = this.extractStrategies(generated, searchType).slice(0, 3);
      const queries: LivePreviewQueryResult[] = [];

      for (const [index, strategy] of strategies.entries()) {
        const propertyKey = this.getSearchParameterPropertyKey(searchType);
        const resolved =
          await this.candidateSearchBaseService.resolveSearchParameters(
            {
              [propertyKey]: strategy.parameters,
            } as GeneratedSearchParameters,
            searchType,
            'people',
            accountId,
          );
        const searchResult =
          await this.candidateSearchBaseService.executeLinkedInSearch(
            resolved,
            searchType,
            'people',
            accountId,
            { limit: 10 },
          );
        const items = searchResult?.items ?? [];
        const validation =
          items.length > 0
            ? await this.resultValidationService.validateResultsAgainstQuery(
                items.slice(0, 10),
                rawRequirement,
                apiToken,
              )
            : null;

        queries.push({
          query_index: index,
          item_count: items.length,
          unique_company_count: this.extractUniqueCompanies(items).size,
          unique_title_count: this.extractUniqueTitles(items).size,
          relevance_score: validation?.relevanceScore ?? null,
          quality_assessment: validation?.qualityAssessment ?? null,
          reasoning: validation?.reasoning ?? null,
        });
      }

      return {
        attempted: true,
        succeeded: true,
        preview_score: this.calculateLivePreviewScore(queries),
        queries,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Live preview failed';
      this.logger.warn(`Live preview fallback: ${message}`);

      return {
        attempted: true,
        succeeded: false,
        fallback_reason: message,
        preview_score: null,
        queries: [],
      };
    }
  }

  private createCandidate(
    candidateId: string,
    source: 'seed' | 'refined',
    label: string,
    querySet: SearchQuerySet,
    rejectionReason?: string,
  ): IterativeQueryCandidate {
    return {
      candidate_id: candidateId,
      source,
      label,
      query_set: this.normalizeQuerySetForRecall(querySet, {
        relaxCompanyOnSplit: source === 'refined',
        addBroaderFallbacks: true,
      }),
      score: 0,
      summary: '',
      verification_result: {
        valid: false,
        score: 0,
        overlap_score: 0,
        breadth_score: 0,
        constraint_load_score: 0,
        role_signal_score: 0,
        expected_candidate_volume_score: 0,
        live_preview_score: null,
        relevance_score: null,
        findings: [],
        recommended_actions: [],
        summary: '',
      },
      rejection_reason: rejectionReason,
    };
  }

  private uniqueCandidates(
    candidates: IterativeQueryCandidate[],
  ): IterativeQueryCandidate[] {
    const seen = new Set<string>();

    return candidates.filter((candidate) => {
      const signature = JSON.stringify(candidate.query_set.search_query_set);
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }

  private buildProfileDrivenBroadQueries(
    targetProfiles: TargetProfileSet,
    baseQueries: SearchQuery[],
    relaxCompanyFilter: boolean,
  ): SearchQuerySet {
    const positives = targetProfiles.positive_profiles.slice(0, 4);
    const derivedQueries: SearchQuery[] = positives.flatMap((profile, index) => {
      const base = baseQueries[index % Math.max(baseQueries.length, 1)] ?? {
        keywords: null,
        job_title: null,
        company: null,
        location: null,
        years_of_experience: null,
      };
      const company = relaxCompanyFilter ? null : base.company;
      const location = base.location ?? null;
      const titleExpr =
        profile.likely_titles.length > 0
          ? this.termsToExpression(profile.likely_titles.slice(0, 4))
          : null;
      const keywordPool = [
        ...profile.likely_keywords,
        ...profile.must_have_signals,
      ];
      const keywordExpr =
        keywordPool.length > 0
          ? this.termsToExpression(keywordPool.slice(0, 5))
          : null;

      return [
        {
          keywords: keywordExpr,
          job_title: null,
          company,
          location,
          years_of_experience: base.years_of_experience,
        },
        {
          keywords: null,
          job_title: titleExpr,
          company,
          location,
          years_of_experience: base.years_of_experience,
        },
      ];
    });

    return this.normalizeQuerySetForRecall(
      {
        search_query_set: this.deduplicateQuerySet(derivedQueries),
      },
      { relaxCompanyOnSplit: relaxCompanyFilter, addBroaderFallbacks: true },
    );
  }

  private splitMixedQueries(
    queries: SearchQuery[],
    relaxCompanyFilter: boolean,
  ): SearchQuerySet {
    const splitQueries: SearchQuery[] = [];

    for (const query of queries) {
      const company = relaxCompanyFilter ? null : query.company;

      if (query.job_title && query.keywords) {
        splitQueries.push({
          ...query,
          keywords: null,
          company,
        });
        splitQueries.push({
          ...query,
          job_title: null,
          company,
        });
      } else {
        splitQueries.push({
          ...query,
          company,
        });
      }
    }

    return this.normalizeQuerySetForRecall(
      { search_query_set: this.deduplicateQuerySet(splitQueries) },
      { relaxCompanyOnSplit: relaxCompanyFilter, addBroaderFallbacks: true },
    );
  }

  private mapQueries(
    queries: SearchQuery[],
    mapper: (query: SearchQuery) => SearchQuery,
  ): SearchQuerySet {
    return this.normalizeQuerySetForRecall(
      {
        search_query_set: this.deduplicateQuerySet(
          queries.map((query) => mapper(query)),
        ),
      },
      { relaxCompanyOnSplit: false, addBroaderFallbacks: true },
    );
  }

  private normalizeQuerySetForRecall(
    querySet: SearchQuerySet,
    options: {
      relaxCompanyOnSplit: boolean;
      addBroaderFallbacks: boolean;
    },
  ): SearchQuerySet {
    const normalized: SearchQuery[] = [];

    for (const query of querySet.search_query_set) {
      const overlap = this.calculateQueryOverlap(query);
      const isOverConstrainedMixed =
        Boolean(query.job_title) &&
        Boolean(query.keywords) &&
        (overlap >= 0.2 || this.calculateConstraintLoad(query) >= 3);

      if (isOverConstrainedMixed) {
        normalized.push({
          ...query,
          keywords: null,
        });
        normalized.push({
          ...query,
          job_title: null,
          company: options.relaxCompanyOnSplit ? null : query.company,
        });
        continue;
      }

      normalized.push(query);
    }

    const deduped = this.deduplicateQuerySet(normalized);
    const meceAdjusted = this.enforceMeceFamilyStructure(deduped);

    if (!options.addBroaderFallbacks) {
      return { search_query_set: meceAdjusted };
    }

    const allQueriesUseCompany =
      deduped.length > 0 &&
      deduped.every((query) => (query.company?.length ?? 0) > 0);
    const fallbackQueries: SearchQuery[] = [];

    for (const query of meceAdjusted) {
      const hasKeywords = Boolean(query.keywords);
      const hasTitle = Boolean(query.job_title);

      if (allQueriesUseCompany && hasKeywords) {
        fallbackQueries.push({
          ...query,
          company: null,
        });
      }

      if (hasKeywords && hasTitle) {
        fallbackQueries.push({
          ...query,
          job_title: null,
          company: options.relaxCompanyOnSplit ? null : query.company,
        });
      }
    }

    return {
      search_query_set: this.deduplicateQuerySet([
        ...meceAdjusted,
        ...fallbackQueries,
      ]),
    };
  }

  private enforceMeceFamilyStructure(queries: SearchQuery[]): SearchQuery[] {
    const keywordQueries = queries.filter((query) => query.keywords && !query.job_title);
    const titleQueries = queries.filter((query) => query.job_title && !query.keywords);
    const mixedQueries = queries.filter((query) => query.job_title && query.keywords);

    return this.deduplicateQuerySet([
      ...this.partitionKeywordQueries(keywordQueries),
      ...this.partitionTitleQueries(titleQueries),
      ...mixedQueries,
    ]);
  }

  private partitionKeywordQueries(queries: SearchQuery[]): SearchQuery[] {
    const buckets = new Map<string, Set<string>>();
    const examples = new Map<string, SearchQuery>();

    for (const query of queries) {
      const terms = Array.from(this.normalizeTerms(query.keywords));
      const bucket = this.getKeywordBucket(terms);
      const existing = buckets.get(bucket) ?? new Set<string>();
      terms.forEach((term) => existing.add(term));
      buckets.set(bucket, existing);
      if (!examples.has(bucket)) {
        examples.set(bucket, query);
      }
    }

    return Array.from(buckets.entries()).map(([bucket, terms]) => {
      const example = examples.get(bucket)!;
      return {
        ...example,
        keywords: this.termsToExpression(Array.from(terms).slice(0, 5)),
      };
    });
  }

  private partitionTitleQueries(queries: SearchQuery[]): SearchQuery[] {
    const buckets = new Map<string, Set<string>>();
    const examples = new Map<string, SearchQuery>();

    for (const query of queries) {
      const titles = Array.from(this.extractExpressionTerms(query.job_title));
      const bucket = this.getTitleBucket(titles);
      const existing = buckets.get(bucket) ?? new Set<string>();
      titles.forEach((title) => existing.add(title));
      buckets.set(bucket, existing);
      if (!examples.has(bucket)) {
        examples.set(bucket, query);
      }
    }

    return Array.from(buckets.entries()).map(([bucket, titles]) => {
      const example = examples.get(bucket)!;
      return {
        ...example,
        job_title: this.termsToExpression(Array.from(titles).slice(0, 4)),
      };
    });
  }

  private getKeywordBucket(terms: string[]): string {
    const joined = terms.join(' ');
    if (/(telecom|telecommunications|vendor|equipment|technology|services)/i.test(joined)) {
      return 'industry_context';
    }
    if (/(leadership|strategy|growth|ownership|revenue)/i.test(joined)) {
      return 'leadership_signal';
    }
    return 'channel_partner_function';
  }

  private getTitleBucket(terms: string[]): string {
    const joined = terms.join(' ');
    if (/(vice president|vp|head|director)/i.test(joined)) {
      return 'leadership_titles';
    }
    if (/(senior)/i.test(joined)) {
      return 'senior_manager_titles';
    }
    return 'manager_titles';
  }

  private extractExpressionTerms(expression: string | null): Set<string> {
    if (!expression) {
      return new Set();
    }

    return new Set(
      expression
        .split(/\s+OR\s+/i)
        .map((term) => term.replace(/[()"]/g, '').trim())
        .filter(Boolean),
    );
  }

  private calculateFamilyOverlapScore(querySet: SearchQuerySet): number {
    const overlaps: number[] = [];

    for (let i = 0; i < querySet.search_query_set.length; i += 1) {
      for (let j = i + 1; j < querySet.search_query_set.length; j += 1) {
        overlaps.push(
          this.calculateSiblingOverlap(
            querySet.search_query_set[i],
            querySet.search_query_set[j],
          ),
        );
      }
    }

    return overlaps.length > 0 ? this.average(overlaps) : 0;
  }

  private calculateFamilyCoverageScore(querySet: SearchQuerySet): number {
    const queryCountScore = Math.min(querySet.search_query_set.length, 4) / 4;
    const hasTitleOnly = querySet.search_query_set.some(
      (query) => Boolean(query.job_title) && !query.keywords,
    );
    const hasKeywordOnly = querySet.search_query_set.some(
      (query) => Boolean(query.keywords) && !query.job_title,
    );
    const hasMixed = querySet.search_query_set.some(
      (query) => Boolean(query.keywords) && Boolean(query.job_title),
    );

    let familyTypeScore = 0;

    if (hasTitleOnly) {
      familyTypeScore += 0.45;
    }
    if (hasKeywordOnly) {
      familyTypeScore += 0.45;
    }
    if (hasMixed) {
      familyTypeScore += 0.1;
    }

    return this.clamp(queryCountScore * 0.55 + familyTypeScore * 0.45);
  }

  private calculateSiblingOverlap(left: SearchQuery, right: SearchQuery): number {
    const leftTerms = new Set([
      ...this.normalizeTerms(left.keywords),
      ...this.normalizeTerms(left.job_title),
    ]);
    const rightTerms = new Set([
      ...this.normalizeTerms(right.keywords),
      ...this.normalizeTerms(right.job_title),
    ]);

    if (leftTerms.size === 0 || rightTerms.size === 0) {
      return 0;
    }

    const intersection = Array.from(leftTerms).filter((term) => rightTerms.has(term)).length;
    const union = new Set([...leftTerms, ...rightTerms]).size;

    return union === 0 ? 0 : intersection / union;
  }

  private deduplicateQuerySet(queries: SearchQuery[]): SearchQuery[] {
    const seen = new Set<string>();

    return queries.filter((query) => {
      const normalized = JSON.stringify({
        keywords: query.keywords ?? null,
        job_title: query.job_title ?? null,
        company: query.company ?? null,
        location: query.location ?? null,
        years_of_experience: query.years_of_experience ?? null,
      });

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private termsToExpression(terms: string[]): string {
    return terms
      .filter(Boolean)
      .map((term) => (/[\s/]/.test(term) ? `"${term}"` : term))
      .join(' OR ');
  }

  private calculateBreadthScore(querySet: SearchQuerySet): number {
    const queryCount = Math.min(querySet.search_query_set.length, 5);
    const diversityBonus = queryCount / 5;
    const singleFieldRatio =
      querySet.search_query_set.filter(
        (query) => Boolean(query.keywords) !== Boolean(query.job_title),
      ).length / Math.max(querySet.search_query_set.length, 1);
    const fieldBreadth = this.average(
      querySet.search_query_set.map((query) => {
        const hasKeywords = Boolean(query.keywords);
        const hasTitle = Boolean(query.job_title);
        const hasCompany = (query.company?.length ?? 0) > 0;
        let score = hasKeywords || hasTitle ? 0.5 : 0;

        if (hasKeywords !== hasTitle) {
          score += 0.3;
        }
        if (hasKeywords && hasTitle) {
          score -= 0.15;
        }
        if (hasCompany) {
          score -= 0.08;
        }

        return this.clamp(score);
      }),
    );

    return this.clamp(
      fieldBreadth * 0.6 + diversityBonus * 0.2 + singleFieldRatio * 0.2,
    );
  }

  private calculateRoleSignalScore(querySet: SearchQuerySet): number {
    return this.average(
      querySet.search_query_set.map((query) => {
        if (query.job_title && !query.keywords) {
          return 0.85;
        }
        if (query.keywords && !query.job_title) {
          return 0.76;
        }
        if (query.job_title && query.keywords) {
          return this.clamp(0.68 - this.calculateQueryOverlap(query) * 0.35);
        }
        return 0.2;
      }),
    );
  }

  private calculateConstraintLoad(query: SearchQuery): number {
    return [
      query.keywords ? 1 : 0,
      query.job_title ? 1 : 0,
      (query.company?.length ?? 0) > 0 ? 1 : 0,
      (query.location?.length ?? 0) > 0 ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
  }

  private calculateQueryOverlap(query: SearchQuery): number {
    const titleTerms = this.normalizeTerms(query.job_title);
    const keywordTerms = this.normalizeTerms(query.keywords);

    if (titleTerms.size === 0 || keywordTerms.size === 0) {
      return 0;
    }

    const intersection = Array.from(titleTerms).filter((term) =>
      keywordTerms.has(term),
    ).length;
    const union = new Set([...titleTerms, ...keywordTerms]).size;

    return union === 0 ? 0 : intersection / union;
  }

  private normalizeTerms(expression: string | null): Set<string> {
    if (!expression) {
      return new Set();
    }

    return new Set(
      expression
        .toLowerCase()
        .replace(/[()"']/g, ' ')
        .split(/\b(?:and|or|not)\b|[,\s]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length > 2),
    );
  }

  private buildVerificationSummary(
    score: number,
    breadthScore: number,
    overlapScore: number,
    findings: QueryVerificationFinding[],
  ): string {
    const headline =
      score >= 0.78
        ? 'High-confidence query set.'
        : score >= 0.58
          ? 'Usable query set with room to broaden.'
          : 'Query set is still too restrictive.';
    const findingsSummary =
      findings.length > 0 ? ` ${findings[0].message}` : '';

    return `${headline} Breadth ${breadthScore.toFixed(2)}, overlap ${overlapScore.toFixed(2)}.${findingsSummary}`.trim();
  }

  private calculateLivePreviewScore(queries: LivePreviewQueryResult[]): number {
    if (queries.length === 0) {
      return 0;
    }

    const scores = queries.map((query) => {
      const volumeScore = this.clamp(query.item_count / 10);
      const diversityScore = this.clamp(
        (Math.min(query.unique_company_count, 5) / 5) * 0.5 +
          (Math.min(query.unique_title_count, 5) / 5) * 0.5,
      );
      const relevanceScore = query.relevance_score ?? 0.5;

      return this.clamp(
        volumeScore * 0.4 + diversityScore * 0.3 + relevanceScore * 0.3,
      );
    });

    return this.average(scores);
  }

  private extractStrategies(
    generated: GeneratedSearchParameters,
    searchType: PeopleSearchType,
  ): StrategyResult[] {
    if (searchType === 'classic') {
      return generated.classicPeopleSearchStrategies ?? [];
    }
    if (searchType === 'sales_navigator') {
      return generated.salesNavigatorPeopleSearchStrategies ?? [];
    }
    return generated.recruiterPeopleSearchStrategies ?? [];
  }

  private getSearchParameterPropertyKey(
    searchType: PeopleSearchType,
  ): keyof GeneratedSearchParameters {
    if (searchType === 'classic') {
      return 'classicPeopleSearch';
    }
    if (searchType === 'sales_navigator') {
      return 'salesNavigatorPeopleSearch';
    }
    return 'recruiterPeopleSearch';
  }

  private extractUniqueCompanies(items: LinkedInSearchResult[]): Set<string> {
    const companies = new Set<string>();

    for (const item of items) {
      const currentPosition = (item as { current_position?: { company?: string } })
        .current_position;
      const companyFromPosition = currentPosition?.company?.trim();
      if (companyFromPosition) {
        companies.add(companyFromPosition.toLowerCase());
      }

      const companyField = (item as { company?: string }).company?.trim();
      if (companyField) {
        companies.add(companyField.toLowerCase());
      }
    }

    return companies;
  }

  private extractUniqueTitles(items: LinkedInSearchResult[]): Set<string> {
    const titles = new Set<string>();

    for (const item of items) {
      const title =
        (item as { headline?: string }).headline ??
        (item as { current_position?: { role?: string } }).current_position?.role ??
        (item as { role?: string }).role ??
        '';
      if (title.trim()) {
        titles.add(title.trim().toLowerCase());
      }
    }

    return titles;
  }

  private deduplicateFindings(
    findings: QueryVerificationFinding[],
  ): QueryVerificationFinding[] {
    const seen = new Set<string>();

    return findings.filter((finding) => {
      const key = `${finding.code}:${finding.message}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private averageNullable(values: Array<number | null>): number | null {
    const filtered = values.filter((value): value is number => value !== null);
    if (filtered.length === 0) {
      return null;
    }

    return this.average(filtered);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private async callLlm<T>(
    systemPrompt: string,
    userPrompt: string,
    options: LlmOptions,
    schemaOption: { schema: z.ZodType<T>; name: string },
  ): Promise<T> {
    const openai = this.createOpenAiClient();
    const completion = await openai.chat.completions.create({
      model: options.model || this.defaultModel,
      temperature: options.temperature ?? 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(schemaOption.schema, schemaOption.name),
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new HttpException(
        'Empty response received from LLM',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return schemaOption.schema.parse(this.parseJson(content));
  }

  private parseJson(content: string): unknown {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error('Failed to parse iterative LLM response as JSON', {
        error,
        response: cleaned,
      });
      throw new HttpException(
        'Invalid JSON returned from iterative LLM flow',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) {
      throw new HttpException(
        'OPENAI_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return new OpenAI({ apiKey });
  }
}
