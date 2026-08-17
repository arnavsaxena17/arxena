import * as Sentry from '@sentry/node';
import {
  getGenericOperationName,
  getHumanReadableNameFromCode,
  isDefined,
} from 'twenty-shared/utils';

import { type ExceptionHandlerOptions } from 'src/engine/core-modules/exception-handler/interfaces/exception-handler-options.interface';

import { PostgresException } from 'src/engine/api/graphql/workspace-query-runner/utils/postgres-exception';
import { type ExceptionHandlerDriverInterface } from 'src/engine/core-modules/exception-handler/interfaces';
import { formatExceptionPath } from 'src/engine/core-modules/exception-handler/utils/format-exception-path.util';
import { MessageImportDriverException } from 'src/modules/messaging/message-import-manager/drivers/exceptions/message-import-driver.exception';
import { CustomException } from 'src/utils/custom-exception';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class ExceptionHandlerSentryDriver implements ExceptionHandlerDriverInterface {
  captureExceptions(
    // oxlint-disable-next-line typescript/no-explicit-any
    exceptions: ReadonlyArray<any>,
    options?: ExceptionHandlerOptions,
  ) {
    const eventIds: string[] = [];

    try {
      Sentry.withScope((scope) => {
        if (options?.operation) {
          scope.setExtra('operation', options.operation.name);
          scope.setExtra('operationType', options.operation.type);
        }

        if (options?.document) {
          scope.setExtra('document', options.document);
        }

        if (options?.workspace) {
          scope.setExtra('workspace', options.workspace);
        }

        if (options?.additionalData) {
          scope.setExtra('additionalData', options.additionalData);
        }

        if (options?.user) {
          scope.setUser({
            id: options.user.id,
            email: options.user.email,
            firstName: options.user.firstName,
            lastName: options.user.lastName,
          });
        }

        for (const exception of exceptions) {
          const errorPath = formatExceptionPath(
            isRecord(exception) ? exception.path : undefined,
          );

          if (errorPath) {
            scope.addBreadcrumb({
              category: 'execution-path',
              message: errorPath,
              level: 'debug',
            });
          }

          if (isRecord(exception) && isRecord(exception.context)) {
            Object.entries(exception.context).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }

          if (isRecord(exception) && isRecord(exception.cause)) {
            scope.setContext('cause', {
              name: exception.cause.name,
              message: exception.cause.message,
              stack: exception.cause.stack,
            });
          }

          if (
            exception instanceof CustomException &&
            exception.code !== 'UNKNOWN'
          ) {
            scope.setTag('customExceptionCode', exception.code);
            scope.setFingerprint([exception.code]);
            exception.name = getHumanReadableNameFromCode(exception.code);
          }

          if (exception instanceof PostgresException) {
            scope.setTag('postgresSqlErrorCode', exception.code);
            const fingerPrint = [exception.code];
            const genericOperationName = getGenericOperationName(
              options?.operation?.name,
            );

            if (isDefined(genericOperationName)) {
              fingerPrint.push(genericOperationName);
            }
            scope.setFingerprint(fingerPrint);
            exception.name = exception.message;
          }

          if (exception instanceof MessageImportDriverException) {
            scope.setTag('messageImportDriverCode', exception.code);
            scope.setFingerprint([exception.code]);
          }

          const eventId = Sentry.captureException(exception, {
            contexts: {
              GraphQL: {
                operationName: options?.operation?.name,
                operationType: options?.operation?.type,
              },
            },
          });

          eventIds.push(eventId);
        }
      });
    } catch (error) {
      // Reporting must never take down the process.
      // oxlint-disable-next-line no-console
      console.error('Failed to capture exceptions in Sentry driver', error);
    }

    return eventIds;
  }
}
