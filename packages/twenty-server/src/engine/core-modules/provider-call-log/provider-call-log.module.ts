import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProviderCallTraceCommand } from 'src/engine/core-modules/provider-call-log/commands/provider-call-trace.command';
import { ProviderCallEntity } from 'src/engine/core-modules/provider-call-log/provider-call.entity';
import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';

// Global so the provider query cache and every source service can record
// without each module importing this one
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProviderCallEntity])],
  providers: [ProviderCallLogService, ProviderCallTraceCommand],
  exports: [ProviderCallLogService],
})
export class ProviderCallLogModule {}
