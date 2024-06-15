import CandidateEngagement from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  @Cron('*/20 * * * * *')
  handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    // new CandidateEngagement().checkCandidateEngagement();
  }
}