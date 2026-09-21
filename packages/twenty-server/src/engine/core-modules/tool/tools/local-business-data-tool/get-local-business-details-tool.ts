import { Injectable, Logger } from '@nestjs/common';

import { LocalBusinessDataService } from 'src/engine/core-modules/local-business-data/local-business-data.service';
import { GetLocalBusinessDetailsToolInputZodSchema } from 'src/engine/core-modules/tool/tools/local-business-data-tool/types/get-local-business-details-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class GetLocalBusinessDetailsTool implements Tool {
  private readonly logger = new Logger(GetLocalBusinessDetailsTool.name);

  constructor(
    private readonly localBusinessDataService: LocalBusinessDataService,
  ) {}

  description =
    'Get full Google Maps business details (optionally emails and social contacts) by business id. Supports batching up to 20 ids.';
  inputSchema = GetLocalBusinessDetailsToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      GetLocalBusinessDetailsToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to get local business details',
        error: parsed.error.message,
      };
    }

    const input = parsed.data;

    try {
      const businesses = await this.localBusinessDataService.getBusinessDetails(
        {
          businessIds: input.businessIds,
          extractEmailsAndContacts: input.extractEmailsAndContacts,
          extractShareLink: input.extractShareLink,
          language: input.language,
          region: input.region,
          fields: input.fields,
        },
      );

      return {
        success: true,
        message: `Fetched details for ${businesses.length} businesses`,
        result: {
          businesses,
          count: businesses.length,
        },
      };
    } catch (error) {
      this.logger.error('Get local business details failed', error);

      return {
        success: false,
        message: 'Failed to get local business details',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
