import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';

import { PrivacyConsentEventEntity } from './privacy-consent-event.entity';
import { PrivacyConsentService } from './privacy-consent.service';
import { WebsitePrivacyConsentController } from './website-privacy-consent.controller';

@Module({
  imports: [
    EnvironmentModule,
    TypeOrmModule.forFeature([PrivacyConsentEventEntity]),
  ],
  controllers: [WebsitePrivacyConsentController],
  providers: [PrivacyConsentService],
  exports: [PrivacyConsentService],
})
export class PrivacyConsentModule {}
