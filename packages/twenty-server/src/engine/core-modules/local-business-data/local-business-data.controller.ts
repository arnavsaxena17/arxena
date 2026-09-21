import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import {
  LocalBusinessAutocompleteDto,
  LocalBusinessDetailsDto,
  LocalBusinessSearchDto,
  LocalBusinessSearchInAreaDto,
  LocalBusinessSearchNearbyDto,
} from 'src/engine/core-modules/local-business-data/dto/local-business-data.dto';
import { LocalBusinessDataService } from 'src/engine/core-modules/local-business-data/local-business-data.service';

const BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('local-business-data')
@UseGuards(JwtAuthGuard)
export class LocalBusinessDataController {
  private readonly logger = new Logger(LocalBusinessDataController.name);

  constructor(
    private readonly localBusinessDataService: LocalBusinessDataService,
  ) {}

  @Post('search')
  async search(@Body(BODY_VALIDATION_PIPE) body: LocalBusinessSearchDto) {
    try {
      const businesses = await this.localBusinessDataService.search({
        query: body.query,
        limit: body.limit,
        lat: body.lat,
        lng: body.lng,
        zoom: body.zoom,
        language: body.language,
        region: body.region,
        extractEmailsAndContacts: body.extractEmailsAndContacts,
        subtypes: body.subtypes,
        verified: body.verified,
        businessStatus: body.businessStatus,
        fields: body.fields,
      });

      return {
        businesses,
        count: businesses.length,
      };
    } catch (error) {
      this.rethrow(error, 'search');
    }
  }

  @Post('search-nearby')
  async searchNearby(
    @Body(BODY_VALIDATION_PIPE) body: LocalBusinessSearchNearbyDto,
  ) {
    try {
      const businesses = await this.localBusinessDataService.searchNearby({
        query: body.query,
        lat: body.lat,
        lng: body.lng,
        limit: body.limit,
        language: body.language,
        region: body.region,
        extractEmailsAndContacts: body.extractEmailsAndContacts,
        subtypes: body.subtypes,
        verified: body.verified,
        businessStatus: body.businessStatus,
        fields: body.fields,
      });

      return {
        businesses,
        count: businesses.length,
      };
    } catch (error) {
      this.rethrow(error, 'search-nearby');
    }
  }

  @Post('search-in-area')
  async searchInArea(
    @Body(BODY_VALIDATION_PIPE) body: LocalBusinessSearchInAreaDto,
  ) {
    try {
      const businesses = await this.localBusinessDataService.searchInArea({
        query: body.query,
        lat: body.lat,
        lng: body.lng,
        zoom: body.zoom,
        limit: body.limit,
        language: body.language,
        region: body.region,
        extractEmailsAndContacts: body.extractEmailsAndContacts,
        subtypes: body.subtypes,
        verified: body.verified,
        businessStatus: body.businessStatus,
        fields: body.fields,
      });

      return {
        businesses,
        count: businesses.length,
      };
    } catch (error) {
      this.rethrow(error, 'search-in-area');
    }
  }

  @Post('business-details')
  async businessDetails(
    @Body(BODY_VALIDATION_PIPE) body: LocalBusinessDetailsDto,
  ) {
    try {
      const businesses = await this.localBusinessDataService.getBusinessDetails(
        {
          businessIds: body.businessIds,
          extractEmailsAndContacts: body.extractEmailsAndContacts,
          extractShareLink: body.extractShareLink,
          language: body.language,
          region: body.region,
          fields: body.fields,
        },
      );

      return {
        businesses,
        count: businesses.length,
      };
    } catch (error) {
      this.rethrow(error, 'business-details');
    }
  }

  @Post('autocomplete')
  async autocomplete(
    @Body(BODY_VALIDATION_PIPE) body: LocalBusinessAutocompleteDto,
  ) {
    try {
      const predictions = await this.localBusinessDataService.autocomplete({
        query: body.query,
        language: body.language,
        region: body.region,
      });

      return {
        predictions,
        count: predictions.length,
      };
    } catch (error) {
      this.rethrow(error, 'autocomplete');
    }
  }

  private rethrow(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`Local business data ${operation} failed`, error);
    throw new HttpException(
      error instanceof Error ? error.message : 'Local business data failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
