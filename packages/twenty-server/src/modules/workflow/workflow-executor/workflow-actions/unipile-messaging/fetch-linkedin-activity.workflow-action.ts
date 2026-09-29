import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, resolveInput } from 'twenty-shared/utils';
import { type WorkflowRunStepLog } from 'twenty-shared/workflow';
import { type ObjectLiteral } from 'typeorm';

import { formatOutreachProspectPostsForLlm } from 'src/engine/core-modules/outreach-command/utils/format-outreach-llm-context.util';
import { FetchLinkedinActivityTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/fetch-linkedin-activity-tool';
import { mergePersonLinkedinPostsField } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/merge-person-linkedin-posts.util';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { OutreachUnipilePacingService } from 'src/engine/core-modules/outreach-command/services/outreach-unipile-pacing.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { isWorkflowFetchLinkedinActivityAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-fetch-linkedin-activity-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowFetchLinkedinActivityActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-fetch-linkedin-activity-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

type CandidatePeopleIdRecord = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
};

type PersonLinkedinPostsRecord = ObjectLiteral & {
  id: string;
  linkedinPosts?: Record<string, unknown> | null;
};

@Injectable()
export class FetchLinkedinActivityWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowFetchLinkedinActivityActionInput> {
  constructor(
    private readonly fetchLinkedinActivityTool: FetchLinkedinActivityTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    private readonly workspaceOrmManager: GlobalWorkspaceOrmManager,
    gtmUnipilePacingService: OutreachUnipilePacingService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    delayedQueue: MessageQueueService,
  ) {
    super(
      FetchLinkedinActivityWorkflowAction.name,
      workflowRunStepLogService,
      workspaceOrmManager,
      gtmUnipilePacingService,
      delayedQueue,
    );
  }

  // Read path — request service rate-limits Unipile endpoints.
  protected override getPacingChannel() {
    return null;
  }

  protected getTool(): Tool {
    return this.fetchLinkedinActivityTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'linkedin';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowFetchLinkedinActivityAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a fetch-linkedin-activity action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowFetchLinkedinActivityActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'LINKEDIN_ACTIVITY',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.linkedinProfileId,
      output,
      durationMs,
    });
  }

  override async execute(
    workflowActionInput: WorkflowActionInput,
  ): Promise<WorkflowActionOutput> {
    const output = await super.execute(workflowActionInput);

    if (!isDefined(output.result) || typeof output.result !== 'object') {
      return output;
    }

    const result = output.result as Record<string, unknown>;
    const posts = Array.isArray(result.posts) ? result.posts : [];
    const text = formatOutreachProspectPostsForLlm(posts);
    const enrichedResult = {
      ...result,
      text,
    };

    const step = workflowActionInput.steps.find(
      (workflowStep) => workflowStep.id === workflowActionInput.currentStepId,
    );
    const resolvedStepInput = isWorkflowFetchLinkedinActivityAction(step)
      ? (resolveInput(
          step.settings.input,
          workflowActionInput.context,
        ) as WorkflowFetchLinkedinActivityActionInput)
      : undefined;
    const inputCandidateId = resolvedStepInput?.candidateId?.trim() ?? '';

    if (isNonEmptyString(inputCandidateId) && posts.length > 0) {
      await this.stampPersonLinkedinPosts({
        workspaceId: workflowActionInput.runInfo.workspaceId,
        candidateId: inputCandidateId,
        posts,
        mostRecentPost: result.mostRecentPost,
      });
    }

    return {
      ...output,
      result: enrichedResult,
    };
  }

  private async stampPersonLinkedinPosts({
    workspaceId,
    candidateId,
    posts,
    mostRecentPost,
  }: {
    workspaceId: string;
    candidateId: string;
    posts: unknown[];
    mostRecentPost: unknown;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    try {
      await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
        const candidateRepository =
          await this.workspaceOrmManager.getRepository<CandidatePeopleIdRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const candidate = await candidateRepository.findOne({
          where: { id: candidateId },
        });
        const peopleId = candidate?.peopleId?.trim() ?? '';

        if (!isNonEmptyString(peopleId)) {
          return;
        }

        const personRepository =
          await this.workspaceOrmManager.getRepository<PersonLinkedinPostsRecord>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const person = await personRepository.findOne({
          where: { id: peopleId },
        });

        await personRepository.update(peopleId, {
          linkedinPosts: mergePersonLinkedinPostsField({
            existing: person?.linkedinPosts,
            incomingPosts: posts,
            incomingMostRecentPost: mostRecentPost,
          }),
        });
      }, authContext);
    } catch (error) {
      this.logger.warn(
        `Failed to stamp person.linkedinPosts for candidate ${candidateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
