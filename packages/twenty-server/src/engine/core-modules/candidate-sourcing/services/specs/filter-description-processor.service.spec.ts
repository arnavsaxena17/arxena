import { Test, TestingModule } from '@nestjs/testing';
import { FilterDescriptionProcessorService } from '../filter-description-processor.service';

describe('FilterDescriptionProcessorService', () => {
  let service: FilterDescriptionProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilterDescriptionProcessorService],
    }).compile();

    service = module.get<FilterDescriptionProcessorService>(FilterDescriptionProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get available fields', () => {
    const fields = service.getAvailableFields();
    expect(fields).toBeDefined();
    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBeGreaterThan(0);
  });

  it('should validate selected fields', () => {
    const validFields = ['first_name', 'last_name', 'email_address'];
    const invalidFields = ['invalid_field', 'another_invalid'];
    const mixedFields = [...validFields, ...invalidFields];

    const result = service.validateSelectedFields(mixedFields);
    expect(result).toEqual(validFields);
  });

  it('should handle empty filter description', async () => {
    await expect(service.generateSingleFilter('')).rejects.toThrow('Filter description cannot be empty');
  });

  it('should handle whitespace-only filter description', async () => {
    await expect(service.generateSingleFilter('   ')).rejects.toThrow('Filter description cannot be empty');
  });

  // Note: Integration tests with OpenAI API would require API key and network access
  // These are skipped in unit tests to avoid external dependencies
  it.skip('should generate valid filter configuration with real API call', async () => {
    // This test would require OPENAI_KEY environment variable
    const result = await service.generateSingleFilter('Which of these people are north indians?');
    expect(result).toBeDefined();
    expect(result.modelName).toBeDefined();
    expect(result.prompt).toBeDefined();
    expect(result.fields).toBeDefined();
    expect(result.selectedMetadataFields).toBeDefined();
  });
});
