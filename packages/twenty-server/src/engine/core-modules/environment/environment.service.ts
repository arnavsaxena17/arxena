import { Injectable } from '@nestjs/common';

import { type ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

/**
 * Compatibility shim for Arxena modules ported from `workflows`.
 * Prefer registered ConfigVariables; otherwise fall back to process.env.
 */
@Injectable()
export class EnvironmentService {
  constructor(
    private readonly environmentConfigDriver: EnvironmentConfigDriver,
  ) {}

  get<T = unknown>(key: string): T {
    try {
      return this.environmentConfigDriver.get(
        key as keyof ConfigVariables,
      ) as unknown as T;
    } catch {
      return (process.env[key] ?? undefined) as T;
    }
  }
}
