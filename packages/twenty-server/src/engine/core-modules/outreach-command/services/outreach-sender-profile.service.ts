import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';
import { v4 } from 'uuid';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OUTREACH_SENDER_PROFILE_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-sender-profile-model.const';
import {
  OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT,
  buildOutreachSenderProfileUserPrompt,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import {
  outreachSenderProfileLlmSchema,
  type OutreachSenderProfileLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-sender-profile-llm.schema';
import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  EMPTY_OUTREACH_SENDER_PROFILE,
  buildSenderProfileSeed,
  normalizeOutreachSenderProfile,
} from 'src/engine/core-modules/outreach-command/utils/outreach-sender-profile.util';
import { formatLinkedinProfileAsResumeText } from 'src/engine/core-modules/org-chart-outreach/prompts/mom-test-question-generator.prompt';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

const SENDER_PROFILE_GENERATE_LLM_TIMEOUT_MS = 120_000;
const SENDER_PROFILE_GENERATE_JOB_TTL_MS = 10 * 60 * 1000;

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  userEmail?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  phoneNumber?: string | null;
  linkedinUnipileAccountId?: string | null;
  linkedinProfile?: Record<string, unknown> | null;
  outreachSenderProfile?: OutreachSenderProfile | null;
};

export type StampSenderProfileFromWorkspaceBootstrapInput = {
  workspaceId: string;
  workspaceMemberId?: string;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  industry?: string | null;
  summary?: string | null;
  hq?: string | null;
  targetTitles?: string[];
  locations?: string[];
  force?: boolean;
};

type BuildAndSaveSenderProfileInput = {
  workspaceId: string;
  workspaceMemberId: string;
  linkedinProfileText: string;
  collateralText?: string;
  senderNotes?: string;
  senderProfile?: OutreachSenderProfile;
};

type GenerateSenderProfileInput = {
  workspaceId: string;
  workspaceMemberId: string;
  linkedinProfileText?: string;
  collateralText?: string;
  senderNotes?: string;
  modelId?: string;
};

type GenerateSenderProfileResult = {
  draft: OutreachSenderProfile;
  prompt: { system: string; user: string };
  linkedinProfileText: string;
  existingSenderProfile: OutreachSenderProfile | null;
};

export type OutreachSenderProfileGenerateJobStatus =
  | 'pending'
  | 'ready'
  | 'failed';

export type OutreachSenderProfileGenerateJob = {
  status: OutreachSenderProfileGenerateJobStatus;
  workspaceId: string;
  workspaceMemberId: string;
  draft?: OutreachSenderProfile;
  linkedinProfileText?: string;
  existingSenderProfile?: OutreachSenderProfile | null;
  error?: string;
};

