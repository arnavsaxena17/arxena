import { Module } from '@nestjs/common';
import { EnvironmentModule } from '../environment/environment.module';
import { LinkedInSearchController } from './controllers/linkedin-search.controller';
import { LinkedInSearchService } from './services/linkedin-search.service';

@Module({
  imports: [EnvironmentModule],
  controllers: [LinkedInSearchController],
  providers: [LinkedInSearchService],
  exports: [LinkedInSearchService],
})
export class LinkedInSearchModule {}
