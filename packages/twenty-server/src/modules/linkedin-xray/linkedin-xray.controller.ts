import { Body, Controller, Get, Post } from '@nestjs/common';

import { BuildLinkedinXrayDto } from 'src/modules/linkedin-xray/dtos/build-linkedin-xray.dto';
import { ParseLinkedinXrayDto } from 'src/modules/linkedin-xray/dtos/parse-linkedin-xray.dto';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';

@Controller('linkedin-xray')
export class LinkedinXrayController {
  constructor(private readonly linkedinXrayService: LinkedinXrayService) {}

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
}
