import { buildBrightDataLudicrousPlannerSystemPrompt } from 'src/engine/core-modules/bright-data/ludicrous/prompts/bright-data-ludicrous-planner.prompt';

describe('buildBrightDataLudicrousPlannerSystemPrompt', () => {
  it('should list company filter fields and omit people-only keys', () => {
    const prompt = buildBrightDataLudicrousPlannerSystemPrompt('company');

    expect(prompt).toContain(
      'offices_country_codes (array of strings, operator in)',
    );
    expect(prompt).toContain('company_size_from (integer, operator equals)');
    expect(prompt).toContain('about and specialties (text, operator text');
    expect(prompt).toContain('Leave empty: titles');
    expect(prompt).toContain('employees_in_linkedin');
    expect(prompt).not.toContain('current_title (text');
  });

  it('should list people filter fields and omit company-only keys', () => {
    const prompt = buildBrightDataLudicrousPlannerSystemPrompt('people');

    expect(prompt).toContain('current_title (text, operator text');
    expect(prompt).toContain('current_company_name (text, operator text)');
    expect(prompt).toContain('Leave empty: organizationTypes');
    expect(prompt).toContain('past_job_titles');
    expect(prompt).not.toContain('offices_country_codes');
    expect(prompt).not.toContain('specialtiesAny →');
  });
});