@Injectable()
export class OutreachSenderProfileService {
  private readonly logger = new Logger(OutreachSenderProfileService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  getBuildPrompt(input: {
    linkedinProfileText: string;
    collateralText?: string;
    senderNotes?: string;
    existingObject?: OutreachSenderProfile | null;
  }): { system: string; user: string } {
    return {
      system: OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT,
      user: buildOutreachSenderProfileUserPrompt({
        linkedinProfileText: input.linkedinProfileText,
        collateralText: input.collateralText,
        senderNotes: input.senderNotes,
        existingObjectJson: input.existingObject
          ? JSON.stringify(input.existingObject)
          : undefined,
      }),
    };
  }

  async getExistingSenderProfile({
    workspaceId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<{
    profileId: string | null;
    outreachSenderProfile: OutreachSenderProfile | null;
    linkedinUrl: string;
    linkedinUnipileAccountId: string | null;
    linkedinProfileText: string;
  }> {
    const member = await this.findWorkspaceMember(
      workspaceId,
      workspaceMemberId,
    );
    const rawProfile = member?.outreachSenderProfile ?? null;
    const outreachSenderProfile = isDefined(rawProfile)
      ? normalizeOutreachSenderProfile(rawProfile)
      : null;

    return {
      profileId: member?.id ?? null,
      outreachSenderProfile,
      linkedinUrl: member?.linkedinUrl?.trim() ?? '',
      linkedinUnipileAccountId:
        member?.linkedinUnipileAccountId?.trim() ?? null,
      linkedinProfileText: this.buildLinkedinProfileText(member),
    };
  }

  async fetchAndSaveSenderLinkedinProfile({
    workspaceId,
    workspaceMemberId,
    linkedinUrl,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    linkedinUrl?: string;
  }): Promise<{
    linkedinUrl: string;
    linkedinProfileText: string;
    linkedinProfile: Record<string, unknown>;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const member = await repository.findOne({
          where: { id: workspaceMemberId },
        });

        if (!isDefined(member?.id)) {
          throw new Error(
            `No workspaceMember for workspaceMemberId=${workspaceMemberId}`,
          );
        }

        const resolvedLinkedinUrl = isNonEmptyString(linkedinUrl?.trim())
          ? linkedinUrl.trim()
          : (member.linkedinUrl?.trim() ?? '');

        if (!isNonEmptyString(resolvedLinkedinUrl)) {
          throw new Error(
            'LinkedIn URL is required to fetch the sender profile',
          );
        }

        const accountId = member.linkedinUnipileAccountId?.trim() ?? '';

        if (!isNonEmptyString(accountId)) {
          throw new Error(
            'Connect LinkedIn Unipile on this seat before fetching the sender profile',
          );
        }

        const identifier = extractLinkedinProfileId(resolvedLinkedinUrl);

        if (!isNonEmptyString(identifier)) {
          throw new Error('Could not parse a LinkedIn profile id from the URL');
        }

        const linkedinProfile =
          await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
            accountId,
            identifier,
            { linkedinSections: ['*'] },
          );

        if (!isDefined(linkedinProfile)) {
          throw new Error('Unipile returned no LinkedIn profile');
        }

        const systemActor = buildCreatedByFromSystem();

        await repository.update(
          { id: member.id },
          {
            linkedinUrl: resolvedLinkedinUrl,
            linkedinProfile,
            updatedBy: systemActor,
          },
        );

        const linkedinProfileText =
          formatLinkedinProfileAsResumeText(linkedinProfile);

        this.logger.log(
          `Saved LinkedIn profile JSON for sender workspaceMemberId=${workspaceMemberId}`,
        );

        return {
          linkedinUrl: resolvedLinkedinUrl,
          linkedinProfileText,
          linkedinProfile,
        };
      },
      authContext,
    );
  }

  async enqueueGenerateSenderProfile(
    input: GenerateSenderProfileInput,
  ): Promise<{ draftJobId: string }> {
    const draftJobId = v4();
    const pendingJob: OutreachSenderProfileGenerateJob = {
      status: 'pending',
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
    };

    await this.cache.set(
      this.generateJobCacheKey(draftJobId),
      pendingJob,
      SENDER_PROFILE_GENERATE_JOB_TTL_MS,
    );

    void this.runGenerateSenderProfileJob(draftJobId, input);

    return { draftJobId };
  }

