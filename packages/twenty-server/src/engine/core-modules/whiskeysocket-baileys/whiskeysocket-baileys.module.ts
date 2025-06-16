import { Module } from '@nestjs/common';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { WhatsappController } from './whiskeysocket-baileys.controller';
import { WhatsappService } from './whiskeysocket-baileys.service';

@Module({
  imports: [
    WorkspaceModificationsModule
  ],
  providers: [
    EventsGateway,
    {
      provide: WhatsappService,
      useFactory: (workspaceQueryService: WorkspaceQueryService, eventsGateway: EventsGateway) => {
        return new WhatsappService(
          workspaceQueryService,
          eventsGateway,
          '', // Default empty sessionId
          '', // Default empty socketClientId
          false // Default connectionStatus
        );
      },
      inject: [WorkspaceQueryService, EventsGateway]
    }
  ],
  controllers: [WhatsappController],
  exports: [WhatsappService, EventsGateway]
})
export class WhiskeySocketsBaileysWhatsappModule {}
