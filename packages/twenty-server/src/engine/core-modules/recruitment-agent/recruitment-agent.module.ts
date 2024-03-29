import { Module } from '@nestjs/common';

import { RecruitmentAgentController } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.controller';

@Module({
  imports: [],
  controllers: [RecruitmentAgentController],
  providers: [],
  exports: [],
})
export class RecruitmentAgentModule {}