  async getGenerateSenderProfileJob({
    draftJobId,
    workspaceId,
    workspaceMemberId,
  }: {
    draftJobId: string;
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<OutreachSenderProfileGenerateJob> {
    const job = await this.cache.get<OutreachSenderProfileGenerateJob>(
      this.generateJobCacheKey(draftJobId),
    );

    if (!isDefined(job)) {
      throw new Error('Generate job not found or expired');
    }

    if (
      job.workspaceId !== workspaceId ||
      job.workspaceMemberId !== workspaceMemberId
    ) {
      throw new Error('Generate job not found or expired');
    }

    return job;
  }

  async generateSenderProfile(
    input: GenerateSenderProfileInput,
  ): Promise<GenerateSenderProfileResult> {
    const existing = await this.getExistingSenderProfile({
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
    });

    const linkedinProfileText = isNonEmptyString(input.linkedinProfileText)
      ? input.linkedinProfileText.trim()
      : existing.linkedinProfileText;

    if (!isNonEmptyString(linkedinProfileText)) {
      throw new Error(
        'Fetch the LinkedIn profile for this seat before generating a sender profile',
      );
    }

    const prompt = this.getBuildPrompt({
      linkedinProfileText,
      collateralText: input.collateralText,
      senderNotes: input.senderNotes,
      existingObject: existing.outreachSenderProfile,
    });

    const registeredModel = await this.resolveModel({
      workspaceId: input.workspaceId,
      modelId: input.modelId,
    });

    if (!registeredModel) {
      throw new Error(
        'No AI model available to generate outreach sender profile',
      );
    }

    const generationResult = await runGenerateObject(
      this.aiSdkExecutionService,
      {
        workspaceId: input.workspaceId,
        modelId: registeredModel.modelId,
        options: {
          model: registeredModel.model,
          schema: outreachSenderProfileLlmSchema,
          system: prompt.system,
          prompt: prompt.user,
          timeout: { totalMs: SENDER_PROFILE_GENERATE_LLM_TIMEOUT_MS },
          experimental_telemetry: AI_TELEMETRY_CONFIG,
        },
      },
    );

    const draft = normalizeOutreachSenderProfile(
      generationResult.object as OutreachSenderProfileLlmResult,
    );

    this.logger.log(
      `Generated outreachSenderProfile for member ${input.workspaceMemberId} model=${registeredModel.modelId}`,
    );

    return {
      draft,
      prompt,
      linkedinProfileText,
      existingSenderProfile: existing.outreachSenderProfile,
    };
  }

  private generateJobCacheKey(draftJobId: string): string {
    return `sender-profile-draft:${draftJobId}`;
  }

  private async runGenerateSenderProfileJob(
    draftJobId: string,
    input: GenerateSenderProfileInput,
  ): Promise<void> {
    try {
      const result = await this.generateSenderProfileWithRetry(input);

      await this.saveSenderProfile({
        workspaceId: input.workspaceId,
        workspaceMemberId: input.workspaceMemberId,
        senderProfile: result.draft,
      });

      await this.cache.set(
        this.generateJobCacheKey(draftJobId),
        {
          status: 'ready',
          workspaceId: input.workspaceId,
          workspaceMemberId: input.workspaceMemberId,
          draft: result.draft,
          linkedinProfileText: result.linkedinProfileText,
          existingSenderProfile: result.existingSenderProfile,
        } satisfies OutreachSenderProfileGenerateJob,
        SENDER_PROFILE_GENERATE_JOB_TTL_MS,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate outreach sender profile';

      this.logger.error(
        `Sender profile generate job ${draftJobId} failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.cache.set(
        this.generateJobCacheKey(draftJobId),
        {
          status: 'failed',
          workspaceId: input.workspaceId,
          workspaceMemberId: input.workspaceMemberId,
          error: errorMessage,
        } satisfies OutreachSenderProfileGenerateJob,
        SENDER_PROFILE_GENERATE_JOB_TTL_MS,
      );
    }
  }

  private async generateSenderProfileWithRetry(
    input: GenerateSenderProfileInput,
  ): Promise<GenerateSenderProfileResult> {
    try {
      return await this.generateSenderProfile(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isEmptyResponse =
        message.includes('No object generated') ||
        message.includes('did not return a response');

      if (!isEmptyResponse) {
        throw error;
      }

      this.logger.warn(
        `Sender profile generate empty response for member ${input.workspaceMemberId}; retrying once`,
      );

      return await this.generateSenderProfile(input);
    }
  }

  async saveSenderProfile({
    workspaceId,
    workspaceMemberId,
    senderProfile,
    replaceCollateralFiles = false,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    senderProfile: OutreachSenderProfile;
    // Draft/generate saves omit files; append/remove/explicit UI saves replace.
    replaceCollateralFiles?: boolean;
  }): Promise<{
    profileId: string;
    outreachSenderProfile: OutreachSenderProfile;
  }> {
    const normalized = normalizeOutreachSenderProfile(senderProfile);
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const existing = await repository.findOne({
          where: { id: workspaceMemberId },
        });

        if (!isDefined(existing?.id)) {
          throw new Error(
            `No workspaceMember for workspaceMemberId=${workspaceMemberId}`,
          );
        }

        const existingProfile = isDefined(existing.outreachSenderProfile)
          ? normalizeOutreachSenderProfile(existing.outreachSenderProfile)
          : EMPTY_OUTREACH_SENDER_PROFILE;
        const incomingCollateral = normalized.collateralFiles ?? [];
        const nextProfile: OutreachSenderProfile = {
          ...normalized,
          collateralFiles:
            replaceCollateralFiles || incomingCollateral.length > 0
              ? incomingCollateral
              : (existingProfile.collateralFiles ?? []),
        };

        const systemActor = buildCreatedByFromSystem();

        await repository.update(
          { id: existing.id },
          {
            outreachSenderProfile: nextProfile,
            updatedBy: systemActor,
          },
        );

        this.logger.log(
          `Saved outreachSenderProfile for member ${workspaceMemberId}`,
        );

        return {
          profileId: existing.id,
          outreachSenderProfile: nextProfile,
        };
      },
      authContext,
    );
  }

  async appendCollateralFile({
    workspaceId,
    workspaceMemberId,
    fileId,
    fileName,
    mimeType,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    fileId: string;
    fileName: string;
    mimeType?: string;
  }): Promise<{
    profileId: string;
    outreachSenderProfile: OutreachSenderProfile;
  }> {
    const existing = await this.getExistingSenderProfile({
      workspaceId,
      workspaceMemberId,
    });

    const baseProfile =
      existing.outreachSenderProfile ?? EMPTY_OUTREACH_SENDER_PROFILE;
    const nextFiles = [
      ...(baseProfile.collateralFiles ?? []).filter(
        (file) => file.fileId !== fileId,
      ),
      {
        fileId,
        fileName,
        mimeType,
      },
    ];

    return this.saveSenderProfile({
      workspaceId,
      workspaceMemberId,
      senderProfile: {
        ...baseProfile,
        collateralFiles: nextFiles,
      },
      replaceCollateralFiles: true,
    });
  }

  async removeCollateralFile({
    workspaceId,
    workspaceMemberId,
    fileId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    fileId: string;
  }): Promise<{
    profileId: string;
    outreachSenderProfile: OutreachSenderProfile;
  }> {
    const existing = await this.getExistingSenderProfile({
      workspaceId,
      workspaceMemberId,
    });

    const baseProfile =
      existing.outreachSenderProfile ?? EMPTY_OUTREACH_SENDER_PROFILE;

    return this.saveSenderProfile({
      workspaceId,
      workspaceMemberId,
      senderProfile: {
        ...baseProfile,
        collateralFiles: (baseProfile.collateralFiles ?? []).filter(
          (file) => file.fileId !== fileId,
        ),
      },
      replaceCollateralFiles: true,
    });
  }

  async stampSenderProfileFromWorkspaceBootstrap(
    input: StampSenderProfileFromWorkspaceBootstrapInput,
  ): Promise<OutreachSenderProfile | null> {
    const member = await this.resolveBootstrapWorkspaceMember(input);

    if (!isDefined(member?.id)) {
      this.logger.warn(
        `Skipping sender profile stamp for workspace ${input.workspaceId}: no workspace member`,
      );

      return null;
    }

    const firstName = member.name?.firstName?.trim() ?? '';
    const lastName = member.name?.lastName?.trim() ?? '';
    const fullName = [firstName, lastName].filter(isNonEmptyString).join(' ');

    const seed = buildSenderProfileSeed({
      fullName,
      title: member.jobTitle,
      companyName: input.companyName,
      industry: input.industry,
      summary: input.summary,
      targetTitles: input.targetTitles,
      locations: input.locations,
    });

    const force = input.force === true;
    const existingProfile = isDefined(member.outreachSenderProfile)
      ? normalizeOutreachSenderProfile(member.outreachSenderProfile)
      : null;

    if (isDefined(existingProfile) && !force) {
      const filled: OutreachSenderProfile = {
        targetTitles:
          existingProfile.targetTitles.length > 0
            ? existingProfile.targetTitles
            : seed.targetTitles,
        locations:
          existingProfile.locations.length > 0
            ? existingProfile.locations
            : seed.locations,
        brief: isNonEmptyString(existingProfile.brief)
          ? existingProfile.brief
          : seed.brief,
      };

      const saved = await this.saveSenderProfile({
        workspaceId: input.workspaceId,
        workspaceMemberId: member.id,
        senderProfile: filled,
      });

      return saved.outreachSenderProfile;
    }

    let nextProfile = seed;
    const linkedinProfileText = this.buildLinkedinProfileText(member);

    if (isNonEmptyString(linkedinProfileText)) {
      try {
        const generated = await this.generateSenderProfileWithRetry({
          workspaceId: input.workspaceId,
          workspaceMemberId: member.id,
          linkedinProfileText,
        });

        nextProfile = {
          targetTitles:
            generated.draft.targetTitles.length > 0
              ? generated.draft.targetTitles
              : seed.targetTitles,
          locations:
            generated.draft.locations.length > 0
              ? generated.draft.locations
              : seed.locations,
          brief: isNonEmptyString(generated.draft.brief)
            ? generated.draft.brief
            : seed.brief,
        };
      } catch (error) {
        this.logger.warn(
          `Sender profile LLM stamp failed for member ${member.id}; using seed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const saved = await this.saveSenderProfile({
      workspaceId: input.workspaceId,
      workspaceMemberId: member.id,
      senderProfile: nextProfile,
    });

    return saved.outreachSenderProfile;
  }

  async updateSenderLinkedinUrl({
    workspaceId,
    workspaceMemberId,
    linkedinUrl,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    linkedinUrl: string;
  }): Promise<{ linkedinUrl: string }> {
    const trimmedUrl = linkedinUrl.trim();
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const existing = await repository.findOne({
          where: { id: workspaceMemberId },
        });

        if (!isDefined(existing?.id)) {
          throw new Error(
            `No workspaceMember for workspaceMemberId=${workspaceMemberId}`,
          );
        }

        const systemActor = buildCreatedByFromSystem();

        await repository.update(
          { id: existing.id },
          {
            linkedinUrl: isNonEmptyString(trimmedUrl) ? trimmedUrl : null,
            updatedBy: systemActor,
          },
        );

        return { linkedinUrl: trimmedUrl };
      },
      authContext,
    );
  }

  async buildAndSaveSenderProfile(
    input: BuildAndSaveSenderProfileInput,
  ): Promise<{
    profileId: string;
    outreachSenderProfile: OutreachSenderProfile;
    prompt: { system: string; user: string };
  }> {
    const existing = await this.getExistingSenderProfile({
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
    });

    const linkedinProfileText = isNonEmptyString(input.linkedinProfileText)
      ? input.linkedinProfileText
      : existing.linkedinProfileText;

    const prompt = this.getBuildPrompt({
      linkedinProfileText,
      collateralText: input.collateralText,
      senderNotes: input.senderNotes,
      existingObject: existing.outreachSenderProfile,
    });

    const senderProfile = input.senderProfile ?? existing.outreachSenderProfile;

    if (!isDefined(senderProfile)) {
      throw new Error(
        'senderProfile is required after human review (generate does not auto-call the LLM on save)',
      );
    }

    const saved = await this.saveSenderProfile({
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
      senderProfile,
      // HTTP save from setup always sends the attachment list the UI holds.
      replaceCollateralFiles: true,
    });

    return { ...saved, prompt };
  }

  async resolveOperatorSenderProfile({
    workspaceId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    workspaceMemberId?: string | null;
  }): Promise<OutreachSenderProfile | null> {
    if (isNonEmptyString(workspaceMemberId)) {
      const existing = await this.getExistingSenderProfile({
        workspaceId,
        workspaceMemberId,
      });

      return existing.outreachSenderProfile;
    }

    const member = await this.resolveBootstrapWorkspaceMember({
      workspaceId,
    });

    if (!isDefined(member?.id)) {
      return null;
    }

    return isDefined(member.outreachSenderProfile)
      ? normalizeOutreachSenderProfile(member.outreachSenderProfile)
      : null;
  }

  private buildLinkedinProfileText(
    member: WorkspaceMemberArxRecord | null | undefined,
  ): string {
    if (
      !isDefined(member?.linkedinProfile) ||
      typeof member.linkedinProfile !== 'object'
    ) {
      return '';
    }

    return formatLinkedinProfileAsResumeText(member.linkedinProfile);
  }

  private async resolveModel(input: {
    workspaceId?: string;
    modelId?: string;
  }): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const deepSeekModel = this.aiModelRegistryService.getModel(
        OUTREACH_SENDER_PROFILE_LLM_MODEL_ID,
      );
      const defaultFastModel =
        deepSeekModel ?? this.aiModelRegistryService.getDefaultSpeedModel();
      const modelId = isNonEmptyString(input.modelId)
        ? input.modelId
        : defaultFastModel.modelId;

      if (isNonEmptyString(input.workspaceId)) {
        return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
          { modelId },
          input.workspaceId,
        );
      }

      return this.aiModelRegistryService.getModel(modelId) ?? defaultFastModel;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve AI model for sender profile generate: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async resolveBootstrapWorkspaceMember(input: {
    workspaceId: string;
    workspaceMemberId?: string;
    userEmail?: string | null;
    userFirstName?: string | null;
    userLastName?: string | null;
  }): Promise<WorkspaceMemberArxRecord | null> {
    if (isNonEmptyString(input.workspaceMemberId)) {
      return this.findWorkspaceMember(
        input.workspaceId,
        input.workspaceMemberId,
      );
    }

    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repository =
            await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
              input.workspaceId,
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );

          const members = await repository.find({
            take: 20,
            order: { createdAt: 'ASC' },
          });

          if (members.length === 0) {
            return null;
          }

          const withUnipile = members.find((member) =>
            isNonEmptyString(member.linkedinUnipileAccountId?.trim()),
          );

          if (isDefined(withUnipile)) {
            return withUnipile;
          }

          const userEmail = input.userEmail?.trim().toLowerCase() ?? '';

          if (isNonEmptyString(userEmail)) {
            const byEmail = members.find(
              (member) => member.userEmail?.trim().toLowerCase() === userEmail,
            );

            if (byEmail) {
              return byEmail;
            }
          }

          const firstName = input.userFirstName?.trim().toLowerCase() ?? '';
          const lastName = input.userLastName?.trim().toLowerCase() ?? '';

          const byName = members.find((member) => {
            const memberFirst =
              member.name?.firstName?.trim().toLowerCase() ?? '';
            const memberLast =
              member.name?.lastName?.trim().toLowerCase() ?? '';

            return (
              (!isNonEmptyString(firstName) || memberFirst === firstName) &&
              (!isNonEmptyString(lastName) || memberLast === lastName)
            );
          });

          return byName ?? members[0] ?? null;
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to resolve bootstrap workspace member for ${input.workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async findWorkspaceMember(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<WorkspaceMemberArxRecord | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repository =
            await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
              workspaceId,
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );

          return repository.findOne({
            where: { id: workspaceMemberId },
          });
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `workspaceMember unavailable for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
