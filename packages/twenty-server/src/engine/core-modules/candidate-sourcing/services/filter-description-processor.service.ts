import { Injectable, Logger } from '@nestjs/common';
import { Sema } from 'async-sema';
import OpenAI from 'openai';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import { MeteredLlmService } from 'src/engine/core-modules/metered-llm/metered-llm.service';
import { z } from 'zod';

// Available input fields that candidates can have
const AVAILABLE_FIELDS = [
  'first_name',
  'last_name', 
  'full_name',
  'job_company_name',
  'location_name',
  'jobTitle',
  'profile_title',
  'inferred_salary',
  'inferred_years_experience',
  'uniqueStringKey',
  'email_address',
  'industries',
  'profiles',
  'phone_numbers',
  'job_process',
  'locations',
  'experience',
  'experience_stats',
  'last_updated',
  'education',
  'interests',
  'skills',
  'data_sources',
  'queryId',
  'profile_url',
  'all_numbers',
  'data_source',
  'job_name',
  'upload_id',
  'all_mails',
  'ug_education_institute',
  'ug_degree',
  'socialprofiles',
  'tables',
  'std_function',
  'std_grade',
  'std_function_root',
];

// Zod schemas for structured response
const FilterFieldSchema = z.object({
  name: z.string().describe('Field name'),
  type: z.enum(['text', 'number', 'boolean', 'enum']).describe('Field data type'),
  description: z.string().describe('Description of what this field represents'),
  enumValues: z.array(z.string()).describe('Enum values if type is enum (empty array for non-enum types)'),
});

const AIFilterModelSchema = z.object({
  fields: z.array(FilterFieldSchema).describe('List of fields for this AI filter that will be created in the spreadsheet'),
  modelName: z.string().describe('Name of the AI filter model in PascalCase'),
  prompt: z.string().describe('Prompt for the AI model that describes the task to be performed on a single candidate'),
  selectedMetadataFields: z.array(z.string()).describe('List of input fields/columns on spreadsheet that will be used to execute this filter'),
});

// Column design for the Outreach tables (Ask AI): the same kind of structured
// LLM call, with the Outreach row fields and the numeric types a table needs.
const OUTREACH_COLUMN_INPUT_FIELDS = {
  person: ['name', 'jobTitle', 'headline', 'companyName', 'location'],
  company: ['name', 'domain', 'industry', 'employees'],
} as const;

const ColumnFieldSchema = z.object({
  name: z.string().describe('Column key in camelCase, unique, e.g. companyRevenueUsd'),
  type: z
    .enum(['text', 'number', 'integer', 'boolean', 'enum'])
    .describe('Column data type'),
  description: z
    .string()
    .describe('What the column holds, including the unit for numbers'),
  enumValues: z
    .array(z.string())
    .describe('Ordered, mutually exclusive values if type is enum, else an empty array'),
});

const ColumnDesignSchema = z.object({
  columnName: z.string().describe('Short header label for the table, Title Case'),
  fields: z.array(ColumnFieldSchema).describe('One or two output columns'),
  prompt: z
    .string()
    .describe('Instruction for the model that fills the columns for ONE row'),
  selectedMetadataFields: z
    .array(z.string())
    .describe('Row fields the model needs, chosen from the available list'),
  needsWebSearch: z
    .boolean()
    .describe('True when the answer is a fact that is not in the row fields'),
});

export type OutreachColumnDesign = z.infer<typeof ColumnDesignSchema>;

// View design: turns "show only CEOs, biggest companies first" into table
// filters and a sort over the columns that exist. Strict structured output has
// no optional keys, so "none" is an empty string.
const TableViewFilterSchema = z.object({
  columnId: z.string().describe('columnId from the available columns'),
  operator: z
    .enum([
      'in',
      'equals',
      'contains',
      'notContains',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'isEmpty',
      'isNotEmpty',
    ])
    .describe('Comparison to apply'),
  values: z
    .array(z.string())
    .describe(
      'For in: every value to keep. For the other operators: one value (a plain number for numeric comparisons). Empty for isEmpty / isNotEmpty.',
    ),
});

