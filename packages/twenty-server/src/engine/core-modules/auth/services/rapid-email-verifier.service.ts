import { Injectable, Logger } from '@nestjs/common';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type RapidEmailVerifierResponse } from 'src/engine/core-modules/auth/services/rapid-email-verifier.types';
import { getSignupEmailRejectionMessage } from 'src/engine/core-modules/auth/services/rapid-email-verifier.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const DEFAULT_RAPID_VERIFIER_BASE_URL = 'https://rapid-email-verifier.fly.dev';
const REQUEST_TIMEOUT_MS = 10_000;
const RESERVED_TEST_EMAIL_DOMAIN_SUFFIXES = ['.test', '.localhost'];

@Injectable()
export class RapidEmailVerifierService {
  private readonly logger = new Logger(RapidEmailVerifierService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private shouldSkipVerification(email: string) {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const domain = email.split('@')[1]?.toLowerCase().trim();

    if (!domain) {
      return false;
    }

    return RESERVED_TEST_EMAIL_DOMAIN_SUFFIXES.some((suffix) =>
      domain.endsWith(suffix),
    );
  }

  async assertEmailAllowedForSignup(email: string): Promise<void> {
    if (this.shouldSkipVerification(email)) {
      return;
    }

    const configuredBaseUrl = this.twentyConfigService.get(
      'RAPID_EMAIL_VERIFIER_BASE_URL',
    );
    const baseUrl = configuredBaseUrl || DEFAULT_RAPID_VERIFIER_BASE_URL;
    const url = `${baseUrl.replace(/\/$/, '')}/api/validate?${new URLSearchParams(
      { email },
    ).toString()}`;

    let data: RapidEmailVerifierResponse;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Rapid Email Verifier returned ${response.status}`);
      }

      data = (await response.json()) as RapidEmailVerifierResponse;
    } catch (error) {
      this.logger.warn('Rapid Email Verifier request failed', error);

      throw new AuthException(
        'We could not verify your email right now. Please try again in a moment.',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const message = getSignupEmailRejectionMessage(data);

    if (message) {
      throw new AuthException(message, AuthExceptionCode.INVALID_INPUT);
    }
  }
};
