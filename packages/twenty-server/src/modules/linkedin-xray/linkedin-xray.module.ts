import { Module } from '@nestjs/common';

import { LinkedinXrayController } from 'src/modules/linkedin-xray/linkedin-xray.controller';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';

@Module({
  controllers: [LinkedinXrayController],
  providers: [LinkedinXrayService],
  exports: [LinkedinXrayService],
})
export class LinkedinXrayModule {}
