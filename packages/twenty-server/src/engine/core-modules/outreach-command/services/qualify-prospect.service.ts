import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type LanguageModel } from 'ai';
import { AUTO_SELECT_SMART_MODEL_ID } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import {
  buildOutreachQualifyProspectPrompt,
  OUTREACH_QUALIFY_PROSPECT_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { outreachQualifyProspectLlmSchema } from 'src/engine/core-modules/outreach-command/schemas/outreach-qualify-prospect-llm.schema';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { OutreachSenderProfileService } from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';
import { buildOutreachProspectEnrichment } from 'src/engine/core-modules/outreach-command/utils/build-outreach-prospect-enrichment.util';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  peopleId?: string | null;
  outreachProspectEnrichment?: Record<string, unknown> | null;
};

type PersonIdentityRecord = ObjectLiteral & {
  id: string;
  jobTitle?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinProfileId?: string | null;
};

export type QualifyProspectInput = {
  workspaceMemberId: string;
  candidateIds?: string[];
  personIds?: string[];
};

export type QualifyProspectRecordResult = {
  candidateId: string;
  success: boolean;
  go?: boolean;
  score?: number;
  error?: string;
};

@Injectable()
export class QualifyProspectService {
  private readonly logger = new Logger(QualifyProspectService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly outreachSenderProfileService: OutreachSenderProfileService,
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: QualifyProspectInput;
  }): Promise<{
    success: boolean;
    results: QualifyProspectRecordResult[];
    error?: string;
  }> {
    const candidateIds = (input.candidateIds ?? []).filter(isNonEmptyString);
    const personIds = (input.personIds ?? []).filter(isNonEmptyString);

    if (candidateIds.length === 0 && personIds.length === 0) {
      return {
        success: false,
        results: [],
        error: 'candidateIds or personIds is required',
      };
    }

    const sender =
      await this.outreachSenderProfileService.getExistingSenderProfile({
        workspaceId,
        workspaceMemberId: input.workspaceMemberId,
      });

    if (!isDefined(sender.outreachSenderProfile)) {
      return {
        success: false,
        results: [],
        error:
          'Build an outreach sender profile for this workspace member before qualifying prospects',
      };
    }

    const senderJson = JSON.stringify(sender.outreachSenderProfile);
    const candidates = await this.resolveCandidates({
      workspaceId,
      candidateIds,
      personIds,
    });

    if (candidates.length === 0) {
      return {
        success: false,
        results: [],
        error:
          personIds.length > 0
            ? 'No linked candidates found for the selected people'
            : 'No candidates found',
      };
    }

    const registeredModel = await this.resolveModel(workspaceId);

    if (!registeredModel) {
      return {
        success: false,
        results: [],
        error: 'No AI model available to qualify prospects',
      };
    }

    const results: QualifyProspectRecordResult[] = [];

    for (const candidate of candidates) {
      try {
        const result = await this.qualifyOneCandidate({
          workspaceId,
          workspaceMemberId: input.workspaceMemberId,
          candidate,
          senderJson,
          modelId: registeredModel.modelId,
          model: registeredModel.model,
        });

        results.push(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Qualify prospect failed';

        this.logger.error(
          `Qualify prospect failed for candidate ${candidate.id}: ${message}`,
        );
        results.push({
          candidateId: candidate.id,
          success: false,
          error: message,
        });
      }
    }

    return {
      success: results.every((result) => result.success),
      results,
    };
  }

  private async qualifyOneCandidate({
    workspaceId,
    workspaceMemberId,
    candidate,
    senderJson,
    modelId,
    model,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    candidate: CandidateRecord;
    senderJson: string;
    modelId: string;
    model: LanguageModel;
  }): Promise<QualifyProspectRecordResult> {
    const person = await this.resolvePersonIdentity({
      workspaceId,
      peopleId: candidate.peopleId,
    });
    const profileResult = await this.fetchLinkedinProfileService.execute({
      workspaceId,
      input: {
        workspaceMemberId,
        candidateId: candidate.id,
        linkedinUrl: person?.linkedinLink?.primaryLinkUrl ?? undefined,
        linkedinProfileId: person?.linkedinProfileId ?? undefined,
      },
    });

    if (!profileResult.success) {
      return {
        candidateId: candidate.id,
        success: false,
        error: profileResult.error || 'Failed to fetch LinkedIn profile',
      };
    }

    const userPrompt = buildOutreachQualifyProspectPrompt({
      senderJson,
      profile: [
        `About: ${profileResult.about ?? ''}`,
        `Skills: ${(profileResult.skills ?? []).join(', ')}`,
      ].join('\n'),
      posts: '',
      crm: [
        `Name: ${candidate.name ?? ''}`,
        `Title: ${person?.jobTitle ?? ''}`,
      ].join('\n'),
    });

    const generationResult = await runGenerateObject(
      this.aiSdkExecutionService,
      {
        workspaceId,
        modelId,
        options: {
          model,
          schema: outreachQualifyProspectLlmSchema,
          system: OUTREACH_QUALIFY_PROSPECT_SYSTEM_PROMPT,
          prompt: userPrompt,
          experimental_telemetry: AI_TELEMETRY_CONFIG,
        },
      },
    );

    const enrichment = buildOutreachProspectEnrichment(generationResult.object);
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );

      await candidateRepository.update(candidate.id, {
        outreachProspectEnrichment: enrichment,
      });
    }, authContext);

    return {
      candidateId: candidate.id,
      success: true,
      go: generationResult.object.go,
      score: generationResult.object.score,
    };
  }

  private async resolvePersonIdentity({
    workspaceId,
    peopleId,
  }: {
    workspaceId: string;
    peopleId?: string | null;
  }): Promise<PersonIdentityRecord | null> {
    const trimmedPeopleId = peopleId?.trim() ?? '';

    if (!isNonEmptyString(trimmedPeopleId)) {
      return null;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonIdentityRecord>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        return personRepository.findOne({
          where: { id: trimmedPeopleId },
        });
      },
      authContext,
    );
  }

  private async resolveCandidates({
    workspaceId,
    candidateIds,
    personIds,
  }: {
    workspaceId: string;
    candidateIds: string[];
    personIds: string[];
  }): Promise<CandidateRecord[]> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        if (candidateIds.length > 0) {
          return candidateRepository.find({
            where: { id: In(candidateIds) },
          });
        }

        return candidateRepository.find({
          where: { peopleId: In(personIds) },
        });
      },
      authContext,
    );
  }

  private async resolveModel(
    workspaceId: string,
  ): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
        { modelId: AUTO_SELECT_SMART_MODEL_ID },
        workspaceId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to resolve AI model for qualify prospect: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
