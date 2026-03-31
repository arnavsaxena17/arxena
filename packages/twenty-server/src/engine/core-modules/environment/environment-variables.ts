import { LogLevel, Logger } from '@nestjs/common';

import { plainToClass } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  ValidateIf,
  validateSync,
} from 'class-validator';

import { EmailDriver } from 'src/engine/core-modules/email/interfaces/email.interface';
import { AwsRegion } from 'src/engine/core-modules/environment/interfaces/aws-region.interface';
import { NodeEnvironment } from 'src/engine/core-modules/environment/interfaces/node-environment.interface';
import { SupportDriver } from 'src/engine/core-modules/environment/interfaces/support.interface';
import { LLMChatModelDriver } from 'src/engine/core-modules/llm-chat-model/interfaces/llm-chat-model.interface';
import { LLMTracingDriver } from 'src/engine/core-modules/llm-tracing/interfaces/llm-tracing.interface';

import { CaptchaDriverType } from 'src/engine/core-modules/captcha/interfaces';
import { CastToBoolean } from 'src/engine/core-modules/environment/decorators/cast-to-boolean.decorator';
import { CastToLogLevelArray } from 'src/engine/core-modules/environment/decorators/cast-to-log-level-array.decorator';
import { CastToPositiveNumber } from 'src/engine/core-modules/environment/decorators/cast-to-positive-number.decorator';
import { EnvironmentVariablesMetadata } from 'src/engine/core-modules/environment/decorators/environment-variables-metadata.decorator';
import { IsAWSRegion } from 'src/engine/core-modules/environment/decorators/is-aws-region.decorator';
import { IsDuration } from 'src/engine/core-modules/environment/decorators/is-duration.decorator';
import { IsStrictlyLowerThan } from 'src/engine/core-modules/environment/decorators/is-strictly-lower-than.decorator';
import { EnvironmentVariablesGroup } from 'src/engine/core-modules/environment/enums/environment-variables-group.enum';
import { ExceptionHandlerDriver } from 'src/engine/core-modules/exception-handler/interfaces';
import { StorageDriverType } from 'src/engine/core-modules/file-storage/interfaces';
import { LoggerDriverType } from 'src/engine/core-modules/logger/interfaces';
import { ServerlessDriverType } from 'src/engine/core-modules/serverless/serverless.interface';
import { assert } from 'src/utils/assert';

