import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { getRequest } from 'src/utils/extract-request';

export const OriginHeader = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getRequest(ctx);

    const origin = request?.headers?.['origin'];
    if (typeof origin === 'string' && origin.startsWith('http')) {
      return origin;
    }

    const referer = request?.headers?.['referer'];
    if (typeof referer === 'string' && referer.startsWith('http')) {
      try {
        return new URL(referer).origin;
      } catch {
        // ignore invalid referer
      }
    }

    const forwardedProto = request?.headers?.['x-forwarded-proto'];
    const forwardedHost = request?.headers?.['x-forwarded-host'];
    const host = forwardedHost ?? request?.headers?.['host'];
    const proto =
      typeof forwardedProto === 'string' && forwardedProto.length > 0
        ? forwardedProto.split(',')[0]?.trim()
        : undefined;

    if (typeof host === 'string' && host.length > 0) {
      return `${proto ?? 'http'}://${host}`;
    }

    return undefined;
  },
);
