import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from '../gmail-sender/gmail-sender.service';
import { DripCampaignController } from './controllers/drip-campaign.controller';
import { EmailTrackingController } from './controllers/email-tracking.controller';
import { CampaignMetrics } from './entities/campaign-metrics.entity';
import { DripCampaign } from './entities/drip-campaign.entity';
import { EmailSequence } from './entities/email-sequence.entity';
import { EmailTracking } from './entities/email-tracking.entity';
import { DripCampaignProcessor } from './processors/drip-campaign.processor';
import { DripCampaignService } from './services/drip-campaign.service';
import { EmailSequenceService } from './services/email-sequence.service';
import { EmailTrackingPixelService } from './services/email-tracking-pixel.service';
import { EmailTrackingService } from './services/email-tracking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DripCampaign,
      EmailSequence,
      EmailTracking,
      CampaignMetrics,
    ]),
    BullModule.registerQueue({
      name: 'drip-campaign',
    }),
  ],
  controllers: [DripCampaignController, EmailTrackingController],
  providers: [
    DripCampaignService,
    EmailSequenceService,
    EmailTrackingService,
    EmailTrackingPixelService,
    MailerService,
    DripCampaignProcessor,
  ],
  exports: [
    DripCampaignService,
    EmailSequenceService,
    EmailTrackingService,
    EmailTrackingPixelService,
  ],
})
export class DripCampaignModule {}
