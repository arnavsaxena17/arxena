import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';

@Injectable()
export class UnipileLinkedinSnapshotCacheCronService implements OnModuleInit {
  private readonly logger = new Logger(UnipileLinkedinSnapshotCacheCronService.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  onModuleInit(): void {
    void this.refreshSnapshot('startup').catch((error) => {
      this.logger.warn(
        `Initial Unipile LinkedIn snapshot refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  @Cron('0 * * * *', { name: 'unipile-linkedin-snapshot-refresh' })
  async handleHourlyRefresh(): Promise<void> {
    await this.refreshSnapshot('hourly-cron');
  }

  private async refreshSnapshot(trigger: string): Promise<void> {
    try {
      await this.linkedinUnipileRequestService.refreshLinkedinSnapshotFromApi({
        force: true,
        trigger,
      });
    } catch (error) {
      this.logger.warn(
        `Unipile LinkedIn snapshot refresh failed (${trigger}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
