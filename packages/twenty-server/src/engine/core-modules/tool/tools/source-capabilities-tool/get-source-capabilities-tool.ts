import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import {
  buildSourceCapabilities,
  parseRangeHint,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/source-capabilities.util';
import { SOURCING_SOURCES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const SOURCE_KEYS = SOURCING_SOURCES.map((source) => source.key) as [
  string,
  ...string[],
];

export const GetSourceCapabilitiesInputZodSchema = z.object({
  sources: z
    .array(z.enum(SOURCE_KEYS))
    .optional()
    .describe(
      'The data sources the user picked for this run, as their keys (bright-data, serp, linkedin, harvest, internal-index, google-maps, naukri, apollo, exa, wikidata). Omit before the source question to see what every source can filter.',
    ),
  entity: z
    .enum(['company', 'person', 'both'])
    .optional()
    .describe('What the lookup is about; both when you need the whole map'),
  want: z
    .array(z.string().min(1).max(40))
    .max(6)
    .optional()
    .describe(
      'The parameters the user actually named, in canonical words: employees, annualRevenue, industry, hqLocation, keywords, departmentHeadcount, hiring, currentTitle, currentCompany, companyHeadcount, location, seniority, function, yearsExperience. A field no picked source has comes back under notSearchable with the nearest stand-in.',
    ),
  term: z
    .string()
    .max(160)
    .optional()
    .describe(
      'The segment or industry in the user\'s words ("retail stores", "chemical manufacturers"), so the industry question offers the exact LinkedIn labels',
    ),
  rawQuery: z
    .string()
    .max(400)
    .optional()
    .describe(
      'The request in the user\'s words, so a number in it ("Rs 800 Cr", "5,000 employees") comes back as a range hint for the size question',
    ),
});

@Injectable()
export class GetSourceCapabilitiesTool implements Tool {
  description = `What the picked data sources can actually be filtered on, per entity, and what each returns. Costs nothing and calls no provider. Use it before the plan questions: pass the sources the user picked, the entity, and the parameters the user named (employees, annualRevenue, industry, location, currentTitle, ...). It returns which picked source has each field and its allowed values, the fields none of them has with the nearest stand-in and the source that would have it (Bright Data has employee count, not revenue; Sales Navigator has revenue), the fields a row carries into another source (a company LinkedIn URL from Bright Data is a Harvest input), and ready-to-send question scaffolds with the exact options and a free-text hint. Ask the user with ask_questions using those options, then record the answers in the brief.`;
  inputSchema = GetSourceCapabilitiesInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = GetSourceCapabilitiesInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid get_source_capabilities input',
        error: parsed.error.message,
      };
    }

    const { sources, entity, want, term, rawQuery } = parsed.data;
    const capabilities = buildSourceCapabilities({
      ...(sources !== undefined && { sources }),
      ...(entity !== undefined && {
        entity: entity === 'both' ? undefined : entity,
      }),
      ...(want !== undefined && { want }),
      ...(term !== undefined && { term }),
    });
    const rangeHint =
      rawQuery === undefined ? undefined : parseRangeHint(rawQuery);

    return {
      success: true,
      message: `${capabilities.searchable.length} searchable field(s) across ${capabilities.sources.length} source/entity pair(s); ${capabilities.notSearchable.length} requested field(s) no picked source has; ${capabilities.questions.length} question(s) ready.`,
      result: {
        ...capabilities,
        ...(rangeHint !== undefined && { rangeHint }),
      },
    };
  }
}
