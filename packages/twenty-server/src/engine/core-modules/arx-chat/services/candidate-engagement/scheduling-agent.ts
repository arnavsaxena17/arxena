import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Repository, In, EntityManager } from 'typeorm';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { InjectRepository } from '@nestjs/typeorm';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

let timeScheduleCron:string
console.log("Current Environment Is:", process.env.NODE_ENV)
if(process.env.NODE_ENV === 'development'){
  // cron to run every 30 seconds in development
  timeScheduleCron = '*/30 * * * * *'
}
else{
  // cron to run every 5 minutes
  // timeScheduleCron = '*/3 * * * *'
  timeScheduleCron = '*/30 * * * * *'

}

@Injectable()
export class TasksService {
  constructor(

  @InjectRepository(Workspace, 'core')
  private readonly workspaceRepository: Repository<Workspace>,
  @InjectRepository(DataSourceEntity, 'metadata')
  private readonly dataSourceRepository: Repository<DataSourceEntity>,
  private readonly environmentService: EnvironmentService,
  private readonly workspaceDataSourceService: WorkspaceDataSourceService,

) {}
@Cron(timeScheduleCron)
  async handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    console.log("Starting CRON CYCLE")
    await this.runWorkspaceServiceCandidateEngagement()
    if (process.env.RUN_SCHEDULER === 'true') {
      console.log("Checking Engagement")
      await new CandidateEngagementArx().checkCandidateEngagement();
    } else {
      console.log('Scheduler is turned off');
    }
    console.log("ENDING CRON CYCLE")
  }

  async runWorkspaceServiceCandidateEngagement(    transactionManager?: EntityManager  ){
    console.log("workspaceRepository:", this.workspaceRepository)
    console.log("this.environmentService:", this.environmentService)
    const workspaceIds = (
      await this.workspaceRepository.find({
        where: this.environmentService.get('IS_BILLING_ENABLED')
          ? {
              subscriptionStatus: In(['active', 'trialing', 'past_due']),
            }
          : {},
        select: ['id'],
      })
    ).map((workspace) => workspace.id);
    console.log("workspaceIds::", workspaceIds)
  
  
    const dataSources = await this.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });

    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );

    console.log("workspaceIdsWithDataSources::", workspaceIdsWithDataSources)
    console.log("dataSources::", dataSources)
  
    for (const workspaceId of workspaceIdsWithDataSources) {
      
      const dataSourceSchema =
        this.workspaceDataSourceService.getSchemaName(workspaceId);
        console.log("dataSourceSchema::", dataSourceSchema)

        const lastPosition = await this.workspaceDataSourceService.executeRawQuery(
          `SELECT MAX(position) FROM ${dataSourceSchema}.person`,
          [],
          workspaceId,
          transactionManager,
        );
        console.log("lastPosition::", lastPosition, "for workspace ID:", workspaceId, "for dataSourceSchema:", dataSourceSchema)
    }




  }

  

}


// import { Command, CommandRunner } from 'nest-commander';

// import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
// import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
// import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
// import { GoogleCalendarSyncCronJob } from 'src/modules/calendar/crons/jobs/google-calendar-sync.cron.job';

// const GOOGLE_CALENDAR_SYNC_CRON_PATTERN = '*/5 * * * *';

// @Command({
//   name: 'cron:calendar:google-calendar-sync',
//   description: 'Starts a cron job to sync google calendar for all workspaces.',
// })
// export class TasksService extends CommandRunner {
//   constructor(
//     @InjectMessageQueue(MessageQueue.cronQueue)
//     private readonly messageQueueService: MessageQueueService,
//   ) {
//     super();
//   }

//   async run(): Promise<void> {
//     await this.messageQueueService.addCron<undefined>(
//       GoogleCalendarSyncCronJob.name,
//       undefined,
//       {
//         repeat: { pattern: GOOGLE_CALENDAR_SYNC_CRON_PATTERN },
//       },
//     );
//   }
// }
