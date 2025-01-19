// google-sheets.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import axios from 'axios';

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
    return this.sheetsService.createSpreadsheetForJob(title, twentyToken);
  }

  @Get(':spreadsheetId')
  async getSheetData(
    @Headers('authorization') authHeader: string,
    @Param('spreadsheetId') spreadsheetId: string,
  ) {
    try {
      if (!authHeader) {
        throw new HttpException('Authorization header is required', HttpStatus.UNAUTHORIZED);
      }

      const twentyToken = authHeader.replace('Bearer ', '');
      const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
      
      if (!auth) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      if (!spreadsheetId) {
        throw new HttpException('Spreadsheet ID is required', HttpStatus.BAD_REQUEST);
      }

      const data = await this.sheetsService.getValues(auth, spreadsheetId, 'Sheet1');

      if (!data || !data.values) {
        throw new HttpException('No data found in sheet', HttpStatus.NOT_FOUND);
      }

      return {
        headers: data.values[0] || [],
        values: data.values,
        total: data.values.length - 1 // Exclude header row
      };
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to fetch sheet data: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':spreadsheetId/values')
  async updateValues(
    @Headers('authorization') authHeader: string,
    @Param('spreadsheetId') spreadsheetId: string,
    @Body('range') range: string,
    @Body('values') values: any[][],
  ) {
    try {
      const twentyToken = authHeader.replace('Bearer ', '');
      const auth = await this.sheetsService.loadSavedCredentialsIfExist(twentyToken);
      
      if (!auth) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }
  
      // Validate input
      if (!range || !values) {
        throw new HttpException('Range and values are required', HttpStatus.BAD_REQUEST);
      }
  
      const result = await this.sheetsService.updateValues(
        auth, 
        spreadsheetId, 
        range, 
        values, 
        twentyToken
      );

    await this.sheetsService.sortSheetByInferredSalary(auth, spreadsheetId);

      return result;
    } catch (error) {
      console.log('Error updating sheet values:', error);
      throw new HttpException (
        'Failed to update sheet: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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

  @Get('api/google-sheet')

  async getGoogleSheet() {
    try {
      const response = await axios.get(
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbhFs4WT2cM6mXKz3ujQtQ-FF3WNgQdJI6rLXpki66sAbgA6nIHYGw4nwJyl-mrvY_DoytO_VpyyH/pubhtml?widget=true&headers=false',
        {
          headers: {
            'Accept': 'text/html',
            'Content-Type': 'text/html',
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Google Sheet:', error);
      throw error;
    }
  }

}