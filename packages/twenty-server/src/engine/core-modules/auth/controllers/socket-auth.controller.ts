import { Controller, Get, Req } from '@nestjs/common';
import { TokenService } from 'src/engine/core-modules/auth/token/services/token.service';

@Controller('socket-auth')
export class SocketVerifyAuth {
  constructor(private readonly tokenService: TokenService) {}

  @Get('verify')
  async socketVerifyAuthVerify(@Req() req) {
    // console.log('43342:: req', req?.headers?.authorization);
    const response = await this.tokenService.validateToken(req);
    // console.log('43342:: response', response);
    return response?.user?.id;
  }
}
