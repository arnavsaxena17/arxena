import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { BuildLinkedinXrayDto } from 'src/modules/linkedin-xray/dtos/build-linkedin-xray.dto';
import { FetchLinkedinXrayPeopleResultsDto } from 'src/modules/linkedin-xray/dtos/fetch-linkedin-xray-people-results.dto';
import { ParseLinkedinXrayDto } from 'src/modules/linkedin-xray/dtos/parse-linkedin-xray.dto';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';

@Controller('linkedin-xray')
export class LinkedinXrayController {
  constructor(
    private readonly linkedinXrayService: LinkedinXrayService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('options')
  getOptions() {
    return this.linkedinXrayService.getOptions();
  }

  @Post()
  build(@Body() dto: BuildLinkedinXrayDto) {
    return this.linkedinXrayService.buildLinkedinXray(dto);
  }

  @Post('parse')
  async parse(@Body() dto: ParseLinkedinXrayDto) {
    return this.linkedinXrayService.parseRawQuery(dto.rawQuery);
  }

  @Post('fetch-people-results')
  async fetchPeopleResults(
    @Body() dto: FetchLinkedinXrayPeopleResultsDto,
    @Req() request: any,
  ) {
    const apiToken =
      request?.headers?.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '') ||
      '';
    const originHeader = request.headers['x-origin-domain'];
    const originFromOriginHeader = request.headers.origin;
    const originFromReferer = request.headers.referer;
    const originFromQuery = request.query?.origin;
    const origin =
      originHeader ||
      originFromOriginHeader ||
      originFromReferer ||
      originFromQuery ||
      'unknown';

    console.log('[LinkedinXrayController] Origin resolved:', {
      resolved: origin,
      source: originHeader
        ? 'headers[x-origin-domain]'
        : originFromOriginHeader
          ? 'headers[origin]'
          : originFromReferer
            ? 'headers[referer]'
            : originFromQuery
              ? 'query[origin]'
              : 'fallback[unknown]',
      raw: {
        'x-origin-domain': originHeader,
        origin: originFromOriginHeader,
        referer: originFromReferer,
        'query.origin': originFromQuery,
      },
    });

    if (!apiToken) {
      throw new Error('Authorization token is required');
    }

    console.log('[LinkedinXrayController] Calling getCurrentUser with origin:', origin);
    const currentUser = await new RecruiterProfileService(
      this.staticGraphQLService,
    ).getCurrentUser(apiToken, origin);
    const recruiterId = currentUser?.workspaceMember?.id;

    if (!recruiterId) {
      throw new Error('Could not resolve recruiter ID');
    }

    return this.linkedinXrayService.queuePeopleResultsFetch(dto, {
      apiToken,
      origin,
      recruiterId,
    });
  }
}
