import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

// import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { TokenService } from 'src/engine/core-modules/auth/token/services/token.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
  GoogleAPIScopeConfig,
  GoogleAPIsStrategy,
} from 'src/engine/core-modules/auth/strategies/google-apis.auth.strategy';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
// import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';

@Injectable()
export class GoogleAPIsProviderEnabledGuard implements CanActivate {
  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly tokenService: TokenService,
    @InjectRepository(FeatureFlagEntity, 'core')
    private readonly featureFlagRepository: Repository<FeatureFlagEntity>,
  ) {}

  async canActivate(): Promise<boolean> {
    console.log("GoogleAPIsProviderEnabledGuard.canActivate()");
    if (
      !this.environmentService.get('MESSAGING_PROVIDER_GMAIL_ENABLED') &&
      !this.environmentService.get('CALENDAR_PROVIDER_GOOGLE_ENABLED')
    ) {
      throw new NotFoundException('Google apis auth is not enabled');
    }

    const scopeConfig: GoogleAPIScopeConfig = {
      isCalendarEnabled: !!this.environmentService.get(
        'MESSAGING_PROVIDER_GMAIL_ENABLED',
      ),
    };

    new GoogleAPIsStrategy(this.environmentService, scopeConfig);

    return true;
  }
}
