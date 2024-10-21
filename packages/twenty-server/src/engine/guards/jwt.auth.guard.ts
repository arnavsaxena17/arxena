import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';

import { JsonWebTokenError } from 'jsonwebtoken';
import { Socket } from 'socket.io';

import { assert } from 'src/utils/assert';
import { getRequest } from 'src/utils/extract-request';
// import { TokenService } from '../core-modules/auth/services/token.service';
import { TokenService } from 'src/engine/core-modules/auth/token/services/token.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt']) {
  constructor() {
    super();
  }

  getRequest(context: ExecutionContext) {
    return getRequest(context);
  }

  handleRequest(err: any, user: any, info: any) {
    assert(user, '', UnauthorizedException);

    if (err) {
      throw err;
    }

    if (info && info instanceof Error) {
      if (info instanceof JsonWebTokenError) {
        info = String(info);
      }

      throw new UnauthorizedException(info);
    }

    return user;
  }
}

@Injectable()
export class JwtAuthGuardForSocket extends AuthGuard(['jwt']) {
  constructor() {
    super();
  }

  getRequest(context: ExecutionContext) {
    return getRequest(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const wsContext = context.switchToWs();
    const client = wsContext.getClient<Socket>();

    assert(user, '', UnauthorizedException);

    if (err) {
      throw new WsException(err.message);
    }

    if (info && info instanceof Error) {
      if (info instanceof JsonWebTokenError) {
        info = String(info);
      }
      throw new WsException(info);
    }

    // Attach user to the socket's handshake
    client.handshake.auth.user = user;

    return user;
  }
}

@Injectable()
export class WsGuard extends AuthGuard(['jwt']) {
  constructor(private readonly tokenService: TokenService) {
    console.log('Use gaurd ws guard called');
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = context.switchToWs().getClient().handshake.headers.authorization.split(' ')[1]; // token saved as `Bearer ${token}`
    console.log('canactivate called');

    try {
      const { workspaceMemberId, workspaceId } = await this.tokenService.verifyTransientToken(token);
      context.switchToWs().getData().workspaceMemberId = workspaceMemberId;
      return Boolean(workspaceMemberId);
    } catch (err) {
      console.log(err);
      throw new WsException(err.message);
    }
  }
}
