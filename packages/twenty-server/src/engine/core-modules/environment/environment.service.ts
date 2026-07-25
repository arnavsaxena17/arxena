import { Injectable } from '@nestjs/common';

import { type ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

// Compatibility shim for Arxena modules ported from `workflows`.
// Keys are registered as ConfigVariables; prefer TwentyConfigService for new code.
@Injectable()
export class EnvironmentService {
  constructor(
    private readonly environmentConfigDriver: EnvironmentConfigDriver,
  ) {}

  get<T extends keyof ConfigVariables>(key: T): ConfigVariables[T] {
    return this.environmentConfigDriver.get(key);
  }
}
