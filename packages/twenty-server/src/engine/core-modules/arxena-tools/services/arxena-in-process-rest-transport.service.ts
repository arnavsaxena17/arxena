import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import {
  type RestRequest,
  type RestTransport,
} from 'src/engine/core-modules/arxena-tools/library/api/rest-client';
import { OutreachTabTool } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/outreach-tab-tool';
import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

export type ArxenaRestRequest = RestRequest;
export type ArxenaRestTransport = RestTransport;

type InProcessRoute = (
  request: ArxenaRestRequest,
  context: ToolExecutionContext,
) => Promise<ToolOutput>;

// Library handlers used to call this server's own REST API. A route listed
// here is answered by calling the Nest tool directly, the same code the REST
// controller calls, so it skips the HTTP hop, the token and the guards. Routes
// not listed still go over HTTP; move them across one at a time.
// Set ARXENA_IN_PROCESS_TOOLS=false to send everything back over HTTP.
@Injectable()
export class ArxenaInProcessRestTransportService {
  private readonly logger = new Logger(
    ArxenaInProcessRestTransportService.name,
  );

  constructor(private readonly moduleRef: ModuleRef) {}

  private readonly routes: Record<string, InProcessRoute> = {
    'POST bright-data/business-search/company': (request, context) =>
      this.moduleRef
        .get(SearchBrightDataBusinessTool, { strict: false })
        .execute({ ...request.body, entity: 'company' }, context),
    'POST bright-data/business-search/people': (request, context) =>
      this.moduleRef
        .get(SearchBrightDataBusinessTool, { strict: false })
        .execute({ ...request.body, entity: 'people' }, context),
    'POST outreach-tab/run': (request, context) =>
      this.moduleRef
        .get(OutreachTabTool, { strict: false })
        .execute({ ...request.body }, context),
  };

  isEnabled(): boolean {
    return (
      process.env.ARXENA_IN_PROCESS_TOOLS?.trim().toLowerCase() !== 'false'
    );
  }

  getRouteKeys(): string[] {
    return Object.keys(this.routes);
  }

  forContext(context: ToolExecutionContext): ArxenaRestTransport | undefined {
    if (!this.isEnabled()) {
      return undefined;
    }

    return async (request) => {
      const route =
        this.routes[
          `${request.method} ${request.pathPrefix}/${request.endpoint}`
        ];

      if (route === undefined) {
        return { handled: false };
      }

      this.logger.debug(
        `${request.method} /${request.pathPrefix}/${request.endpoint} answered in process`,
      );

      return { handled: true, data: await route(request, context) };
    };
  }
}
