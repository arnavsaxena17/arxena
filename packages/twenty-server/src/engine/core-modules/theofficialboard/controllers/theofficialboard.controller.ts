import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { TheOfficialBoardService } from 'src/engine/core-modules/theofficialboard/services/theofficialboard.service';

@Controller('theofficialboard')
@UseGuards(JwtAuthGuard)
export class TheOfficialBoardController {
  constructor(
    private readonly theOfficialBoardService: TheOfficialBoardService,
  ) {}

  private async fetchProjectedCompany(
    slug: string,
    include?: string | string[],
  ) {
    const result =
      await this.theOfficialBoardService.fetchCompanyDetailsResolvingSlug(slug);
    const sections =
      this.theOfficialBoardService.normalizeRequestedSections(include);

    return this.theOfficialBoardService.projectCompanyResponse(
      result,
      sections,
    );
  }

  @Get('company/:slug')
  async getCompany(
    @Param('slug') slug: string,
    @Query('include') include?: string | string[],
  ) {
    try {
      return await this.fetchProjectedCompany(
        slug,
        include,
      );
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'The Official Board company fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('candidates/:slug')
  async getCandidates(@Param('slug') slug: string) {
    try {
      return await this.fetchProjectedCompany(slug, 'candidates');
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'The Official Board candidates fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('divisions/:slug')
  async getDivisions(@Param('slug') slug: string) {
    try {
      return await this.fetchProjectedCompany(slug, 'divisions');
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'The Official Board divisions fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('subsidiaries/:slug')
  async getSubsidiaries(@Param('slug') slug: string) {
    try {
      return await this.fetchProjectedCompany(slug, 'subsidiaries');
    } catch (error) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'The Official Board subsidiaries fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
