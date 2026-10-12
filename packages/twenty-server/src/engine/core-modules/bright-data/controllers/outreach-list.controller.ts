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

import { OutreachListDto } from 'src/engine/core-modules/bright-data/dto/outreach-list.dto';
import { OutreachListTool } from 'src/engine/core-modules/tool/tools/outreach-list-tool/outreach-list-tool';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

const BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

// Lists hold search results from every provider; the model gets counts and a
// capped peek or an export link, never the rows.
@Controller('outreach-list')
@UseGuards(JwtAuthGuard)
export class OutreachListController {
  constructor(private readonly outreachListTool: OutreachListTool) {}

  @Post('run')
  async run(
    @Req() request: Request,
    @Body(BODY_VALIDATION_PIPE) body: OutreachListDto,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new HttpException(
        'Workspace context required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.outreachListTool.execute({ ...body }, { workspaceId });
  }
}
