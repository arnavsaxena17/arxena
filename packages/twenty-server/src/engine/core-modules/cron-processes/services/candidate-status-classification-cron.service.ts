import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TimeManagement } from '../../arx-chat/services/time-management';

const CRON_DISABLED = true;

@Injectable()
export class CandidateStatusClassificationCronService {
  private readonly logger = new Logger(CandidateStatusClassificationCronService.name);

  @Cron(TimeManagement.crontabs.crontTabToUpdateCandidatesChatControls, {
    name: 'candidate-status-classification-task',
    disabled: CRON_DISABLED,
  })
  async handleFiveHoursCron() {
    this.logger.log('Candidate status classification cron job triggered');
  }
} 