import CandidateEngagementArx from "../candidate-engagement/check-candidate-engagement";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  @Cron("*/30 * * * * *")
  async handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    if (process.env.RUN_SCHEDULER === "true") {
      await new CandidateEngagementArx().checkCandidateEngagement();
    }
    else{
      console.log("Scheduler is turned off")
    }
  }
}
