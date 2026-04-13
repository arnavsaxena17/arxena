import { searchIntentRouteSchema } from '../search-intent-route.schema';

describe('searchIntentRouteSchema', () => {
  it('parses open_market', () => {
    const r = searchIntentRouteSchema.parse({
      intent: 'open_market',
      primary_employer_name: null,
    });
    expect(r.intent).toBe('open_market');
    expect(r.primary_employer_name).toBeNull();
    console.log('[search-intent-route.schema] open_market OK');
  });

  it('parses employer_scoped with employer name', () => {
    const r = searchIntentRouteSchema.parse({
      intent: 'employer_scoped',
      primary_employer_name: 'Tata Motors',
      rationale: 'Named company',
    });
    expect(r.intent).toBe('employer_scoped');
    expect(r.primary_employer_name).toBe('Tata Motors');
    console.log('[search-intent-route.schema] employer_scoped OK');
  });
});
