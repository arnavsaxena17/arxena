import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { LinkedinUnipileMessagingService } from './services/linkedin-unipile/linkedin-unipile-messaging.service';
import { WhatsappOutboundRateLimiterService } from './services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WhatsappUnipileMessagingService } from './services/whatsapp-unipile/whatsapp-unipile-messaging.service';
import { WorkspaceMemberArxService } from './services/workspace-member-arx.service';
import { WorkspaceMemberUnipileService } from './services/workspace-member-unipile.service';
import { UnipilePoolModule } from './unipile-pool.module';
import { SendEmailFunctionality } from './utils/send-gmail';

// The channel senders: LinkedIn via Unipile, WhatsApp via Unipile, and Gmail.
// They are plain classes that read provider settings in their constructor, so
// they are built once here and injected wherever a message is sent rather than
// `new`-ed per call site. Both arx-chat and engagement import this module, so
// there is one rate limiter and one sender per process.
@Module({
  imports: [
    ConfigModule,
    WorkspaceModificationsModule,
    GraphQLExecutionModule,
    // StaticGraphQLService (injected below) needs JwtWrapperService.
    JwtModule,
    RedisClientModule,
    UnipilePoolModule,
  ],
  providers: [
    RedisService,
    WhatsappOutboundRateLimiterService,
    {
      provide: LinkedinUnipileMessagingService,
      useFactory: (
        workspaceQueryService: WorkspaceQueryService,
        staticGraphQLService: StaticGraphQLService,
        workspaceMemberUnipileService: WorkspaceMemberUnipileService,
      ) =>
        new LinkedinUnipileMessagingService(
          workspaceQueryService,
          staticGraphQLService,
          undefined,
          undefined,
          workspaceMemberUnipileService,
        ),
      inject: [
        WorkspaceQueryService,
        StaticGraphQLService,
        WorkspaceMemberUnipileService,
      ],
    },
    {
      provide: WhatsappUnipileMessagingService,
      useFactory: (
        workspaceQueryService: WorkspaceQueryService,
        staticGraphQLService: StaticGraphQLService,
        workspaceMemberUnipileService: WorkspaceMemberUnipileService,
        whatsappOutboundRateLimiter: WhatsappOutboundRateLimiterService,
      ) =>
        new WhatsappUnipileMessagingService(
          workspaceQueryService,
          staticGraphQLService,
          workspaceMemberUnipileService,
          whatsappOutboundRateLimiter,
        ),
      inject: [
        WorkspaceQueryService,
        StaticGraphQLService,
        WorkspaceMemberUnipileService,
        WhatsappOutboundRateLimiterService,
      ],
    },
    {
      provide: WorkspaceMemberArxService,
      useFactory: (staticGraphQLService: StaticGraphQLService) =>
        new WorkspaceMemberArxService(staticGraphQLService),
      inject: [StaticGraphQLService],
    },
    {
      provide: SendEmailFunctionality,
      useValue: new SendEmailFunctionality(),
    },
  ],
  exports: [
    WhatsappOutboundRateLimiterService,
    LinkedinUnipileMessagingService,
    WhatsappUnipileMessagingService,
    WorkspaceMemberArxService,
    SendEmailFunctionality,
  ],
})
export class MessagingModule {}
