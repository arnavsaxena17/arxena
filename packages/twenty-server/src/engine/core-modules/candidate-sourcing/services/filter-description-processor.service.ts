import { Injectable, Logger } from '@nestjs/common';
import { Sema } from 'async-sema';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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

export type FilterField = z.infer<typeof FilterFieldSchema>;
export type AIFilterModel = z.infer<typeof AIFilterModelSchema>;

@Injectable()
export class FilterDescriptionProcessorService {
  private readonly logger = new Logger(FilterDescriptionProcessorService.name);
  private openai: OpenAI;
  private semaphore: Sema;

  constructor() {
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
  async generateSingleFilter(filterDescription: string): Promise<AIFilterModel> {
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
          const completion = await this.openai.chat.completions.parse({
            model: 'gpt-4o-mini',
            messages,
            response_format: zodResponseFormat(AIFilterModelSchema, 'ai_filter_model'),
            // max_tokens: 2000,
            temperature: 0,
          });

          // With Structured Outputs, the response is already parsed and validated
          const message = completion.choices[0]?.message;
          
          // Check if the model refused to fulfill the request
          if (message?.refusal) {
            throw new Error(`Model refused to fulfill request: ${message.refusal}`);
          }
          
          const result = message?.parsed;
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
