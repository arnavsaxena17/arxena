import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { CompanyNameResolverService } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import {
  ResolveCompanyFromRawNameToolInputZodSchema,
  type ResolveCompanyFromRawNameToolInput,
} from 'src/engine/core-modules/tool/tools/company-name-resolver-tool/types/resolve-company-from-raw-name-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class ResolveCompanyFromRawNameTool implements Tool {
  private readonly logger = new Logger(ResolveCompanyFromRawNameTool.name);

  constructor(
    private readonly companyNameResolverService: CompanyNameResolverService,
  ) {}

  description =
    'Resolve a raw / messy company name to a standardized company profile from the std_company_data_scores Elasticsearch index (name, id, website, LinkedIn URL, headcount).';
  inputSchema = ResolveCompanyFromRawNameToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      ResolveCompanyFromRawNameToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to resolve company from raw name',
        error: parsed.error.message,
      };
    }

    if (!this.companyNameResolverService.isEnabled()) {
      return {
        success: false,
        message: 'Failed to resolve company from raw name',
        error: 'Company name resolver is not configured (set ES_ENDPOINT)',
      };
    }

    const input = parsed.data as ResolveCompanyFromRawNameToolInput;
    const companyNames = [
      ...(Array.isArray(input.companyNames) ? input.companyNames : []),
      ...(isNonEmptyString(input.companyName) ? [input.companyName] : []),
    ]
      .map((name) => name.trim())
      .filter(isNonEmptyString);

    if (companyNames.length === 0) {
      return {
        success: false,
        message: 'Failed to resolve company from raw name',
        error: 'companyName or companyNames is required',
      };
    }

    try {
      const results =
        companyNames.length === 1
          ? [
              await this.companyNameResolverService.resolveFromRawCompanyName(
                companyNames[0],
              ),
            ]
          : await this.companyNameResolverService.resolveMany(companyNames);

      const resolvedCount = results.filter((result) => result.resolved).length;

      return {
        success: true,
        message: `Resolved ${resolvedCount}/${results.length} company name(s)`,
        result: {
          index: this.companyNameResolverService.getIndexName(),
          count: results.length,
          resolvedCount,
          results,
        },
      };
    } catch (error) {
      this.logger.error('Resolve company from raw name failed', error);

      return {
        success: false,
        message: 'Failed to resolve company from raw name',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
