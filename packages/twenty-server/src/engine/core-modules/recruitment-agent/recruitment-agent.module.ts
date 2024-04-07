import { Module } from '@nestjs/common';

import { RecruitmentAgentController } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.controller';
import { TasksService } from 'src/engine/core-modules/recruitment-agent/services/databaseActions/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';


@Module({
  imports: [AuthModule],
  controllers: [RecruitmentAgentController],
  providers: [TasksService],
  exports: [],
})
export class RecruitmentAgentModule {}
