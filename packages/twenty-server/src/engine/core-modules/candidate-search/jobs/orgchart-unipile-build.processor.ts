import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';

import type { OrgchartUnipileBuildJobData } from './orgchart-unipile-build.types';

@Processor(MessageQueue.orgchartApifyQueue)
export class OrgchartUnipileBuildProcessor {
  constructor(
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  @Process({ jobName: OrgchartUnipileBuildProcessor.name, concurrency: 1 })
  async handle(jobData: OrgchartUnipileBuildJobData): Promise<void> {
    await this.orgChartLinkedInBuildService.handleUnipileOrgChartJob(jobData);
  }
}
