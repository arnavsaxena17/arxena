import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { type Repository } from 'typeorm';

import { SendEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/send-email-tool';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { EmailWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/mail-sender/email-workflow-action.base';
import { isWorkflowSendEmailAction } from 'src/modules/workflow/workflow-executor/workflow-actions/mail-sender/guards/is-workflow-send-email-action.guard';
import { type EmailStepLogMode } from 'src/modules/workflow/workflow-executor/workflow-actions/mail-sender/utils/build-email-step-log.util';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class SendEmailWorkflowAction extends EmailWorkflowActionBase {
  constructor(
    private readonly sendEmailTool: SendEmailTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(ConnectedAccountEntity)
    connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(UserWorkspaceEntity)
    userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @Optional()
    private readonly gtmOutreachMessagePersistService?: OutreachMessagePersistService,
  ) {
    super(
      SendEmailWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
      connectedAccountRepository,
      userWorkspaceRepository,
    );
  }

  override async execute(
    workflowActionInput: WorkflowActionInput,
  ): Promise<WorkflowActionOutput> {
    const output = await super.execute(workflowActionInput);

    if (
      output.error ||
      !isDefined(this.gtmOutreachMessagePersistService) ||
      !isDefined(output.result)
    ) {
      return output;
    }

    try {
      const workflowRun =
        await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
          workflowRunId: workflowActionInput.runInfo.workflowRunId,
          workspaceId: workflowActionInput.runInfo.workspaceId,
        });
      const candidateId = workflowRun.candidateId;

      if (!isDefined(candidateId)) {
        return output;
      }

      await this.gtmOutreachMessagePersistService.materializeCandidateEvent({
        workspaceId: workflowActionInput.runInfo.workspaceId,
        event: 'outbound_message',
        candidateId,
        messagingChannel: 'EMAIL',
        outboundMessageKind: 'EMAIL',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to materialize outbound_message after send-email for workflowRun=${workflowActionInput.runInfo.workflowRunId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return output;
  }

  protected getTool(): Tool {
    return this.sendEmailTool;
  }

  protected getMode(): EmailStepLogMode {
    return 'SEND';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowSendEmailAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a send-email action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }
}
