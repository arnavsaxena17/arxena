import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { BuiltWithService } from 'src/engine/core-modules/builtwith/services/builtwith.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('builtwith')
@UseGuards(JwtAuthGuard)
export class BuiltWithController {
  constructor(private readonly builtWithService: BuiltWithService) {}

  @Get('domain/:domain')
  async getDomain(
    @Param('domain') domain: string,
    @Query('detailed') detailed?: string,
    @Query('profile') profile?: string,
  ) {
    try {
      return await this.builtWithService.fetchDomain(domain, {
        includeDetailed: detailed !== 'false',
        includeProfile: profile === 'true',
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'BuiltWith domain fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('domains')
  async postDomains(
    @Body()
    body: {
      domains?: string[];
      detailed?: boolean;
      profile?: boolean;
      concurrency?: number;
    },
  ) {
    const domains = body.domains ?? [];

    if (!Array.isArray(domains) || domains.length === 0) {
      throw new HttpException(
        'Body must include a non-empty domains array',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.builtWithService.fetchDomains(domains, {
        includeDetailed: body.detailed !== false,
        includeProfile: body.profile === true,
        concurrency: body.concurrency,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'BuiltWith batch domain fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
