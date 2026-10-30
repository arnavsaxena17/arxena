import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { Request } from 'express';

import { OutreachTabDto } from 'src/engine/core-modules/bright-data/dto/outreach-tab.dto';
import { OutreachTabTool } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/outreach-tab-tool';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';

const BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

// Export or dedupe a project's Companies / People tab. There is no list.
@Controller('outreach-tab')
export class OutreachTabController {
  constructor(private readonly outreachTabTool: OutreachTabTool) {}

  @Post('run')
  @UseGuards(JwtAuthGuard, NoPermissionGuard)
  async run(
    @Req() request: Request,
    @Body(BODY_VALIDATION_PIPE) body: OutreachTabDto,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new HttpException(
        'Workspace context required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.outreachTabTool.execute({ ...body }, { workspaceId });
  }
}
