import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { CompanyAutocompleteDto } from '../dto/company-autocomplete.dto';
import { OrgChartNodePeopleDto } from '../dto/org-chart-node-people.dto';
import { OrgChartQueryDto } from '../dto/org-chart-query.dto';
import { CompanyLogoService } from '../services/company-logo.service';
import { OrgChartService } from '../services/org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  private readonly logger = new Logger(OrgChartController.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly companyLogoService: CompanyLogoService,
  ) {}

  private getAuthToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const cookies = req.headers.cookie;
    if (cookies) {
      const match = cookies.match(/auth_token=([^;]+)/);
      if (match) return match[1];
    }
    return undefined;
  }

  @Get('company-logo')
  async getCompanyLogo(
    @Query('website') website: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!website?.trim()) {
      throw new HttpException(
        'Query parameter "website" is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { ok, contentType, body } =
      await this.companyLogoService.fetchLogoByWebsite(website);
    if (!ok || body.byteLength === 0) {
      res.status(404).send();
      return;
    }
    res.setHeader(
      'Content-Type',
      contentType ?? 'image/png',
    );
    res.send(Buffer.from(body));
  }

  @Post('companies/autocomplete')
  async companyAutocomplete(@Body() dto: CompanyAutocompleteDto, @Req() req: Request) {
    try {
      const authToken = this.getAuthToken(req);
      const results = await this.orgChartService.getCompanyAutocomplete(
        dto.input_text,
        authToken,
      );
      return { result: results, status: 'ok' };
    } catch (error) {
      this.logger.error('Company autocomplete failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Autocomplete failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':companyId')
  async getOrgChart(
    @Param('companyId') companyId: string,
    @Query('companyName') companyName: string | undefined,
    @Query('website') website: string | undefined,
    @Query('country') country: string | undefined,
    @Query('functionRoot') functionRoot: string | undefined,
    @Req() req: Request,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }
    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getOrgChart(
        companyId,
        {
          companyName,
          website,
          country,
          functionRoot,
        },
        authToken,
      );
      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error(`Get org chart failed for ${companyId}`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('manual/:companyId')
  async getManualOrgChart(
    @Param('companyId') companyId: string,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.orgChartService.getManualOrgChart(
        companyId,
      );
      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get MANUAL org chart failed for ${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch manual org chart',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':companyId/node-people')
  async getNodePeople(
    @Param('companyId') companyId: string,
    @Body() body: OrgChartNodePeopleDto,
    @Req() req: Request,
  ) {
    if (!companyId || companyId.includes('/') || companyId.includes('..')) {
      throw new HttpException('Invalid company ID', HttpStatus.BAD_REQUEST);
    }

    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getNodePeople(
        companyId,
        body,
        authToken,
      );
      return { ...result, status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Get node people failed for companyId=${companyId}`,
        error,
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch people for node',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('query')
  async postQuery(@Body() dto: OrgChartQueryDto, @Req() req: Request) {
    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.postQuery(
        {
          query: dto.query,
          params: dto.params,
          selected_context_menu: dto.selected_context_menu,
          selected_nodes: dto.selected_nodes,
          selected_blocks: dto.selected_blocks,
        },
        authToken,
      );
      return { result, status: 'ok' };
    } catch (error) {
      this.logger.error('Org chart query failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Query failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('contact-info')
  async getContactInfo(
    @Body()
    body: {
      linkedinUrl: string;
    },
    @Req() req: Request,
  ) {
    if (!body?.linkedinUrl || !body.linkedinUrl.trim()) {
      throw new HttpException(
        'Body field "linkedinUrl" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const authToken = this.getAuthToken(req);
      const result = await this.orgChartService.getContactInfoForPerson(
        { linkedinUrl: body.linkedinUrl },
        authToken,
      );
      return { ...result, status: 'ok' };
    } catch (error) {
      this.logger.error('Get contact info failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch contact info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
