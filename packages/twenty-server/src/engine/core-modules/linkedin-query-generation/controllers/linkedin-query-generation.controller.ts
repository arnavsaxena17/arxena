import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';

import {
  GenerateQuerySetBatchDto,
  GenerateQuerySetDto,
  RunAgent1Dto,
  RunAgent2Dto,
  RunAgent3Dto,
  RunAgent5Dto,
  ValidateQuerySetDto,
} from 'src/engine/core-modules/linkedin-query-generation/dto/linkedin-query-generation.dto';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import {
  FactoredQuery,
  MasterLists,
  OrchestratorResult,
  ParsedRequirement,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

@Controller('linkedin-query-generation')
export class LinkedinQueryGenerationController {
  private readonly logger = new Logger(LinkedinQueryGenerationController.name);

  constructor(
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
  ) {}

  @Post('agent1/parse')
  async runAgent1(@Body() body: RunAgent1Dto): Promise<ParsedRequirement> {
    try {
      return await this.linkedinQueryGenerationService.runAgent1(body.rawRequirement, {
        queryIpLocation: body.queryIpLocation,
        model: body.model,
        temperature: body.temperature,
      });
    } catch (error) {
      this.logger.error('Agent 1 parsing failed', error.stack || error);
      throw new HttpException(
        error.message || 'Agent 1 parsing failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('agent2/master-lists')
  async runAgent2(@Body() body: RunAgent2Dto): Promise<MasterLists> {
    try {
      return await this.linkedinQueryGenerationService.runAgent2(
        body.parsedRequirement,
        {
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Agent 2 generation failed', error.stack || error);
      throw new HttpException(
        error.message || 'Agent 2 generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('agent3/primary-query')
  async runAgent3(@Body() body: RunAgent3Dto) {
    try {
      return await this.linkedinQueryGenerationService.runAgent3(
        body.parsedRequirement,
        body.masterLists,
        {
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Agent 3 primary query failed', error.stack || error);
      throw new HttpException(
        error.message || 'Agent 3 primary query failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('agent4/factoring')
  async runAgent4(@Body() body: RunAgent5Dto): Promise<FactoredQuery> {
    try {
      return await this.linkedinQueryGenerationService.runAgent4(
        body.parsedRequirement,
        body.primaryQuery,
        {
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Agent 4 factoring failed', error.stack || error);
      throw new HttpException(
        error.message || 'Agent 4 factoring failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate')
  async generate(@Body() body: GenerateQuerySetDto): Promise<OrchestratorResult> {
    try {
      return await this.linkedinQueryGenerationService.generateSearchQuerySet(
        body.rawRequirement,
        {
          verbose: body.verbose,
          queryIpLocation: body.queryIpLocation,
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Query set generation failed', error.stack || error);
      throw new HttpException(
        error.message || 'Query set generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate/batch')
  async generateBatch(
    @Body() body: GenerateQuerySetBatchDto,
  ): Promise<OrchestratorResult[]> {
    try {
      return await this.linkedinQueryGenerationService.generateSearchQuerySetBatch(
        body.requirements,
        {
          verbose: body.verbose,
          parallel: body.parallel,
          queryIpLocation: body.queryIpLocation,
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Batch query set generation failed', error.stack || error);
      throw new HttpException(
        error.message || 'Batch query set generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate')
  validate(@Body() body: ValidateQuerySetDto): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    return this.linkedinQueryGenerationService.validateQuerySet(body.querySet);
  }
}
