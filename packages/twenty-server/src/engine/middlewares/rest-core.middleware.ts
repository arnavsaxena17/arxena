import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

import { NextFunction, Request, Response } from 'express';

import { MiddlewareService } from 'src/engine/middlewares/middleware.service';

/** Header set by MCP tools so REST API calls from tools can be logged and identified. */
const MCP_REQUEST_SOURCE_HEADER = 'x-request-source';
const MCP_REQUEST_SOURCE_VALUE = 'mcp';

@Injectable()
export class RestCoreMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RestCoreMiddleware.name);

  constructor(private readonly middlewareService: MiddlewareService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      await this.middlewareService.authenticateRestRequest(req);
    } catch (error) {
      this.middlewareService.writeRestResponseOnExceptionCaught(res, error);

      return;
    }

    const source =
      req.headers[MCP_REQUEST_SOURCE_HEADER] === MCP_REQUEST_SOURCE_VALUE
        ? ' [MCP]'
        : '';
    this.logger.log(
      `${req.method} ${req.originalUrl || req.url}${source}`,
    );

    next();
  }
}
