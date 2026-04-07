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
    const origin =
      request.headers['x-origin-domain'] ||
      request.headers.origin ||
      request.headers.referer ||
      request.query?.origin ||
      'unknown';

    if (!apiToken) {
      throw new Error('Authorization token is required');
    }

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
