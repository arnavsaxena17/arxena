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
  timeScheduleCron = '*/3 * * * *'
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
