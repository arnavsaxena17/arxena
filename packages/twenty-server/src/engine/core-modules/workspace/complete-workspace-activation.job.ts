import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';

export type CompleteWorkspaceActivationJobData = {
  workspaceId: string;
  userId: string;
  displayName: string;
};

@Processor(MessageQueue.workspaceQueue)
export class CompleteWorkspaceActivationJob {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Process(CompleteWorkspaceActivationJob.name)
  async handle(data: CompleteWorkspaceActivationJobData): Promise<void> {
    await this.workspaceService.completeWorkspaceActivation(data);
  }
}
