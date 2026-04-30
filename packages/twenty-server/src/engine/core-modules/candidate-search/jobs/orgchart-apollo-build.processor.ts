import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';

import type { OrgchartApolloBuildJobData } from './orgchart-apollo-build.types';

@Processor(MessageQueue.orgchartApifyQueue)
export class OrgchartApolloBuildProcessor {
  constructor(
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  @Process({ jobName: OrgchartApolloBuildProcessor.name, concurrency: 2 })
  async handle(jobData: OrgchartApolloBuildJobData): Promise<void> {
    await this.orgChartLinkedInBuildService.handleApolloOrgChartJob(jobData);
  }
}
