import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';

import type { OrgchartMultiSourceBuildJobData } from './orgchart-multisource-build.types';

@Processor(MessageQueue.orgchartApifyQueue)
export class OrgchartMultiSourceBuildProcessor {
  constructor(
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  @Process({ jobName: OrgchartMultiSourceBuildProcessor.name, concurrency: 1 })
  async handle(jobData: OrgchartMultiSourceBuildJobData): Promise<void> {
    await this.orgChartLinkedInBuildService.handleMultiSourceOrgChartJob(jobData);
  }
}

