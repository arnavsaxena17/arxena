import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TimeManagement } from '../../arx-chat/services/time-management';

const CRON_DISABLED = true;

@Injectable()
export class LinkedinSockIncomingMessageFetchingCronService {
  private readonly logger = new Logger(LinkedinSockIncomingMessageFetchingCronService.name);

  @Cron(TimeManagement.crontabs.crontTabToFetchLinkedinSockMessages, {
    name: 'linkedin-sock-message-task',
    disabled: CRON_DISABLED,
  })
  async handleFiveHoursCron() {
    this.logger.log('LinkedIn sock message fetching cron job triggered');
  }
} 