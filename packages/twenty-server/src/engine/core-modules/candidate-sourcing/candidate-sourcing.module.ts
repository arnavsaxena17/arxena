import { Module } from '@nestjs/common';
import { CandidateSourcingController } from './candidate-sourcing.controller';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';

@Module({
  imports: [ AuthModule, WorkspaceModificationsModule],

  controllers: [CandidateSourcingController],

})
export class CandidateSourcingModule {}
