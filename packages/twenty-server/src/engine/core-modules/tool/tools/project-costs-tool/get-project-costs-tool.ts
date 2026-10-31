import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const GetProjectCostsInputZodSchema = z.object({
  projectId: z
    .string()
    .uuid()
    .optional()
    .describe('Project to price. Defaults to the project the user has open.'),
  sinceDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('How many days back to count. Default 30.'),
});

@Injectable()
export class GetProjectCostsTool implements Tool {
  description =
    'Price the data requests already run for one project, from the request ledger rather than an estimate. Returns the total charged and provider cost, the split by request type (SERP query, AI Overview, Bright Data search page, profile scrape, Harvest lead page, Harvest profile, company index request, Unipile request), the split by step, and the cache-hit and failed counts. Use it when the user asks what a project or a run has cost, or before proposing a budget for more work. Cached and failed requests are counted but not priced, because the provider does not bill them; requests with no catalog rate are listed separately and are not in the total.';
  inputSchema = GetProjectCostsInputZodSchema;

  constructor(
    private readonly providerCallLogService: ProviderCallLogService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const projectId =
      typeof parameters.projectId === 'string' && parameters.projectId !== ''
        ? parameters.projectId
        : context.projectId;

    if (projectId === undefined || projectId === '') {
      return {
        success: false,
        message:
          'Which project should I price? Pass projectId, or open a project first.',
        error: 'projectId is required',
      };
    }

    const sinceDays =
      typeof parameters.sinceDays === 'number' ? parameters.sinceDays : 30;

    const report = await this.providerCallLogService.getProjectCost({
      workspaceId: context.workspaceId,
      projectId,
      sinceDays,
    });

    const perRequestUsd =
      report.billableRequests > 0
        ? report.chargedUsd / report.billableRequests
        : 0;

    const split =
      report.byMeter.length > 0
        ? report.byMeter
            .slice(0, 5)
            .map(
              (line) =>
                `${line.meterId} $${line.chargedUsd.toFixed(4)} (${line.billableRequests})`,
            )
            .join(', ')
        : 'no billable requests';

    const unratedRequests = report.unrated.reduce(
      (total, entry) => total + entry.requests,
      0,
    );

    const warnings: string[] = [];

    if (unratedRequests > 0) {
      warnings.push(
        `${unratedRequests} billable request(s) have no rate in the pricing catalog and are excluded from the total: ${report.unrated
          .map((entry) => `${entry.provider}:${entry.operation}`)
          .join(', ')}`,
      );
    }

    const empty = report.requests === 0;

    return {
      success: true,
      message: empty
        ? `No provider requests recorded for project ${projectId} in the last ${sinceDays} days.`
        : `Project ${projectId} cost $${report.chargedUsd.toFixed(4)} over the last ${sinceDays} days ($${report.providerCostUsd.toFixed(4)} at provider cost) across ${report.requests} requests: ${report.billableRequests} billable at $${perRequestUsd.toFixed(4)} each, ${report.cacheHits} served from cache, ${report.failedRequests} failed. By request type: ${split}.`,
      result: report,
      ...(warnings.length > 0 && { warnings }),
    };
  }
}
