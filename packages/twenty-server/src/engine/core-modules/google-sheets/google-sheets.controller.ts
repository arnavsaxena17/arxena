// google-sheets.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Headers } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';

@Controller('sheets')
export class GoogleSheetsController {
  constructor(private readonly sheetsService: GoogleSheetsService) {}

  @Post()
  async createSpreadsheet(
    @Headers('authorization') authHeader: string,
    @Body('title') title: string,
  ) {
    const twentyToken = authHeader.replace('Bearer ', '');
    const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
    console.log("auth:", auth)
    return this.sheetsService.createSpreadsheet(auth, title);
  }

  @Post(':spreadsheetId/values')
  async updateValues(
    @Headers('authorization') authHeader: string,
    @Param('spreadsheetId') spreadsheetId: string,
    @Body('range') range: string,
    @Body('values') values: any[][],
  ) {
    const twentyToken = authHeader.replace('Bearer ', '');
    const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
    return this.sheetsService.updateValues(auth, spreadsheetId, range, values, twentyToken);
  }

  @Get(':spreadsheetId/values/:range')
  async getValues(
    @Headers('authorization') authHeader: string,
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
  ) {
    const twentyToken = authHeader.replace('Bearer ', '');
    const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
    return this.sheetsService.getValues(auth, spreadsheetId, range);
  }

  @Delete(':spreadsheetId')
  async deleteSheet(
    @Headers('authorization') authHeader: string,
    @Param('spreadsheetId') spreadsheetId: string,
  ) {
    const twentyToken = authHeader.replace('Bearer ', '');
    const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
    return this.sheetsService.deleteSheet(auth, spreadsheetId);
  }
}