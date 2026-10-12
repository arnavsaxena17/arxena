import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FileModule } from 'src/engine/core-modules/file/file.module';
import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import { OutreachListStoreService } from 'src/engine/core-modules/outreach-list/services/outreach-list-store.service';

@Module({
  imports: [ApplicationModule, FileModule],
  providers: [OutreachListStoreService, OutreachListService],
  exports: [OutreachListService],
})
export class OutreachListModule {}