export class EnvironmentVariables {
  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Enable or disable password authentication for users',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  AUTH_PASSWORD_ENABLED = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Prefills tim@apple.dev in the login form, used in local development for quicker sign-in',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  @ValidateIf((env) => env.AUTH_PASSWORD_ENABLED)
  SIGN_IN_PREFILLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'When true, sign-in background uses the org chart mock and hides the fake navigation drawer',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  SIGN_IN_BACKGROUND_USE_ORG_CHART_MOCK = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Require email verification for user accounts',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  IS_EMAIL_VERIFICATION_REQUIRED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'When true, the post-setup email ("Your Arxena Workspace is Ready") is not sent after metadata structure creation.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  SKIP_WORKSPACE_SETUP_COMPLETE_EMAIL = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Include Connect LinkedIn step in onboarding. When false, step is skipped.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  USE_CONNECT_LINKEDIN_ONBOARDING = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'When true, the Chrome extension may auto-sync LinkedIn cookies to the workspace member profile and connect/reconnect LinkedIn via Unipile when the user opens the extension with a LinkedIn tab available.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  CONNECT_LINKEDIN_TO_UNIPILE_AUTOMATICALLY = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Skip optional onboarding steps (Sync Emails, Invite Team). When true, users go directly from Create Profile to the jobs page.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  SKIP_OPTIONAL_ONBOARDING_STEPS = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'When true, after phone collection users see intent choice and a path-specific step before the jobs page.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  USE_INTENT_CHOICE_ONBOARDING = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Base URL for Rapid Email Verifier (MX, disposable, role, typo, alias checks on signup).',
  })
  @IsOptional()
  @IsUrl({ require_tld: true })
  @IsString()
  RAPID_EMAIL_VERIFIER_BASE_URL = 'https://rapid-email-verifier.fly.dev';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Calendly embed URL for the Deal diligence onboarding path (iframe src).',
  })
  @IsOptional()
  @IsString()
  DEAL_DILIGENCE_CALENDLY_EMBED_URL?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the email verification token is valid',
  })
  @IsDuration()
  @IsOptional()
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN = '1h';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the password reset token is valid',
  })
  @IsDuration()
  @IsOptional()
  PASSWORD_RESET_TOKEN_EXPIRES_IN = '5m';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    description: 'Enable or disable the Google Calendar integration',
  })
  @CastToBoolean()
  CALENDAR_PROVIDER_GOOGLE_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    description: 'Callback URL for Google Auth APIs',
  })
  AUTH_GOOGLE_APIS_CALLBACK_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    description: 'Enable or disable Google Single Sign-On (SSO)',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  AUTH_GOOGLE_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    sensitive: true,
    description: 'Client ID for Google authentication',
  })
  @IsString()
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CLIENT_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    sensitive: true,
    description: 'Client secret for Google authentication',
  })
  @IsString()
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CLIENT_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    sensitive: true,
    description: 'Callback URL for Google authentication',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CALLBACK_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.GoogleAuth,
    description: 'Enable or disable the Gmail messaging integration',
  })
  @CastToBoolean()
  MESSAGING_PROVIDER_GMAIL_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    description: 'Enable or disable Microsoft authentication',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  AUTH_MICROSOFT_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    sensitive: true,
    description: 'Client ID for Microsoft authentication',
  })
  @IsString()
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CLIENT_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    sensitive: true,
    description: 'Client secret for Microsoft authentication',
  })
  @IsString()
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CLIENT_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    sensitive: true,
    description: 'Callback URL for Microsoft authentication',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CALLBACK_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    sensitive: true,
    description: 'Callback URL for Microsoft APIs',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_APIS_CALLBACK_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    description: 'Enable or disable the Microsoft messaging integration',
  })
  @CastToBoolean()
  MESSAGING_PROVIDER_MICROSOFT_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.MicrosoftAuth,
    description: 'Enable or disable the Microsoft Calendar integration',
  })
  @CastToBoolean()
  CALENDAR_PROVIDER_MICROSOFT_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'Legacy variable to be deprecated when all API Keys expire. Replaced by APP_KEY',
  })
  @IsOptional()
  @IsString()
  ACCESS_TOKEN_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the access token is valid',
  })
  @IsDuration()
  @IsOptional()
  ACCESS_TOKEN_EXPIRES_IN = '60d';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the refresh token is valid',
  })
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN = '60d';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Cooldown period for refreshing tokens',
  })
  @IsDuration()
  @IsOptional()
  REFRESH_TOKEN_COOL_DOWN = '1m';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the login token is valid',
  })
  @IsDuration()
  @IsOptional()
  LOGIN_TOKEN_EXPIRES_IN = '15m';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the file token is valid',
  })
  @IsDuration()
  @IsOptional()
  FILE_TOKEN_EXPIRES_IN = '1d';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the invitation token is valid',
  })
  @IsDuration()
  @IsOptional()
  INVITATION_TOKEN_EXPIRES_IN = '30d';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Duration for which the short-term token is valid',
  })
  SHORT_TERM_TOKEN_EXPIRES_IN = '5m';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'Email address used as the sender for outgoing emails',
  })
  EMAIL_FROM_ADDRESS = 'info@arxena.com';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'Email address used for system notifications',
  })
  EMAIL_SYSTEM_ADDRESS = 'info@arxena.com';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'Name used in the From header for outgoing emails',
  })
  EMAIL_FROM_NAME = 'Arnav from Arxena';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'Email driver to use for sending emails',
  })
  EMAIL_DRIVER: EmailDriver = EmailDriver.Logger;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'SMTP host for sending emails',
  })
  EMAIL_SMTP_HOST: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'SMTP port for sending emails',
  })
  @CastToPositiveNumber()
  EMAIL_SMTP_PORT = 587;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    description: 'SMTP user for authentication',
  })
  EMAIL_SMTP_USER: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.EmailSettings,
    sensitive: true,
    description: 'SMTP password for authentication',
  })
  EMAIL_SMTP_PASSWORD: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    description: 'Type of storage to use (local or S3)',
  })
  @IsEnum(StorageDriverType)
  @IsOptional()
  STORAGE_TYPE: StorageDriverType = StorageDriverType.Local;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    description: 'Local path for storage when using local storage type',
  })
  @IsString()
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.Local)
  STORAGE_LOCAL_PATH = '.local-storage';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    description: 'S3 region for storage when using S3 storage type',
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S3)
  @IsAWSRegion()
  STORAGE_S3_REGION: AwsRegion;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    description: 'S3 bucket name for storage when using S3 storage type',
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S3)
  @IsString()
  STORAGE_S3_NAME: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    description: 'S3 endpoint for storage when using S3 storage type',
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S3)
  @IsString()
  @IsOptional()
  STORAGE_S3_ENDPOINT: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    sensitive: true,
    description:
      'S3 access key ID for authentication when using S3 storage type',
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S3)
  @IsString()
  @IsOptional()
  STORAGE_S3_ACCESS_KEY_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.StorageConfig,
    sensitive: true,
    description:
      'S3 secret access key for authentication when using S3 storage type',
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S3)
  @IsString()
  @IsOptional()
  STORAGE_S3_SECRET_ACCESS_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'Type of serverless execution (local or Lambda)',
  })
  @IsEnum(ServerlessDriverType)
  @IsOptional()
  SERVERLESS_TYPE: ServerlessDriverType = ServerlessDriverType.Local;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'Throttle limit for serverless function execution',
  })
  @CastToPositiveNumber()
  SERVERLESS_FUNCTION_EXEC_THROTTLE_LIMIT = 10;

  // milliseconds
  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'Time-to-live for serverless function execution throttle',
  })
  @CastToPositiveNumber()
  SERVERLESS_FUNCTION_EXEC_THROTTLE_TTL = 1000;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'Region for AWS Lambda functions',
  })
  @ValidateIf((env) => env.SERVERLESS_TYPE === ServerlessDriverType.Lambda)
  @IsAWSRegion()
  SERVERLESS_LAMBDA_REGION: AwsRegion;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'IAM role for AWS Lambda functions',
  })
  @ValidateIf((env) => env.SERVERLESS_TYPE === ServerlessDriverType.Lambda)
  @IsString()
  SERVERLESS_LAMBDA_ROLE: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    description: 'Role to assume when hosting lambdas in dedicated AWS account',
  })
  @ValidateIf((env) => env.SERVERLESS_TYPE === ServerlessDriverType.Lambda)
  @IsString()
  @IsOptional()
  SERVERLESS_LAMBDA_SUBHOSTING_ROLE?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    sensitive: true,
    description: 'Access key ID for AWS Lambda functions',
  })
  @ValidateIf((env) => env.SERVERLESS_TYPE === ServerlessDriverType.Lambda)
  @IsString()
  @IsOptional()
  SERVERLESS_LAMBDA_ACCESS_KEY_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerlessConfig,
    sensitive: true,
    description: 'Secret access key for AWS Lambda functions',
  })
  @ValidateIf((env) => env.SERVERLESS_TYPE === ServerlessDriverType.Lambda)
  @IsString()
  @IsOptional()
  SERVERLESS_LAMBDA_SECRET_ACCESS_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TinybirdConfig,
    description: 'Enable or disable analytics for telemetry',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  ANALYTICS_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Logging,
    description: 'Enable or disable telemetry logging',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  TELEMETRY_ENABLED = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TinybirdConfig,
    sensitive: true,
    description: 'Ingest token for Tinybird analytics',
  })
  @IsString()
  @ValidateIf((env) => env.ANALYTICS_ENABLED)
  TINYBIRD_INGEST_TOKEN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TinybirdConfig,
    sensitive: true,
    description: 'Workspace UUID for Tinybird analytics',
  })
  @IsString()
  @ValidateIf((env) => env.ANALYTICS_ENABLED)
  TINYBIRD_WORKSPACE_UUID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TinybirdConfig,
    sensitive: true,
    description: 'JWT token for Tinybird analytics',
  })
  @IsString()
  @ValidateIf((env) => env.ANALYTICS_ENABLED)
  TINYBIRD_GENERATE_JWT_TOKEN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Enable or disable billing features',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  IS_BILLING_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description:
      'Skip the Choose Your Plan step for new signups; user goes directly to Create Workspace while Stripe subscription is created in background',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  SKIP_PLAN_REQUIRED_FOR_ONBOARDING = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Link required for billing plan',
  })
  @IsString()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_PLAN_REQUIRED_LINK: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Duration of free trial with credit card in days',
  })
  @IsNumber()
  @CastToPositiveNumber()
  @IsOptional()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_TRIAL_WITH_CREDIT_CARD_DURATION_IN_DAYS = 30;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Duration of free trial without credit card in days',
  })
  @IsNumber()
  @CastToPositiveNumber()
  @IsOptional()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS = 7;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Billing provider: razorpay (default) or stripe. Controls which payment UI is shown on Settings Billing.',
  })
  @IsString()
  @IsIn(['razorpay', 'stripe'])
  @IsOptional()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_PROVIDER: 'razorpay' | 'stripe' = 'razorpay';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Stripe API key for billing',
  })
  @IsString()
  @ValidateIf(
    (env) => env.IS_BILLING_ENABLED === true && env.BILLING_PROVIDER === 'stripe',
  )
  BILLING_STRIPE_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Stripe webhook secret for billing',
  })
  @IsString()
  @ValidateIf(
    (env) => env.IS_BILLING_ENABLED === true && env.BILLING_PROVIDER === 'stripe',
  )
  BILLING_STRIPE_WEBHOOK_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Base plan product ID for Stripe billing',
  })
  @IsString()
  @ValidateIf(
    (env) => env.IS_BILLING_ENABLED === true && env.BILLING_PROVIDER === 'stripe',
  )
  BILLING_STRIPE_BASE_PLAN_PRODUCT_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Razorpay key ID for billing',
  })
  @IsString()
  @IsOptional()
  BILLING_RAZORPAY_KEY_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Razorpay key secret for billing',
  })
  @IsString()
  @IsOptional()
  BILLING_RAZORPAY_KEY_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    sensitive: true,
    description: 'Razorpay webhook secret for billing',
  })
  @IsString()
  @IsOptional()
  BILLING_RAZORPAY_WEBHOOK_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.BillingConfig,
    description: 'Razorpay base plan ID (optional)',
  })
  @IsString()
  @IsOptional()
  BILLING_RAZORPAY_BASE_PLAN_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'Url for the frontend application',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  FRONTEND_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'Default subdomain for the frontend when multi-workspace is enabled',
  })
  @IsString()
  @ValidateIf((env) => env.IS_MULTIWORKSPACE_ENABLED)
  DEFAULT_SUBDOMAIN = 'app';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'ID for the Chrome extension',
  })
  @IsString()
  @IsOptional()
  CHROME_EXTENSION_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Logging,
    description: 'Enable or disable buffering for logs before sending',
  })
  @CastToBoolean()
  @IsBoolean()
  @IsOptional()
  LOGGER_IS_BUFFER_ENABLED = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Logging,
    description: 'Driver used for handling exceptions (Console or Sentry)',
  })
  @IsEnum(ExceptionHandlerDriver)
  @IsOptional()
  EXCEPTION_HANDLER_DRIVER: ExceptionHandlerDriver =
    ExceptionHandlerDriver.Console;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Logging,
    description: 'Levels of logging to be captured',
  })
  @CastToLogLevelArray()
  @IsOptional()
  LOG_LEVELS: LogLevel[] = ['log', 'error', 'warn'];

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ExceptionHandler,
    description: 'Driver used for logging (only console for now)',
  })
  @IsEnum(LoggerDriverType)
  @IsOptional()
  LOGGER_DRIVER: LoggerDriverType = LoggerDriverType.Console;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ExceptionHandler,
    description: 'Data Source Name (DSN) for Sentry logging',
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.Sentry,
  )
  @IsString()
  SENTRY_DSN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ExceptionHandler,
    description: 'Front-end DSN for Sentry logging',
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.Sentry,
  )
  @IsString()
  SENTRY_FRONT_DSN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ExceptionHandler,
    description: 'Release version for Sentry logging',
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.Sentry,
  )
  @IsString()
  @IsOptional()
  SENTRY_RELEASE: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ExceptionHandler,
    description: 'Environment name for Sentry logging',
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.Sentry,
  )
  @IsString()
  @IsOptional()
  SENTRY_ENVIRONMENT: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description: 'Driver used for support chat integration',
  })
  @IsEnum(SupportDriver)
  @IsOptional()
  SUPPORT_DRIVER: SupportDriver = SupportDriver.None;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    sensitive: true,
    description: 'Chat ID for the support front integration',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Front)
  @IsString()
  SUPPORT_FRONT_CHAT_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    sensitive: true,
    description: 'HMAC key for the support front integration',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Front)
  @IsString()
  SUPPORT_FRONT_HMAC_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description: 'Base URL of the Chatwoot instance used for support chat',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  SUPPORT_CHATWOOT_BASE_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    sensitive: true,
    description: 'Website token used to initialize the Chatwoot widget',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  SUPPORT_CHATWOOT_WEBSITE_TOKEN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description:
      'Numeric Chatwoot account identifier used for server-side conversation APIs',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  SUPPORT_CHATWOOT_ACCOUNT_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    sensitive: true,
    description:
      'API access token used by twenty-server to send messages into Chatwoot',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  SUPPORT_CHATWOOT_API_ACCESS_TOKEN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    sensitive: true,
    description:
      'Webhook signing secret configured on the Chatwoot webhook pointing to twenty-server',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  SUPPORT_CHATWOOT_WEBHOOK_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description:
      'Workspace ID in Twenty where support contacts and activities should be synced',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsUUID()
  SUPPORT_CHAT_WORKSPACE_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description:
      'Optional inbox identifier exposed to clients for public API flows or routing metadata',
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsString()
  @IsOptional()
  SUPPORT_CHATWOOT_INBOX_IDENTIFIER: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SupportChatConfig,
    description:
      'Enable AI auto-replies for support conversations handled through Chatwoot',
  })
  @CastToBoolean()
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.Chatwoot)
  @IsBoolean()
  @IsOptional()
  SUPPORT_AI_ENABLED: boolean = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    sensitive: true,
    description: 'Database connection URL',
  })
  @IsDefined()
  @IsUrl({
    protocols: ['postgres'],
    require_tld: false,
    allow_underscores: true,
    require_host: false,
  })
  PG_DATABASE_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'Allow connections to a database with self-signed certificates',
  })
  @CastToBoolean()
  @IsBoolean()
  @IsOptional()
  PG_SSL_ALLOW_SELF_SIGNED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool max size for metadata schema. Keep sum of all PG_POOL_*_MAX below PostgreSQL max_connections.',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_METADATA_MAX = 25;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'PostgreSQL connection pool min size for metadata schema',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_METADATA_MIN = 2;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool max size for core schema. Keep sum of all PG_POOL_*_MAX below PostgreSQL max_connections.',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_CORE_MAX = 25;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'PostgreSQL connection pool min size for core schema',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_CORE_MIN = 2;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool max size for TypeORMService main (core) datasource',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_MAIN_MAX = 10;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool min size for TypeORMService main datasource',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_MAIN_MIN = 1;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool max size per workspace (WorkspaceDataSourceFactory). Keep sum of all pools below PostgreSQL max_connections.',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_WORKSPACE_MAX = 10;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description:
      'PostgreSQL connection pool min size per workspace (WorkspaceDataSourceFactory)',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  PG_POOL_WORKSPACE_MIN = 0;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.TokensDuration,
    description: 'Time-to-live for cache storage in seconds',
  })
  @CastToPositiveNumber()
  CACHE_STORAGE_TTL: number = 3600 * 24 * 7;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    sensitive: true,
    description: 'URL for cache storage (e.g., Redis connection URL)',
  })
  @IsOptional()
  @IsUrl({
    protocols: ['redis'],
    require_tld: false,
    allow_underscores: true,
  })
  REDIS_URL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'Node environment (development, production, etc.)',
  })
  @IsEnum(NodeEnvironment)
  @IsString()
  NODE_ENV: NodeEnvironment = NodeEnvironment.production;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'Port for the node server',
  })
  @CastToPositiveNumber()
  @IsNumber()
  @IsOptional()
  NODE_PORT = 3000;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'Base URL for the server',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  SERVER_URL = 'http://localhost:3000';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    sensitive: true,
    description: 'Secret key for the application',
  })
  @IsString()
  APP_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description: 'Maximum number of records affected by mutations',
  })
  @CastToPositiveNumber()
  @IsOptional()
  @IsNumber()
  MUTATION_MAXIMUM_AFFECTED_RECORDS = 100;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description: 'Time-to-live for API rate limiting in milliseconds',
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_TTL = 100;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description:
      'Maximum number of requests allowed in the rate limiting window',
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_LIMIT = 1500;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SSL,
    description: 'Path to the SSL key for enabling HTTPS in local development',
  })
  @IsString()
  @IsOptional()
  SSL_KEY_PATH: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.SSL,
    description:
      'Path to the SSL certificate for enabling HTTPS in local development',
  })
  @IsString()
  @IsOptional()
  SSL_CERT_PATH: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.CloudflareConfig,
    sensitive: true,
    description: 'API key for Cloudflare integration',
  })
  @IsString()
  @ValidateIf((env) => env.CLOUDFLARE_ZONE_ID)
  CLOUDFLARE_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.CloudflareConfig,
    description: 'Zone ID for Cloudflare integration',
  })
  @IsString()
  @ValidateIf((env) => env.CLOUDFLARE_API_KEY)
  CLOUDFLARE_ZONE_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Random string to validate queries from Cloudflare',
  })
  @IsString()
  @IsOptional()
  CLOUDFLARE_WEBHOOK_SECRET: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    description: 'Driver for the LLM chat model',
  })
  LLM_CHAT_MODEL_DRIVER: LLMChatModelDriver;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    sensitive: true,
    description: 'API key for OpenAI integration',
  })
  OPENAI_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    description:
      'Model provider for MCP assistant: "anthropic" (default) or "openai". When "openai", set OPENAI_API_KEY.',
  })
  @IsOptional()
  @IsString()
  MCP_MODEL_PROVIDER: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    description: 'OpenAI model for MCP assistant when MCP_MODEL_PROVIDER=openai (e.g. gpt-4o).',
  })
  @IsOptional()
  @IsString()
  MCP_OPENAI_MODEL: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    sensitive: true,
    description: 'Secret key for Langfuse integration',
  })
  LANGFUSE_SECRET_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    description: 'Public key for Langfuse integration',
  })
  LANGFUSE_PUBLIC_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.LLM,
    description: 'Driver for LLM tracing',
  })
  LLM_TRACING_DRIVER: LLMTracingDriver = LLMTracingDriver.Console;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    description: 'Enable or disable multi-workspace support',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  IS_MULTIWORKSPACE_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Use as a feature flag for the new permission feature we are working on.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  PERMISSIONS_ENABLED = false;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Number of inactive days before sending a deletion warning for workspaces. Used in the workspace deletion cron job to determine when to send warning emails.',
  })
  @CastToPositiveNumber()
  @IsNumber()
  @IsStrictlyLowerThan('WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION', {
    message:
      '"WORKSPACE_INACTIVE_DAYS_BEFORE_NOTIFICATION" should be strictly lower than "WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION"',
  })
  WORKSPACE_INACTIVE_DAYS_BEFORE_NOTIFICATION = 7;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Number of inactive days before soft deleting workspaces',
  })
  @CastToPositiveNumber()
  @IsNumber()
  @IsStrictlyLowerThan('WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION', {
    message:
      '"WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION" should be strictly lower than "WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION"',
  })
  WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION = 14;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Number of inactive days before deleting workspaces',
  })
  @CastToPositiveNumber()
  @IsNumber()
  WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION = 21;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Maximum number of workspaces that can be deleted in a single execution',
  })
  @CastToPositiveNumber()
  @IsNumber()
  @ValidateIf((env) => env.MAX_NUMBER_OF_WORKSPACES_DELETED_PER_EXECUTION > 0)
  MAX_NUMBER_OF_WORKSPACES_DELETED_PER_EXECUTION = 5;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description: 'Throttle limit for workflow execution',
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_THROTTLE_LIMIT = 10;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description: 'Time-to-live for workflow execution throttle in milliseconds',
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_THROTTLE_TTL = 1000;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.CaptchaConfig,
    description: 'Driver for captcha integration',
  })
  @IsEnum(CaptchaDriverType)
  @IsOptional()
  CAPTCHA_DRIVER?: CaptchaDriverType;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.CaptchaConfig,
    sensitive: true,
    description: 'Site key for captcha integration',
  })
  @IsString()
  @IsOptional()
  CAPTCHA_SITE_KEY?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.CaptchaConfig,
    sensitive: true,
    description: 'Secret key for captcha integration',
  })
  @IsString()
  @IsOptional()
  CAPTCHA_SECRET_KEY?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.ServerConfig,
    sensitive: true,
    description: 'License key for the Enterprise version',
  })
  @IsString()
  @IsOptional()
  ENTERPRISE_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Health monitoring time window in minutes',
  })
  @IsNumber()
  @CastToPositiveNumber()
  @IsOptional()
  HEALTH_MONITORING_TIME_WINDOW_IN_MINUTES = 5;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Enable or disable the attachment preview feature',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  IS_ATTACHMENT_PREVIEW_ENABLED = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Base URL for Arxena site backend (org charts). Defaults to http://localhost:5050',
  })
  @IsOptional()
  @IsString()
  ARXENA_SITE_URL = 'http://localhost:5050';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Optional override for orgchart build endpoint (e.g. http://arxena-site:5050/api/orgchart/build).',
  })
  @IsOptional()
  @IsString()
  ARXENA_SITE_ORGCHART_URL?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'People Data Labs API key for org-chart company autocomplete. When set, autocomplete runs in NestJS instead of proxying to arxena-site.',
  })
  @IsOptional()
  @IsString()
  PDL_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'CoreSignal API key (https://docs.coresignal.com) for multi-source employee search (org movement, etc.).',
  })
  @IsOptional()
  @IsString()
  CORESIGNAL_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'CoreSignal employee index for org movement and collect: multi_source (default) or employee_base. See CORESIGNAL_API_KEY.',
  })
  @IsString()
  @IsIn(['multi_source', 'employee_base'])
  @IsOptional()
  CORESIGNAL_EMPLOYEE_API?: 'multi_source' | 'employee_base';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'Nubela API key for company logo lookup (https://nubela.co). Used by org-chart company autocomplete to show company logos.',
  })
  @IsOptional()
  @IsString()
  NUBELA_API_KEY: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'Apify API token for LinkedIn company employee count (harvestapi/linkedin-company-employees) and future actors.',
  })
  @IsOptional()
  @IsString()
  APIFY_API_TOKEN?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description:
      'Elasticsearch endpoint URL for org charts (e.g. http://user:pass@host:9200)',
  })
  @IsOptional()
  @IsString()
  ES_ENDPOINT?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Elasticsearch index name for org charts',
  })
  @IsOptional()
  @IsString()
  ORGCHARTS_ES_INDEX = 'org-charts-all';


  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Elasticsearch index name for people',
  })
  @IsOptional()
  @IsString()
  PEOPLE_ES_INDEX = 'people_all';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Elasticsearch index name for companies (top hired from)',
  })
  @IsOptional()
  @IsString()
  COMPANIES_ES_INDEX = 'companies_index_text';

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description: 'Apollo API key for contact enrichment',
  })
  @IsOptional()
  @IsString()
  APOLLO_API_KEY?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description: 'Apollo webhook URL for phone number enrichment (optional)',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  APOLLO_WEBHOOK_URL?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description: 'ContactOut API token for contact enrichment',
  })
  @IsOptional()
  @IsString()
  CONTACTOUT_API_TOKEN?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    sensitive: true,
    description: 'Lusha API key for contact enrichment',
  })
  @IsOptional()
  @IsString()
  LUSHA_API_KEY?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description:
      'Rate limit (requests per minute) for PDL contact enrichment. Default 60.',
  })
  @IsOptional()
  @IsString()
  CONTACT_ENRICHMENT_RATE_LIMIT_PDL?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description:
      'Rate limit (requests per minute) for ContactOut contact enrichment. Default 150.',
  })
  @IsOptional()
  @IsString()
  CONTACT_ENRICHMENT_RATE_LIMIT_CONTACTOUT?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description:
      'Rate limit (requests per minute) for Lusha contact enrichment. Default 1500.',
  })
  @IsOptional()
  @IsString()
  CONTACT_ENRICHMENT_RATE_LIMIT_LUSHA?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.RateLimiting,
    description:
      'Rate limit (requests per minute) for Apollo contact enrichment. Default 60.',
  })
  @IsOptional()
  @IsString()
  CONTACT_ENRICHMENT_RATE_LIMIT_APOLLO?: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Use proxy for WhatsApp (Baileys) connections. Set to false to connect without proxy (e.g. when Socks5 auth fails or for local dev). Default true.',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  WHATSAPP_USE_PROXY = true;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'ElevenLabs WhatsApp Business API: phone number ID for outbound calls (from Meta WhatsApp Manager).',
  })
  @IsOptional()
  @IsString()
  ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'ElevenLabs WhatsApp: call permission request message template name (created in WhatsApp Manager).',
  })
  @IsOptional()
  @IsString()
  ELEVENLABS_WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'ElevenLabs WhatsApp: call permission request template language code (e.g. en). Defaults to en in code if unset.',
  })
  @IsOptional()
  @IsString()
  ELEVENLABS_WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'API token for WhatsApp Business webhook call events when phone_number_id cannot be mapped to a workspace. Used by /webhook POST to create PhoneCall records.',
  })
  @IsOptional()
  @IsString()
  WHATSAPP_BUSINESS_WEBHOOK_API_TOKEN: string;

  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'When false, #DONTRESPOND# AI control messages are not persisted to the database or sent to candidates. Default true (messages are saved but not sent).',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  SAVE_DONTRESPOND_MESSAGES = true;
  @EnvironmentVariablesMetadata({
    group: EnvironmentVariablesGroup.Other,
    description:
      'Enable silent hours for candidate engagement (no outbound messages between 23:00 and 07:00 recruiter local time).',
  })
  @CastToBoolean()
  @IsOptional()
  @IsBoolean()
  ENGAGEMENT_SILENT_HOURS_ENABLED = false;
}
  


export const validate = (
  config: Record<string, unknown>,
): EnvironmentVariables => {
  const validatedConfig = plainToClass(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, { strictGroups: true });

  const warnings = validateSync(validatedConfig, { groups: ['warning'] });

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      if (warning.constraints && warning.property) {
        Object.values(warning.constraints).forEach((message) => {
          Logger.warn(message);
        });
      }
    });
  }

  assert(!errors.length, errors.toString());

  return validatedConfig;
};
