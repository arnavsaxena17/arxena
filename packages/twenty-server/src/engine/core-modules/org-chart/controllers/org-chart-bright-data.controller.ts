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

import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Request } from 'express';

import { OrgChartBrightDataPeopleService } from 'src/engine/core-modules/org-chart/services/org-chart-bright-data-people.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

class OrgChartBrightDataPeopleDto {
  @IsString()
  @MaxLength(200)
  companyName: string;

  @IsString()
  @MaxLength(150)
  roleQuery: string;

  @IsOptional()
  @IsIn(['ludicrous', 'smart', 'instant'])
  mode?: 'ludicrous' | 'smart' | 'instant';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10)
  maxBudgetUsd?: number;
}

const BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('org-chart/bright-data')
@UseGuards(JwtAuthGuard)
export class OrgChartBrightDataController {
  constructor(
    private readonly orgChartBrightDataPeopleService: OrgChartBrightDataPeopleService,
  ) {}

  @Post('people')
  async findPeopleAtCompany(
    @Req() request: Request,
    @Body(BODY_VALIDATION_PIPE) body: OrgChartBrightDataPeopleDto,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new HttpException(
        'Workspace context required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      return await this.orgChartBrightDataPeopleService.findPeopleAtCompany({
        workspaceId,
        ...body,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Bright Data people search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
