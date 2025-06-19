import { Module } from '@nestjs/common';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { EventsGateway } from './events-gateway-module/events-gateway';
import { WhatsappController } from './whiskeysocket-baileys.controller';
import { WhatsappService } from './whiskeysocket-baileys.service';

@Module({
  imports: [
    WorkspaceModificationsModule // Import the module that provides WorkspaceQueryService
  ],
  providers: [
    EventsGateway,
    WhatsappService
  ],
  controllers: [WhatsappController],
  exports: [WhatsappService, EventsGateway]
})
export class WhiskeySocketsBaileysWhatsappModule {}
