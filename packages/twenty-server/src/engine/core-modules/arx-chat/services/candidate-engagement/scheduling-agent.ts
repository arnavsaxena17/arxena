import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  @Cron('*/18 * * * * *')
  async handleCron() {
    // this.logger.log("Every 5 seconds check Candidate Engagement is called");
    await new CandidateEngagementArx().checkCandidateEngagement();
  }
}


