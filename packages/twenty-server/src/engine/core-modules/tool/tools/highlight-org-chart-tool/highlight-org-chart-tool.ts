import { Injectable } from '@nestjs/common';

import { type HighlightOrgChartToolOutput } from 'twenty-shared/ai';

import {
  type HighlightOrgChartInput,
  HighlightOrgChartInputZodSchema,
} from 'src/engine/core-modules/tool/tools/highlight-org-chart-tool/highlight-org-chart-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class HighlightOrgChartTool implements Tool {
  description = `Highlight matching nodes on the org chart currently open in Ask AI.
    Call this after resolving 1–3 search words (headlines, names, titles) or taxonomy labels.
    Use clear: true to reset highlights. Does not navigate away from the open chart.`;

  inputSchema = HighlightOrgChartInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput<HighlightOrgChartToolOutput>> {
    const parseResult = HighlightOrgChartInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid org chart highlight input',
        error: parseResult.error.message,
      };
    }

    const input: HighlightOrgChartInput = parseResult.data;

    if (input.clear === true) {
      return {
        success: true,
        message: 'Clear highlights on the open org chart',
        result: {
          action: 'clear',
          searchTerms: [],
        },
      };
    }

    const searchTerms = input.searchTerms ?? [];
    const result: HighlightOrgChartToolOutput = {
      action: 'applySearch',
      searchTerms,
      ...(input.stdFunction ? { stdFunction: input.stdFunction } : {}),
      ...(input.stdFunctionRoot
        ? { stdFunctionRoot: input.stdFunctionRoot }
        : {}),
      ...(input.stdGrade ? { stdGrade: input.stdGrade } : {}),
      ...(input.nodeKeys && input.nodeKeys.length > 0
        ? { nodeKeys: input.nodeKeys }
        : {}),
    };

    const summary =
      searchTerms.length > 0
        ? searchTerms.join(', ')
        : input.nodeKeys && input.nodeKeys.length > 0
          ? `${input.nodeKeys.length} node keys`
          : (input.stdFunction ?? input.stdFunctionRoot ?? 'taxonomy filter');

    return {
      success: true,
      message: `Highlight org chart for ${summary}`,
      result,
    };
  }
}
