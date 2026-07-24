import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import {
  ConfigVariables,
  validate,
} from 'src/engine/core-modules/twenty-config/config-variables';
import { CONFIG_VARIABLES_INSTANCE_TOKEN } from 'src/engine/core-modules/twenty-config/constants/config-variables-instance-tokens.constants';
import { EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
  ],
  providers: [
    EnvironmentConfigDriver,
    EnvironmentService,
    {
      provide: CONFIG_VARIABLES_INSTANCE_TOKEN,
      useValue: new ConfigVariables(),
    },
  ],
  exports: [EnvironmentConfigDriver, EnvironmentService],
})
export class EnvironmentModule {}
