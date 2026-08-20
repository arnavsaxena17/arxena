import { Global, Module } from '@nestjs/common';

import { UnipileV2Client } from './unipile-v2.client';

@Global()
@Module({
  providers: [UnipileV2Client],
  exports: [UnipileV2Client],
})
export class UnipileClientModule {}
