import { Injectable } from '@nestjs/common';

import { authenticator } from 'otplib';
import { TwoFactorAuthenticationStrategy } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { QueryFailedError } from 'typeorm';

import { POSTGRESQL_ERROR_CODES } from 'src/engine/api/graphql/workspace-query-runner/constants/postgres-error-codes.constants';
import { type QueryFailedErrorWithCode } from 'src/engine/api/graphql/workspace-query-runner/utils/workspace-query-runner-graphql-api-exception-handler.util';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { TwoFactorAuthenticationMethodEntity } from 'src/engine/core-modules/two-factor-authentication/entities/two-factor-authentication-method.entity';
import { TOTP_DEFAULT_CONFIGURATION } from 'src/engine/core-modules/two-factor-authentication/strategies/otp/totp/constants/totp.strategy.constants';
import { TotpStrategy } from 'src/engine/core-modules/two-factor-authentication/strategies/otp/totp/totp.strategy';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

import {
  TwoFactorAuthenticationException,
  TwoFactorAuthenticationExceptionCode,
} from './two-factor-authentication.exception';
import { twoFactorAuthenticationMethodsValidator } from './two-factor-authentication.validation';

import { OTPStatus } from './strategies/otp/otp.constants';

const PENDING_METHOD_REUSE_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
// oxlint-disable-next-line twenty/inject-workspace-repository
export class TwoFactorAuthenticationService {
  constructor(
    @InjectWorkspaceScopedRepository(TwoFactorAuthenticationMethodEntity)
    private readonly twoFactorAuthenticationMethodRepository: WorkspaceScopedRepository<TwoFactorAuthenticationMethodEntity>,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  private async decryptStoredSecret({
    storedSecret,
    workspaceId,
  }: {
    storedSecret: EncryptedString;
    workspaceId: string;
  }): Promise<PlaintextString> {
    return this.secretEncryptionService.decryptVersionedOrThrow(storedSecret, {
      workspaceId,
    });
  }

  /**
   * Validates two-factor authentication requirements for a workspace.
   *
   * @throws {AuthException} with TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED if 2FA is set up and needs verification
   * @throws {AuthException} with TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED if 2FA is enforced but not set up
   * @param targetWorkspace - The workspace to check 2FA requirements for
   * @param userTwoFactorAuthenticationMethods - Optional array of user's 2FA methods
   */
  async validateTwoFactorAuthenticationRequirement(
    targetWorkspace: WorkspaceEntity,
    userTwoFactorAuthenticationMethods?: TwoFactorAuthenticationMethodEntity[],
  ) {
    if (
      twoFactorAuthenticationMethodsValidator.areDefined(
        userTwoFactorAuthenticationMethods,
      ) &&
      twoFactorAuthenticationMethodsValidator.areVerified(
        userTwoFactorAuthenticationMethods,
      )
    ) {
      throw new AuthException(
        'Two factor authentication verification required',
        AuthExceptionCode.TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED,
      );
    } else if (targetWorkspace?.isTwoFactorAuthenticationEnforced) {
      throw new AuthException(
        'Two factor authentication setup required',
        AuthExceptionCode.TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED,
      );
    }
  }

  async initiateStrategyConfiguration(
    userId: string,
    userEmail: string,
    workspaceId: string,
    workspaceDisplayName?: string,
  ) {
    const userWorkspace =
      await this.userWorkspaceService.getUserWorkspaceForUserOrThrow({
        userId,
        workspaceId,
      });

    const existing2FAMethod = await this.findTotpMethod({
      workspaceId,
      userWorkspaceId: userWorkspace.id,
    });

    if (
      existing2FAMethod &&
      existing2FAMethod.status !== OTPStatus.PENDING
    ) {
      throw new TwoFactorAuthenticationException(
        'A two factor authentication method has already been set. Please delete it and try again.',
        TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED,
      );
    }

    if (this.canReusePendingMethod(existing2FAMethod)) {
      return this.buildOtpAuthUri({
        userEmail,
        workspaceDisplayName,
        storedSecret: existing2FAMethod.secret,
        workspaceId,
      });
    }

    const issuer = this.buildIssuer(workspaceDisplayName);
    const { uri, context } = new TotpStrategy(
      TOTP_DEFAULT_CONFIGURATION,
    ).initiate(userEmail, issuer);

    const encryptedSecret = this.secretEncryptionService.encryptVersioned(
      context.secret,
      { workspaceId },
    );

    try {
      await this.twoFactorAuthenticationMethodRepository.save(workspaceId, {
        id: existing2FAMethod?.id,
        userWorkspace: userWorkspace,
        secret: encryptedSecret,
        status: context.status,
        strategy: TwoFactorAuthenticationStrategy.TOTP,
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const concurrentMethod = await this.findTotpMethod({
        workspaceId,
        userWorkspaceId: userWorkspace.id,
      });

      if (!isDefined(concurrentMethod)) {
        throw error;
      }

      if (concurrentMethod.status !== OTPStatus.PENDING) {
        throw new TwoFactorAuthenticationException(
          'A two factor authentication method has already been set. Please delete it and try again.',
          TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED,
        );
      }

      return this.buildOtpAuthUri({
        userEmail,
        workspaceDisplayName,
        storedSecret: concurrentMethod.secret,
        workspaceId,
      });
    }

    return uri;
  }

  private async findTotpMethod({
    workspaceId,
    userWorkspaceId,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
  }) {
    return this.twoFactorAuthenticationMethodRepository.findOne(workspaceId, {
      where: {
        userWorkspaceId,
        strategy: TwoFactorAuthenticationStrategy.TOTP,
      },
    });
  }

  private canReusePendingMethod(
    method: TwoFactorAuthenticationMethodEntity | null,
  ): method is TwoFactorAuthenticationMethodEntity {
    return (
      isDefined(method) &&
      method.status === OTPStatus.PENDING &&
      isDefined(method.createdAt) &&
      Date.now() - method.createdAt.getTime() < PENDING_METHOD_REUSE_WINDOW_MS
    );
  }

  private buildIssuer(workspaceDisplayName?: string) {
    return `Arxena${workspaceDisplayName ? ` - ${workspaceDisplayName}` : ''}`;
  }

  private async buildOtpAuthUri({
    userEmail,
    workspaceDisplayName,
    storedSecret,
    workspaceId,
  }: {
    userEmail: string;
    workspaceDisplayName?: string;
    storedSecret: EncryptedString;
    workspaceId: string;
  }) {
    const existingSecret = await this.decryptStoredSecret({
      storedSecret,
      workspaceId,
    });

    return authenticator.keyuri(
      userEmail,
      this.buildIssuer(workspaceDisplayName),
      existingSecret,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const queryFailedError = error as QueryFailedErrorWithCode;
    const driverError = error.driverError as { code?: string } | undefined;

    return (
      queryFailedError.code === POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION ||
      driverError?.code === POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION
    );
  }

  async validateStrategy(
    userId: UserEntity['id'],
    token: string,
    workspaceId: WorkspaceEntity['id'],
    twoFactorAuthenticationStrategy: TwoFactorAuthenticationStrategy,
  ) {
    const userTwoFactorAuthenticationMethod =
      await this.twoFactorAuthenticationMethodRepository.findOne(workspaceId, {
        where: {
          strategy: twoFactorAuthenticationStrategy,
          userWorkspace: {
            userId,
            workspaceId,
          },
        },
      });

    if (!isDefined(userTwoFactorAuthenticationMethod)) {
      throw new TwoFactorAuthenticationException(
        'Two Factor Authentication Method not found.',
        TwoFactorAuthenticationExceptionCode.INVALID_CONFIGURATION,
      );
    }

    if (!isDefined(userTwoFactorAuthenticationMethod.secret)) {
      throw new TwoFactorAuthenticationException(
        'Malformed Two Factor Authentication Method object',
        TwoFactorAuthenticationExceptionCode.MALFORMED_DATABASE_OBJECT,
      );
    }

    const originalSecret = await this.decryptStoredSecret({
      storedSecret: userTwoFactorAuthenticationMethod.secret,
      workspaceId,
    });

    const otpContext = {
      status: userTwoFactorAuthenticationMethod.status,
      secret: originalSecret,
    };

    const validationResult = new TotpStrategy(
      TOTP_DEFAULT_CONFIGURATION,
    ).validate(token, otpContext);

    if (!validationResult.isValid) {
      throw new TwoFactorAuthenticationException(
        'Invalid OTP',
        TwoFactorAuthenticationExceptionCode.INVALID_OTP,
      );
    }

    await this.twoFactorAuthenticationMethodRepository.save(workspaceId, {
      ...userTwoFactorAuthenticationMethod,
      status: OTPStatus.VERIFIED,
    });
  }

  async verifyTwoFactorAuthenticationMethodForAuthenticatedUser(
    userId: UserEntity['id'],
    token: string,
    workspaceId: WorkspaceEntity['id'],
  ) {
    await this.validateStrategy(
      userId,
      token,
      workspaceId,
      TwoFactorAuthenticationStrategy.TOTP,
    );

    return { success: true };
  }
}
