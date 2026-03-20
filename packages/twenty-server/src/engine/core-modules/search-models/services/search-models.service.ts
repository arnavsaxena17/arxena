import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ZodSchema } from 'zod';

import { EvaluateShortlistDto } from '../dto/evaluate-shortlist.dto';
import {
  InformationPlanSchema,
  QueryPlanSchema,
  SearchModelsPrompts,
  ShortlistDecisionSchema,
  StrategyPlanSchema,
  StrategyRubricSchema,
} from '../prompts/search-models.prompts';
import {
  CandidateProfile,
  CandidateShortlistDecision,
  CandidateShortlistWorkflowResult,
  CandidateStructuredFields,
  InformationCollectionPlan,
  SearchExpectation,
  SearchQueryPlan,
  SearchStrategyPlan,
  StrategyRubricEvaluation,
  StrategyRubricWorkflowResult,
} from '../types/search-models.types';

type PromptExecutionResult<T> = {
  raw: string;
  data: T;
};

@Injectable()
export class SearchModelsService {
  private readonly logger = new Logger(SearchModelsService.name);
  private readonly openai: OpenAI;
  private readonly modelName = process.env.SEARCH_MODELS_OPENAI_MODEL || 'gpt-5.1-chat-latest';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async evaluateCandidateShortlist(
    payload: EvaluateShortlistDto,
  ): Promise<CandidateShortlistWorkflowResult> {
    try {
      const candidateProfile = this.mapCandidate(payload.candidate);
      const expectations = this.mapExpectations(payload.expectations);

      const informationPlan = await this.runPrompt<InformationCollectionPlan>({
        stage: 'information-plan',
        prompt: SearchModelsPrompts.buildInformationPlanPrompt(
          payload.naturalLanguageQuery,
          candidateProfile,
        ),
        schema: InformationPlanSchema,
        schemaName: 'informationPlan',
      });

      const strategyPlan = await this.runPrompt<SearchStrategyPlan>({
        stage: 'strategy-plan',
        prompt: SearchModelsPrompts.buildStrategyPrompt(
          payload.naturalLanguageQuery,
          candidateProfile,
          informationPlan.data,
        ),
        schema: StrategyPlanSchema,
        schemaName: 'strategyPlan',
      });

      const strategyRubricEvaluations = await this.generateStrategyRubrics({
        naturalLanguageQuery: payload.naturalLanguageQuery,
        candidateProfile,
        strategyPlan: strategyPlan.data,
      });

      const queryPlan = await this.runPrompt<SearchQueryPlan>({
        stage: 'query-plan',
        prompt: SearchModelsPrompts.buildQueryPlanPrompt(
          payload.naturalLanguageQuery,
          strategyPlan.data,
        ),
        schema: QueryPlanSchema,
        schemaName: 'queryPlan',
      });

      const shortlistDecision = await this.runPrompt<CandidateShortlistDecision>({
        stage: 'shortlist-decision',
        prompt: SearchModelsPrompts.buildShortlistPrompt(
          payload.naturalLanguageQuery,
          candidateProfile,
          expectations,
          queryPlan.data,
        ),
        schema: ShortlistDecisionSchema,
        schemaName: 'shortlistDecision',
      });

      return {
        naturalLanguageQuery: payload.naturalLanguageQuery,
        candidate: candidateProfile,
        expectations,
        informationPlan: informationPlan.data,
        searchStrategyPlan: strategyPlan.data,
        strategyRubricEvaluations,
        queryPlan: queryPlan.data,
        decision: shortlistDecision.data,
      };
    } catch (error) {
      this.logger.error('Failed to evaluate candidate shortlist', error.stack || error);
      throw new HttpException(
        error.message || 'Failed to evaluate candidate shortlist',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async evaluateStrategyRubrics(
    payload: EvaluateShortlistDto,
  ): Promise<StrategyRubricWorkflowResult> {
    try {
      const candidateProfile = this.mapCandidate(payload.candidate);

      const informationPlan = await this.runPrompt<InformationCollectionPlan>({
        stage: 'information-plan',
        prompt: SearchModelsPrompts.buildInformationPlanPrompt(
          payload.naturalLanguageQuery,
          candidateProfile,
        ),
        schema: InformationPlanSchema,
        schemaName: 'informationPlan',
      });

      const strategyPlan = await this.runPrompt<SearchStrategyPlan>({
        stage: 'strategy-plan',
        prompt: SearchModelsPrompts.buildStrategyPrompt(
          payload.naturalLanguageQuery,
          candidateProfile,
          informationPlan.data,
        ),
        schema: StrategyPlanSchema,
        schemaName: 'strategyPlan',
      });

      const strategyRubricEvaluations = await this.generateStrategyRubrics({
        naturalLanguageQuery: payload.naturalLanguageQuery,
        candidateProfile,
        strategyPlan: strategyPlan.data,
      });

      return {
        naturalLanguageQuery: payload.naturalLanguageQuery,
        candidate: candidateProfile,
        informationPlan: informationPlan.data,
        searchStrategyPlan: strategyPlan.data,
        strategyRubricEvaluations,
      };
    } catch (error) {
      this.logger.error('Failed to evaluate strategy rubrics', error.stack || error);
      throw new HttpException(
        error.message || 'Failed to evaluate strategy rubrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapCandidate(candidate: EvaluateShortlistDto['candidate']): CandidateProfile {
    return {
      candidateId: candidate?.candidateId,
      name: candidate?.name,
      currentTitle: candidate?.currentTitle,
      currentCompany: candidate?.currentCompany,
      currentLocation: candidate?.currentLocation,
      preferredLocation: candidate?.preferredLocation,
      totalExperienceYears: candidate?.totalExperienceYears,
      currentCompensation: candidate?.currentCompensation,
      expectedCompensation: candidate?.expectedCompensation,
      education: candidate?.education ?? [],
      skills: candidate?.skills ?? [],
      certifications: candidate?.certifications ?? [],
      languages: candidate?.languages ?? [],
      achievements: candidate?.achievements ?? [],
      notes: candidate?.notes,
      structuredFields: this.mapStructuredFields(candidate?.structuredFields),
    };
  }

  private mapExpectations(expectations?: EvaluateShortlistDto['expectations']): SearchExpectation | undefined {
    if (!expectations) {
      return undefined;
    }

    return {
      jobTitle: expectations.jobTitle,
      company: expectations.company,
      location: expectations.location,
      salary: expectations.salary,
      experience: expectations.experience,
      education: expectations.education,
      skills: expectations.skills,
      certifications: expectations.certifications,
      languages: expectations.languages,
      shortlistingCriteria: expectations.shortlistingCriteria,
    };
  }

  private mapStructuredFields(
    structured?: EvaluateShortlistDto['candidate']['structuredFields'],
  ): CandidateStructuredFields | undefined {
    if (!structured) {
      return undefined;
    }

    return {
      jsUserName: structured.jsUserName,
      jobTitle: structured.jobTitle,
      keySkills: structured.keySkills,
      focusedSkills: structured.focusedSkills,
      interestedSkills: structured.interestedSkills,
      education: structured.education
        ? {
            ug: structured.education.ug
              ? { ...structured.education.ug }
              : null,
            pg: structured.education.pg
              ? { ...structured.education.pg }
              : null,
            ppg: structured.education.ppg
              ? { ...structured.education.ppg }
              : null,
          }
        : undefined,
      employment: structured.employment
        ? {
            current: structured.employment.current
              ? { ...structured.employment.current }
              : null,
            previous: structured.employment.previous
              ? { ...structured.employment.previous }
              : null,
          }
        : undefined,
      ctcInfo: structured.ctcInfo ? { ...structured.ctcInfo } : undefined,
      experience: structured.experience ? { ...structured.experience } : undefined,
      currentLocation: structured.currentLocation,
      preferredLocations: structured.preferredLocations,
      salaryDisclosed: structured.salaryDisclosed,
      immediateAvailabilty: structured.immediateAvailabilty,
      avgResponseTime: structured.avgResponseTime,
      noticePeriod: structured.noticePeriod,
      modifyDateLabel: structured.modifyDateLabel,
      activeDateLabel: structured.activeDateLabel,
    };
  }

  private async generateStrategyRubrics({
    naturalLanguageQuery,
    candidateProfile,
    strategyPlan,
  }: {
    naturalLanguageQuery: string;
    candidateProfile: CandidateProfile;
    strategyPlan: SearchStrategyPlan;
  }): Promise<StrategyRubricEvaluation[]> {
    if (!strategyPlan.strategies.length) {
      return [];
    }
    console.log('Generating strategy rubrics', {
      naturalLanguageQuery,
      candidateProfile,
      strategyPlan,
    });
    const rubricResults = await Promise.all(
      strategyPlan.strategies.map((strategy, index) =>
        this.runPrompt<StrategyRubricEvaluation>({
          stage: `strategy-rubric-${index}`,
          prompt: SearchModelsPrompts.buildStrategyRubricPrompt(
            naturalLanguageQuery,
            candidateProfile,
            strategy,
          ),
          schema: StrategyRubricSchema,
          schemaName: 'strategyRubric',
        }),
      ),
    );
    this.logger.debug('Rubric results generated', {
      count: rubricResults.length,
      results: rubricResults.map((r) => r.data),
    });

    return rubricResults.map((result) => result.data);
  }

  private async runPrompt<T>({
    prompt,
    schema,
    schemaName,
    stage,
  }: {
    prompt: { system: string; user: string };
    schema: ZodSchema<T>;
    schemaName: string;
    stage: string;
  }): Promise<PromptExecutionResult<T>> {
    this.logger.debug(`Running prompt for stage: ${stage}`, {
      schemaName,
      promptLength: {
        system: prompt.system.length,
        user: prompt.user.length,
      },
    });
    const completion = await this.openai.chat.completions.create({
      model: this.modelName,
      temperature: 0,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      response_format: zodResponseFormat(schema, schemaName),
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    this.logger.debug(`Completion received for stage: ${stage}`, {
      hasContent: !!raw,
      contentLength: raw?.length || 0,
      model: completion.model,
      usage: completion.usage,
    });
    if (!raw) {
      throw new Error(`Empty response received for stage ${stage}`);
    }

    try {
      const parsed = schema.parse(JSON.parse(raw));
      return { raw, data: parsed };
    } catch (error) {
      this.logger.error(
        `Invalid structured response for stage ${stage}: ${error instanceof Error ? error.message : error}`,
      );
      throw new Error(`Invalid structured response for stage ${stage}`);
    }
  }
}

