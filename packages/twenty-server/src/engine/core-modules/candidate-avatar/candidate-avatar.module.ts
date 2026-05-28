import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';

import { AvatarController } from './controllers/avatar.controller';
import { CandidateAvatarFetchService } from './services/candidate-avatar-fetch.service';
import { CandidateAvatarRefreshService } from './services/candidate-avatar-refresh.service';
import { CandidateAvatarStorageService } from './services/candidate-avatar-storage.service';

@Module({
  imports: [UnipilePoolModule],
  controllers: [AvatarController],
  providers: [
    CandidateAvatarFetchService,
    CandidateAvatarStorageService,
    CandidateAvatarRefreshService,
  ],
  exports: [
    CandidateAvatarFetchService,
    CandidateAvatarStorageService,
    CandidateAvatarRefreshService,
  ],
})
export class CandidateAvatarModule {}
