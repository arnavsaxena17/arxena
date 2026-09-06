import { Module } from '@nestjs/common';

import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';

// Thin module so WorkflowRun can emit journey updates without importing
// the full OutreachCommandModule (avoids a Nest circular dependency).
@Module({
  imports: [WebSocketModule],
  providers: [OutreachCacheRealtimeService],
  exports: [OutreachCacheRealtimeService],
})
export class OutreachCacheRealtimeModule {}
