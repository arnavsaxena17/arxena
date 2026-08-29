import * as Sentry from '@sentry/node';
import { type Request } from 'express';
import { DocumentNode, parse } from 'graphql';
import { type Plugin } from 'graphql-yoga';

import { isNull } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type DirectExecutionService } from 'src/engine/api/graphql/direct-execution/direct-execution.service';
import { classifyTopLevelFields } from 'src/engine/api/graphql/direct-execution/utils/classify-top-level-fields.util';
import { findOperationDefinition } from 'src/engine/api/graphql/direct-execution/utils/find-operation-definition.util';
import { isSubscriptionOperation } from 'src/engine/api/graphql/direct-execution/utils/is-subscription-operation.util';
import { type FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';

export type DirectExecutionPluginConfig = {
  directExecutionService: DirectExecutionService;
  featureFlagService: FeatureFlagService;
};

const getExpressRequest = (
  serverContext: unknown,
): Request | undefined => {
  const req = (serverContext as { req?: Request } | undefined)?.req;

  return req;
};

export function useDirectExecution(
  config: DirectExecutionPluginConfig,
): Plugin {
  const expressReqByFetchRequest = new WeakMap<globalThis.Request, Request>();

  return {
    // onRequest runs before Yoga parses the body, so req.body.query is often
    // missing on the first authenticated page load. Stash Express req here /
    // in onRequestParse, then intercept in onParams where params.query exists.
    onRequest: ({ request, serverContext }) => {
      const req = getExpressRequest(serverContext);

      if (isDefined(req)) {
        expressReqByFetchRequest.set(request, req);
      }
    },
    onRequestParse: ({ request, serverContext }) => {
      const req = getExpressRequest(serverContext);

      if (isDefined(req)) {
        expressReqByFetchRequest.set(request, req);
      }
    },
    onParams: async ({ params, request, setResult }) => {
      const req = expressReqByFetchRequest.get(request);

      if (!req?.workspace?.id || !params.query) {
        return;
      }

      req.body = {
        ...req.body,
        query: params.query,
        operationName: params.operationName,
        variables: params.variables,
      };

      const queryString = params.query;
      const operationName = params.operationName;

      let document: DocumentNode;
      try {
        document = parse(queryString);
      } catch {
        return;
      }

      const operationDefinition = findOperationDefinition(
        document,
        operationName,
      );

      if (
        !operationDefinition ||
        isSubscriptionOperation(document, operationName)
      ) {
        return;
      }

      let workspaceResolverNames: Set<string>;

      try {
        workspaceResolverNames =
          (await config.directExecutionService.getWorkspaceResolverNames(
            req.workspace.id,
          )) ?? new Set();
      } catch {
        // Cold / stale resolver-name cache must not fall through to the core
        // schema (HTTP 400 Unknown type "DashboardFilterInput").
        workspaceResolverNames = new Set();
      }

      const { hasIntrospectionFields, hasWorkspaceFields, hasCoreFields } =
        classifyTopLevelFields(document, operationName, workspaceResolverNames);

      if (hasCoreFields && hasWorkspaceFields) {
        const error = new UserInputError(
          'This query cannot be executed as a single request. Please split it into separate queries.',
        );

        setResult({ errors: [error] });

        return;
      }

      if (hasCoreFields) {
        return;
      }

      if (!hasIntrospectionFields && !hasWorkspaceFields) {
        return;
      }

      if (Sentry.isInitialized()) {
        const transactionName =
          operationName || operationDefinition.name?.value || '';

        Sentry.setTags({
          operationName: transactionName,
          operation: operationDefinition.operation,
        });
        Sentry.getCurrentScope().setTransactionName(transactionName);
      }

      const result = await config.directExecutionService.execute(
        req,
        document,
        hasIntrospectionFields,
        hasWorkspaceFields,
      );

      if (isNull(result)) {
        return;
      }

      setResult(result);
    },
  };
}
