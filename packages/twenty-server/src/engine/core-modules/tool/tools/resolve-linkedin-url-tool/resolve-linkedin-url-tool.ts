import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { LinkedinProfileResolverService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/linkedin-profile-resolver.service';
import {
  ResolveLinkedinUrlToolInputZodSchema,
  type ResolveLinkedinUrlToolInput,
} from 'src/engine/core-modules/tool/tools/resolve-linkedin-url-tool/types/resolve-linkedin-url-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class ResolveLinkedinUrlTool implements Tool {
  private readonly logger = new Logger(ResolveLinkedinUrlTool.name);

  constructor(
    private readonly linkedinProfileResolverService: LinkedinProfileResolverService,
  ) {}

  description =
    'Resolve a person to their LinkedIn URL from a name and company (optionally a title). Use it for rows that only have a name, or when a snapshot has no LinkedIn URL. Returns candidate profiles with linkedinUrl, title, companyName, relation (current / past / unknown), via (bright_data / google) and evidence; it does NOT fetch the full profile. Prefer a current-relation candidate; a past candidate is an alumnus, not the current role holder, so do not present one as the current contact without saying so.';
  inputSchema = ResolveLinkedinUrlToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = ResolveLinkedinUrlToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to resolve LinkedIn URL',
        error: parsed.error.message,
      };
    }

    const input = parsed.data as ResolveLinkedinUrlToolInput;
    const companies = [
      input.company,
      ...(Array.isArray(input.alternateCompanies) ? input.alternateCompanies : []),
    ]
      .map((company) => company.trim())
      .filter(isNonEmptyString);

    if (companies.length === 0) {
      return {
        success: false,
        message: 'Failed to resolve LinkedIn URL',
        error: 'company is required',
      };
    }

    try {
      const { profiles, spentUsd, errors } =
        await this.linkedinProfileResolverService.resolve({
          name: input.name,
          companyNames: companies,
          title: input.title,
        });
      const current = profiles.filter(
        (profile) => profile.companyRelation !== 'past',
      );
      const best = current[0] ?? profiles[0];

      return {
        success: true,
        message:
          profiles.length === 0
            ? `No LinkedIn profile found for ${input.name} at ${companies[0]}`
            : `Found ${profiles.length} LinkedIn candidate(s) for ${input.name} at ${companies[0]}; ${current.length} current/unknown, ${profiles.length - current.length} past`,
        result: {
          name: input.name,
          company: companies[0],
          title: input.title ?? '',
          bestLinkedinUrl: best?.linkedinUrl ?? '',
          currentCount: current.length,
          pastCount: profiles.length - current.length,
          spendUsd: Math.round(spentUsd * 10000) / 10000,
          candidates: profiles.map((profile) => ({
            linkedinUrl: profile.linkedinUrl,
            title: profile.title,
            companyName: profile.companyName,
            relation: profile.companyRelation,
            via: profile.via,
            evidence: profile.evidence,
            sameNameProfileCount: profile.sameNameProfileCount,
            derivedFromPost: profile.derivedFromPost,
          })),
          errors,
        },
      };
    } catch (error) {
      this.logger.error('Resolve LinkedIn URL failed', error);

      return {
        success: false,
        message: 'Failed to resolve LinkedIn URL',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
