import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { v4 as uuidv4 } from 'uuid';

import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class ScheduledJobService {
  private workspaceQueryService: WorkspaceQueryService;

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    workspaceQueryService: WorkspaceQueryService,
  ) {
    this.workspaceQueryService = workspaceQueryService;
  }

  scheduleJobForSpecificTime(data: any, scheduledTime: Date): string {
    const jobId = uuidv4();
    const now = new Date();
    const timeUntilExecution = scheduledTime.getTime() - now.getTime();

    if (timeUntilExecution <= 0) {
      console.log('Target time is in the past, executing immediately');
      this.executeScheduledJob(data);

      return uuidv4(); // Return a job ID even for immediate execution
    }

    console.log(
      `Scheduling job ${jobId} to run at ${scheduledTime.toISOString()}`,
    );
    console.log(`Time until execution: ${timeUntilExecution}ms`);

    const timeout = setTimeout(async () => {
      try {
        await this.executeScheduledJob(data);
        console.log(
          `Job ${jobId} completed successfully at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error(`Error in job ${jobId}:`, error);
      } finally {
        // Clean up the job from the registry
        try {
          this.schedulerRegistry.deleteTimeout(jobId);
        } catch (e) {
          // Job may already be removed
        }
      }
    }, timeUntilExecution);

    this.schedulerRegistry.addTimeout(jobId, timeout);

    return jobId;
  }

  async executeScheduledJob(data: any): Promise<void> {
    // Check what type of action needs to be performed
    if (!data || !data.action) {
      console.error('Invalid data payload for scheduled job:', data);

      return;
    }

    const { action, candidateProfileDataNodeObj, candidateJob, apiToken } =
      data;

    console.log(
      `Executing scheduled job: ${action} at ${new Date().toISOString()}`,
    );

    try {
      const updateChatService = new UpdateChat(this.workspaceQueryService);
      const phoneNumber =
        '91' + candidateProfileDataNodeObj?.phones.primaryPhoneNumber;

      switch (action) {
        case 'firstInterviewReminder':
          await updateChatService.createInterimChat(
            'firstInterviewReminder',
            phoneNumber,
            apiToken,
          );
          console.log(
            `Sent first interview reminder to ${candidateProfileDataNodeObj?.name?.firstName}`,
          );
          break;

        case 'secondInterviewReminder':
          await updateChatService.createInterimChat(
            'secondInterviewReminder',
            phoneNumber,
            apiToken,
          );
          console.log(
            `Sent second interview reminder to ${candidateProfileDataNodeObj?.name?.firstName}`,
          );
          break;

        case 'closeMeetingStatus':
          await updateChatService.updateMeetingStatusAfterCompletion(
            candidateProfileDataNodeObj,
            candidateJob,
            apiToken,
          );
          console.log(
            `Closed meeting status for ${candidateProfileDataNodeObj?.name?.firstName}`,
          );
          break;
        default:
          console.warn(`Unknown action type: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing scheduled job (${action}):`, error);
    }
  }

  cancelScheduledJob(jobId: string): boolean {
    try {
      this.schedulerRegistry.deleteTimeout(jobId);
      console.log(`Successfully canceled job ${jobId}`);

      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);

      return false;
    }
  }
}