const TableViewDesignSchema = z.object({
  needsFilter: z
    .boolean()
    .describe('True only when the request asks to narrow down the rows'),
  needsSort: z
    .boolean()
    .describe('True only when the request asks for an order or a ranking'),
  filters: z.array(TableViewFilterSchema),
  sortColumnId: z.string().describe('columnId to sort by, or an empty string'),
  sortDirection: z.enum(['asc', 'desc']),
  summary: z
    .string()
    .describe('One short sentence describing the filters and sort, for the user'),
  unmatched: z
    .string()
    .describe(
      'What part of the request cannot be done because no available column fits (for example "no revenue column"), else an empty string',
    ),
});

export type OutreachTableViewColumnInfo = {
  columnId: string;
  label: string;
  type: string;
  values?: string[];
};

export type OutreachTableViewDesign = z.infer<typeof TableViewDesignSchema>;

export type FilterField = z.infer<typeof FilterFieldSchema>;
export type AIFilterModel = z.infer<typeof AIFilterModelSchema>;

@Injectable()
export class FilterDescriptionProcessorService {
  private readonly logger = new Logger(FilterDescriptionProcessorService.name);
  private openai: OpenAI;
  private semaphore: Sema;

  constructor(private readonly meteredLlmService: MeteredLlmService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
    // Initialize semaphore for filter processing (limit to 5 concurrent requests)
    this.semaphore = new Sema(5);
  }

  /**
   * Generate AI filter configuration from a description
   * @param filterDescription Description of what the AI filter should do
   * @returns Complete configuration for the AI filter
   */
  async generateSingleFilter(
    filterDescription: string,
    workspaceId: string,
  ): Promise<AIFilterModel> {
    await this.semaphore.acquire();
    
    try {
      this.logger.log(`Processing filter description: ${filterDescription}`);

      if (!filterDescription || filterDescription.trim().length === 0) {
        throw new Error('Filter description cannot be empty');
      }

      const availableFieldsStr = AVAILABLE_FIELDS
        .map((field, index) => `${index + 1}. ${field}`)
        .join('\n');

      const systemPrompt = `You are an AI system that creates filter configurations for candidate screening.

Available input fields:
${availableFieldsStr}

The user has a list of candidate data in a spreadsheet. They have the above fields and have given you a filter description. Analyse the filter description and create fields/ new columns in the spreadsheet and a prompt for the AI model that will be used to execute the task.
1. A descriptive modelName (PascalCase, no spaces)
2. A prompt for the AI model that describes the task to be performed on a single candidate (eg. Does this candidate .... or Classify this candidate into .... or This candidate's info is ....)
3. Output fields are the columns that will be created in the spreadsheet. Create them with appropriate types. For descriptive tasks, create a text field. For yes/no tasks, create a boolean field. For numeric tasks, create a number field. For classification tasks, create an enum field
4. You will be given input fields from the candidate profile fields. Choose only the  most relevant input fields (selectedMetadataFields) from the available list that are needed to perform the task
5. Proper field descriptions for each output field that will help the model understand how the field has to be created

Guidelines:
- Use descriptive field names in camelCase
- Choose appropriate data types (text for descriptive fields, boolean for yes/no, number for numeric values, enum for classification tasks)
- Select only the most relevant input fields needed for the task. The fewer you choose, the better
- Write clear, specific prompts that will produce consistent results across any candidate profile
- Include enumValues array for enum types, empty array for others (eg. ['Yes', 'No'] or ["Sales", "Marketing", "Finance", "Legal"], etc.). Always provide an array, even if empty.`;

      const userPrompt = `AI Filter Description: ${filterDescription}`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];

      this.logger.log('Sending messages to OpenAI for filter description processing');

      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const completion = await this.meteredLlmService.openAiChatCompletion(
            { workspaceId, feature: 'FILTER_DESCRIPTION', keySource: 'platform' },
            this.openai,
            {
              model: 'gpt-4o-mini',
              messages,
              response_format: toOpenAiJsonSchemaResponseFormat(AIFilterModelSchema, 'ai_filter_model'),
              temperature: 0,
            },
          );

          const message = completion.choices[0]?.message;

          // Check if the model refused to fulfill the request
          if (message?.refusal) {
            throw new Error(`Model refused to fulfill request: ${message.refusal}`);
          }

          // The installed SDK has no chat.completions.parse; validate with zod.
          const result = AIFilterModelSchema.parse(
            JSON.parse(message?.content ?? '{}'),
          );
          if (!result) {
            throw new Error('Empty or invalid response from OpenAI');
          }

          // Validate the result
          if (!result.modelName || result.modelName.trim().length === 0) {
            throw new Error('Generated model name is empty');
          }
          
          if (!result.prompt || result.prompt.trim().length === 0) {
            throw new Error('Generated prompt is empty');
          }
          
          if (!result.fields || result.fields.length === 0) {
            throw new Error('No output fields generated');
          }
          
          if (!result.selectedMetadataFields || result.selectedMetadataFields.length === 0) {
            throw new Error('No input fields selected');
          }

          // Validate selectedMetadataFields against available fields
          const validFields = this.validateSelectedFields(result.selectedMetadataFields);
          if (validFields.length === 0) {
            throw new Error('No valid input fields selected');
          }
          
          result.selectedMetadataFields = validFields;

          this.logger.log(`Generated filter configuration: ${JSON.stringify(result)}`);
          return result;
        } catch (error) {
          this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);
          lastError = error;
          
