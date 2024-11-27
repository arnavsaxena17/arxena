import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

let timeScheduleCron:string
console.log("Current Environment Is:", process.env.NODE_ENV)
if(process.env.NODE_ENV === 'development'){
  // cron to run every 30 seconds in development
  timeScheduleCron = '*/30 * * * * *'
}
else{
  // cron to run every 5 minutes
  // timeScheduleCron = '*/3 * * * *'
  timeScheduleCron = '*/30 * * * * *'

}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  @Cron(timeScheduleCron)
  async handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    console.log("Starting CRON CYCLE")
    if (process.env.RUN_SCHEDULER === 'true') {
      console.log("Checking Engagement")
      await new CandidateEngagementArx().checkCandidateEngagement();
    } else {
      console.log('Scheduler is turned off');
    }
    console.log("ENDING CRON CYCLE")
  }
}


// import { Command, CommandRunner } from 'nest-commander';

// import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
// import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
// import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
// import { GoogleCalendarSyncCronJob } from 'src/modules/calendar/crons/jobs/google-calendar-sync.cron.job';

// const GOOGLE_CALENDAR_SYNC_CRON_PATTERN = '*/5 * * * *';

// @Command({
//   name: 'cron:calendar:google-calendar-sync',
//   description: 'Starts a cron job to sync google calendar for all workspaces.',
// })
// export class TasksService extends CommandRunner {
//   constructor(
//     @InjectMessageQueue(MessageQueue.cronQueue)
//     private readonly messageQueueService: MessageQueueService,
//   ) {
//     super();
//   }

//   async run(): Promise<void> {
//     await this.messageQueueService.addCron<undefined>(
//       GoogleCalendarSyncCronJob.name,
//       undefined,
//       {
//         repeat: { pattern: GOOGLE_CALENDAR_SYNC_CRON_PATTERN },
//       },
//     );
//   }
// }
