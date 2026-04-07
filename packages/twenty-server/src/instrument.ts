import * as Sentry from '@sentry/nestjs';
import type { NodeOptions } from '@sentry/node';

import { NodeEnvironment } from 'src/engine/core-modules/environment/interfaces/node-environment.interface';

import { ExceptionHandlerDriver } from 'src/engine/core-modules/exception-handler/interfaces';
import { WorkspaceCacheKeys } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';

type SentryIntegration = Exclude<
  NonNullable<NodeOptions['integrations']>,
  (integrations: unknown[]) => unknown[]
>[number];

if (process.env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.Sentry) {
  const integrations: SentryIntegration[] = [
    // TODO: Redis integration doesn't seem to work - investigate why
    Sentry.redisIntegration({
      cachePrefixes: Object.values(WorkspaceCacheKeys).map(
        (key) => `engine:${key}:`,
      ),
    }),
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
    Sentry.graphqlIntegration(),
    Sentry.postgresIntegration(),
  ];

  let profilesSampleRate = 0;

  try {
    const { nodeProfilingIntegration } = require('@sentry/profiling-node') as {
      nodeProfilingIntegration: () => SentryIntegration;
    };

    integrations.push(nodeProfilingIntegration());
    profilesSampleRate = 0.3;
  } catch (error) {
    console.warn(
      'Sentry profiling integration unavailable; continuing without CPU profiling.',
      error instanceof Error ? error.message : error,
    );
  }

  Sentry.init({
    environment: process.env.SENTRY_ENVIRONMENT,
    release: process.env.SENTRY_RELEASE,
    dsn: process.env.SENTRY_DSN,
    integrations,
    tracesSampleRate: 0.1,
    profilesSampleRate,
    debug: process.env.NODE_ENV === NodeEnvironment.development,
  });
}
