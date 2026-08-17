import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';

import { type Response } from 'express';

import { AppPath } from 'twenty-shared/types';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { DomainServerConfigService } from 'src/engine/core-modules/domain/domain-server-config/services/domain-server-config.service';
import { HttpExceptionHandlerService } from 'src/engine/core-modules/exception-handler/http-exception-handler.service';

@Catch(AuthException)
export class AuthOAuthExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly domainServerConfigService: DomainServerConfigService,
    private readonly httpExceptionHandlerService: HttpExceptionHandlerService,
  ) {}

  catch(exception: AuthException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case AuthExceptionCode.OAUTH_ACCESS_DENIED:
        response
          .status(403)
          .redirect(this.domainServerConfigService.getBaseUrl().toString());
        break;
      case AuthExceptionCode.INVALID_INPUT:
      case AuthExceptionCode.SIGNUP_DISABLED:
      case AuthExceptionCode.FORBIDDEN_EXCEPTION:
        response.redirect(
          this.domainServerConfigService
            .buildBaseUrl({
              pathname: AppPath.SignInUp,
              searchParams: { errorMessage: exception.message },
            })
            .toString(),
        );
        break;
      default:
        return this.httpExceptionHandlerService.handleError(
          exception,
          response,
          500,
        );
    }
  }
}
