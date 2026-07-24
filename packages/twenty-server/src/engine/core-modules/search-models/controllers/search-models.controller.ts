import { Body, Controller, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';

import { EvaluateShortlistDto } from '../dto/evaluate-shortlist.dto';
import { SearchModelsService } from '../services/search-models.service';
import {
  CandidateShortlistWorkflowResult,
  StrategyRubricWorkflowResult,
} from '../types/search-models.types';

@Controller('search-models')
export class SearchModelsController {
  private readonly logger = new Logger(SearchModelsController.name);

  constructor(private readonly searchModelsService: SearchModelsService) {}

  @Post('shortlist')
  async evaluateShortlist(
    @Body() body: EvaluateShortlistDto,
  ): Promise<CandidateShortlistWorkflowResult> {
    try {
      return await this.searchModelsService.evaluateCandidateShortlist(body);
    } catch (error) {
      this.logger.error('Failed to evaluate shortlist request', error.stack || error);
      throw new HttpException(
        error.message || 'Failed to evaluate shortlist request',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('strategy-rubrics')
  async evaluateStrategyRubrics(
    @Body() body: EvaluateShortlistDto,
  ): Promise<StrategyRubricWorkflowResult> {
    try {
      console.log('Evaluating strategy rubrics', JSON.stringify(body, null, 2));
      return await this.searchModelsService.evaluateStrategyRubrics(body);
    } catch (error) {
      this.logger.error('Failed to evaluate strategy rubric request', error.stack || error);
      throw new HttpException(
        error.message || 'Failed to evaluate strategy rubric request',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


