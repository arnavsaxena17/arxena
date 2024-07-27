import { Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { TokenService } from '../services/token.service';

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
