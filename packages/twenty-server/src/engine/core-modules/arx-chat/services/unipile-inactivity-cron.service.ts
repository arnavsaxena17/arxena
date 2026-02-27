import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { UnipileAccountPoolService } from './unipile-account-pool.service';

@Injectable()
export class UnipileInactivityCronService {
  private readonly logger = new Logger(UnipileInactivityCronService.name);

  constructor(
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
  ) {}

  @Cron('*/10 * * * *', { name: 'unipile-inactivity-cleanup' })
  async handleInactivityCleanup(): Promise<void> {
    try {
      await this.unipileAccountPoolService.disconnectInactiveAccounts();
    } catch (err) {
      this.logger.warn('Unipile inactivity cleanup failed:', err);
    }
  }
}
