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
} from 'src/domains/discovery/query/linkedin-query-generation/dto/linkedin-query-generation.dto';
import { LinkedinQueryGenerationService } from 'src/domains/discovery/query/linkedin-query-generation/services/linkedin-query-generation.service';
import {
  OrchestratorResult,
  ParsedRequirement,
} from 'src/domains/discovery/query/linkedin-query-generation/types/linkedin-query-generation.types';

@Controller('linkedin-query-generation')
export class LinkedinQueryGenerationController {
  private readonly logger = new Logger(LinkedinQueryGenerationController.name);

  constructor(
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
  ) {}

  @Post('agent1/parse')
  async runAgent1(@Body() body: RunAgent1Dto): Promise<ParsedRequirement> {
    try {
      return await this.linkedinQueryGenerationService.runAgent1(
        body.rawRequirement,
        {
          queryIpLocation: body.queryIpLocation,
          model: body.model,
          temperature: body.temperature,
        },
      );
    } catch (error) {
      this.logger.error('Agent 1 parsing failed', error.stack || error);
      throw new HttpException(
        error.message || 'Agent 1 parsing failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate')
  async generate(
    @Body() body: GenerateQuerySetDto,
  ): Promise<OrchestratorResult> {
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
      this.logger.error(
        'Batch query set generation failed',
        error.stack || error,
      );
      throw new HttpException(
        error.message || 'Batch query set generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