          if (attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }

      throw lastError || new Error('Failed to generate filter configuration after multiple attempts');
    } catch (error) {
      this.logger.error(`Error generating filter configuration: ${error.message}`, error.stack);
      throw new Error(`Failed to process filter description: ${error.message}`);
    } finally {
      this.semaphore.release();
    }
  }

  async designColumn({
    description,
    subject,
    workspaceId,
  }: {
    description: string;
    subject: 'person' | 'company';
    workspaceId: string;
  }): Promise<OutreachColumnDesign> {
    if (description.trim().length === 0) {
      throw new Error('Column description cannot be empty');
    }

    const availableFields = [...OUTREACH_COLUMN_INPUT_FIELDS[subject]];
    const systemPrompt = `You design one new column (or a few related columns) for a table of ${subject === 'person' ? 'people' : 'companies'} from a user's request.

Available row fields: ${availableFields.join(', ')}.

Choose each output column's data type carefully, because the table sorts and filters by it:
- yes/no question -> boolean
- a count (employees, years, number of offices) -> integer
- money, revenue, funding, a ratio or a score -> number. State the unit in the field name and description (e.g. companyRevenueUsd = full USD amount, 120000000 not "$120M")
- a fixed set of labels, or buckets/ranges the user asked for (size band, seniority, region) -> enum with 3 to 8 ordered, mutually exclusive values (range values like "1-50", "51-200", "201-1000", "1000+")
- text only for explanations, names or links that cannot be structured. Never use text for something that is really a number, a yes/no or a set of labels.
When the user does not say, prefer the most filterable type: a number or integer for quantities, an enum for categories.
Output only the requested values. Never add a column that repeats a row field (name, company name, job title, domain): the table already shows those. When the answer is a web fact, you may add ONE extra text field for the source URL, named <key>Source. Keep it to at most two fields.

Set needsWebSearch=true when the answer is a fact that is not in the row fields (revenue, employees, funding, news, headquarters) and false when it can be decided from the row fields (job title, seniority, department, industry).
The rows are ${subject === 'person' ? 'people on the People tab. A question about their company (revenue, headcount, industry) is still a column on the person: describe it as the person\'s employer and include companyName in selectedMetadataFields' : 'companies'}.
Write the prompt for ONE row, in plain language, with the unit and format for each field. Choose only the row fields that are needed.`;

    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // chat.completions.create + manual zod parse: the installed SDK has no
        // chat.completions.parse (it lives under beta there).
        const completion = await this.meteredLlmService.openAiChatCompletion(
          { workspaceId, feature: 'FILTER_DESCRIPTION', keySource: 'platform' },
          this.openai,
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: `Request: ${description}` },
            ],
            response_format: toOpenAiJsonSchemaResponseFormat(
              ColumnDesignSchema,
              'outreach_column_design',
            ),
            temperature: 0,
          },
        );
        const message = completion.choices[0]?.message;

        if (message?.refusal) {
          throw new Error(`Model refused to design the column: ${message.refusal}`);
        }

        const design = ColumnDesignSchema.parse(
          JSON.parse(message?.content ?? '{}'),
        );

        if (design.fields.length === 0) {
          throw new Error('Empty column design from OpenAI');
        }

        const metadataFields = design.selectedMetadataFields.filter((field: string) =>
          (availableFields as string[]).includes(field),
        );

        return {
          ...design,
          fields: design.fields.slice(0, 2),
          selectedMetadataFields:
            metadataFields.length > 0 ? metadataFields : availableFields,
        };
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;

        if (code === 'insufficient_quota' || code === 'credit_balance_exhausted') {
          throw new Error(
            'OpenAI credits are exhausted (credit_balance_exhausted). Top up the OpenAI account and try again.',
          );
        }

        lastError = error;
        this.logger.warn(
          `Column design attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to design the column');
  }

  async designTableView({
    description,
    columns,
    workspaceId,
  }: {
    description: string;
    columns: OutreachTableViewColumnInfo[];
    workspaceId: string;
  }): Promise<OutreachTableViewDesign> {
    if (description.trim().length === 0) {
      throw new Error('View description cannot be empty');
    }

    const columnList = columns
      .map(
        (column) =>
          `- ${column.columnId} | ${column.label} | ${column.type}${
            column.values && column.values.length > 0
              ? ` | values: ${column.values.join(', ')}`
              : ''
          }`,
      )
      .join('\n');
    const systemPrompt = `You turn a user's request into filters and a sort for a table, using only the available columns (columnId | label | type | values).

Available columns:
${columnList}

Rules:
- Decide first whether a filter is needed and whether a sort is needed. A request to add or compute a column, or to ask a question about the data ("what is", "how many", "number of", "revenue of each"), needs neither. Words like "only", "filter", "show", "keep", "who is", "which are", "over", "under", "at least" call for a filter. Words like "sort", "order", "rank", "top", "largest", "smallest", "highest", "lowest" call for a sort. Set needsFilter and needsSort to false and leave the rest empty when neither is asked for.
- Use only columnIds from the list. If the request needs a column that is not listed, do not invent one: leave that part out and say so in the summary.
- boolean columns hold the values Yes and No: use operator in with ["Yes"] or ["No"].
- enum and label columns: use operator in with the exact listed values that match the request.
- number and integer columns: use greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual or equals with a plain number (no commas, no units; 1m = 1000000).
- text columns: use contains / notContains with a word from the request. Never use equals on text: cells hold longer strings (a location is "Dubai, Dubai, United Arab Emirates", a title is "Group MD and CEO at ...").
- Prefer a boolean, enum or number column over a text column when it covers the request (for example a Region or Seniority column over matching words in Location or Job title).
- "largest", "highest", "top" sort desc; "smallest", "lowest", "fewest" sort asc. Sort only by one column.
- Never filter or sort on a column the user did not ask about.
Write the summary as one short sentence, for example "Is CEO is Yes, Company employee count over 500, sorted by employee count, highest first".`;

    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.meteredLlmService.openAiChatCompletion(
          { workspaceId, feature: 'FILTER_DESCRIPTION', keySource: 'platform' },
          this.openai,
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: `Request: ${description}` },
            ],
            response_format: toOpenAiJsonSchemaResponseFormat(
              TableViewDesignSchema,
              'outreach_table_view_design',
            ),
            temperature: 0,
          },
        );
        const message = completion.choices[0]?.message;

        if (message?.refusal) {
          throw new Error(`Model refused to design the view: ${message.refusal}`);
        }

        return TableViewDesignSchema.parse(JSON.parse(message?.content ?? '{}'));
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;

        if (code === 'insufficient_quota' || code === 'credit_balance_exhausted') {
          throw new Error(
            'OpenAI credits are exhausted (credit_balance_exhausted). Top up the OpenAI account and try again.',
          );
        }

        lastError = error;

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to design the table view');
  }

  /**
   * Validate that selected metadata fields exist in available fields
   * @param selectedFields Array of field names to validate
   * @returns Array of valid field names
   */
  validateSelectedFields(selectedFields: string[]): string[] {
    return selectedFields.filter(field => AVAILABLE_FIELDS.includes(field));
  }

  /**
   * Get the list of available fields
   * @returns Array of available field names
   */
  getAvailableFields(): string[] {
    return [...AVAILABLE_FIELDS];
  }
}
