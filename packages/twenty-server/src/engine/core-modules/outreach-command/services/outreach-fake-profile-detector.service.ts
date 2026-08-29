import { Injectable, Logger, Optional } from '@nestjs/common';

import { generateObject, type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  buildOutreachFakeProfileDetectorUserPrompt,
  OUTREACH_FAKE_PROFILE_DETECTOR_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-fake-profile-detector.prompt';
import {
  gtmFakeProfileLlmResultSchema,
  isLikelyFakeVerdict,
  type OutreachFakeProfileLlmResult,
  type OutreachFakeProfileVerdict,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-fake-profile-llm.schema';
import {
  buildFakeProfileInvestigationBrief,
  compactProfileJson,
  extractProfilesFromPayload,
  profileDisplayName,
  profileHeadline,
  profilePublicIdentifier,
} from 'src/engine/core-modules/outreach-command/utils/outreach-fake-profile-investigation.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const ASSESS_CONCURRENCY = 3;

export type OutreachFakeProfileDetectorInput = {
  profile?: unknown;
  snapshot?: unknown;
  profiles?: unknown;
  modelId?: string;
};

export type OutreachFakeProfileAssessment = {
  index: number;
  isLikelyFake: boolean;
  verdict: OutreachFakeProfileVerdict;
  confidence: number;
  riskScore: number;
  name: string;
  publicIdentifier: string;
  headline: string;
  summary: string;
  redFlags: string[];
  supportingSignals: string[];
  profile: unknown;
  error?: string;
};

export type OutreachFakeProfileDetectorResult = {
  success: boolean;
  total: number;
  fakeCount: number;
  genuineCount: number;
  uncertainCount: number;
  error: string;
  fakeProfiles: OutreachFakeProfileAssessment[];
  genuineProfiles: OutreachFakeProfileAssessment[];
  assessments: OutreachFakeProfileAssessment[];
};

@Injectable()
export class OutreachFakeProfileDetectorService {
  private readonly logger = new Logger(OutreachFakeProfileDetectorService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId?: string;
    input: OutreachFakeProfileDetectorInput;
  }): Promise<OutreachFakeProfileDetectorResult> {
    const profiles = extractProfilesFromPayload(input);

    if (profiles.length === 0) {
      return this.emptyResult(
        'Pass profile, snapshot, or profiles (array of LinkedIn profiles or search hits).',
      );
    }

    const registeredModel = await this.resolveModel({
      workspaceId,
      modelId: input.modelId,
    });

    if (!registeredModel) {
      return this.emptyResult(
        'No AI model is configured. Need Nous HY3 (nous/tencent/hy3:free) or another registered model.',
      );
    }

    const assessments = await this.mapInBatches(
      profiles,
      ASSESS_CONCURRENCY,
      (profile, index) =>
        this.assessOne({
          profile,
          index,
          model: registeredModel.model,
          modelId: registeredModel.modelId,
        }),
    );

    const fakeProfiles = assessments.filter(
      (assessment) => assessment.isLikelyFake,
    );
    const genuineProfiles = assessments.filter(
      (assessment) =>
        !assessment.isLikelyFake &&
        assessment.verdict !== 'uncertain' &&
        !assessment.error,
    );
    const uncertainCount = assessments.filter(
      (assessment) =>
        assessment.verdict === 'uncertain' || Boolean(assessment.error),
    ).length;

    this.logger.log(
      `Fake-profile screen model=${registeredModel.modelId} total=${assessments.length} fake=${fakeProfiles.length} genuine=${genuineProfiles.length} uncertain=${uncertainCount}`,
    );

    return {
      success: true,
      total: assessments.length,
      fakeCount: fakeProfiles.length,
      genuineCount: genuineProfiles.length,
      uncertainCount,
      error: '',
      fakeProfiles,
      genuineProfiles,
      assessments,
    };
  }

  private async assessOne(input: {
    profile: unknown;
    index: number;
    model: LanguageModel;
    modelId: string;
  }): Promise<OutreachFakeProfileAssessment> {
    const name = profileDisplayName(input.profile);
    const publicIdentifier = profilePublicIdentifier(input.profile);
    const headline = profileHeadline(input.profile);
    const investigationBrief = buildFakeProfileInvestigationBrief(input.profile);

    try {
      const { object } = await generateObject({
        model: input.model,
        schema: gtmFakeProfileLlmResultSchema,
        system: OUTREACH_FAKE_PROFILE_DETECTOR_SYSTEM_PROMPT,
        prompt: buildOutreachFakeProfileDetectorUserPrompt({
          investigationBrief,
          profileJson: compactProfileJson(input.profile),
        }),
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      return this.toAssessment({
        index: input.index,
        profile: input.profile,
        name,
        publicIdentifier,
        headline,
        llm: object,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Fake-profile assessment failed index=${input.index} model=${input.modelId}: ${message}`,
      );

      return {
        index: input.index,
        isLikelyFake: false,
        verdict: 'uncertain',
        confidence: 0,
        riskScore: 0,
        name,
        publicIdentifier,
        headline,
        summary: '',
        redFlags: [],
        supportingSignals: [],
        profile: input.profile,
        error: message,
      };
    }
  }

  private toAssessment(input: {
    index: number;
    profile: unknown;
    name: string;
    publicIdentifier: string;
    headline: string;
    llm: OutreachFakeProfileLlmResult;
  }): OutreachFakeProfileAssessment {
    return {
      index: input.index,
      isLikelyFake: isLikelyFakeVerdict(input.llm.verdict),
      verdict: input.llm.verdict,
      confidence: input.llm.confidence,
      riskScore: input.llm.riskScore,
      name: input.name,
      publicIdentifier: input.publicIdentifier,
      headline: input.headline,
      summary: input.llm.summary,
      redFlags: input.llm.redFlags,
      supportingSignals: input.llm.supportingSignals,
      profile: input.profile,
    };
  }

  private emptyResult(error: string): OutreachFakeProfileDetectorResult {
    return {
      success: false,
      total: 0,
      fakeCount: 0,
      genuineCount: 0,
      uncertainCount: 0,
      error,
      fakeProfiles: [],
      genuineProfiles: [],
      assessments: [],
    };
  }

  private async mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let offset = 0; offset < items.length; offset += batchSize) {
      const batch = items.slice(offset, offset + batchSize);
      const mapped = await Promise.all(
        batch.map((item, batchIndex) => mapper(item, offset + batchIndex)),
      );

      results.push(...mapped);
    }

    return results;
  }

  private async resolveModel(input: {
    workspaceId?: string;
    modelId?: string;
  }): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const hy3Model = this.aiModelRegistryService.getModel(
        OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
      );
      const defaultFastModel =
        hy3Model ?? this.aiModelRegistryService.getDefaultSpeedModel();
      const modelId = hasText(input.modelId)
        ? input.modelId
        : defaultFastModel.modelId;

      if (hasText(input.workspaceId)) {
        return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
          { modelId },
          input.workspaceId,
        );
      }

      return this.aiModelRegistryService.getModel(modelId) ?? defaultFastModel;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve AI model for fake-profile detection: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
