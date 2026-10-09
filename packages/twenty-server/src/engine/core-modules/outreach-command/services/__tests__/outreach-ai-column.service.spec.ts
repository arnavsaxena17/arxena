import { buildRecordText } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';
import { toRecordForModel } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

describe('toRecordForModel', () => {
  const person: OutreachWorkingSetRow = {
    id: 'p1',
    source: 'ephemeral',
    name: 'Jorge Areosa',
    title: 'Chief Executive Officer',
    companyName: 'ARCO Interiors',
    locationName: 'Abu Dhabi',
    otherFields: {},
  };

  it('should show the job title to the model when jobTitle is requested', () => {
    const text = buildRecordText(toRecordForModel(person), [
      'name',
      'jobTitle',
      'companyName',
    ]);

    expect(text).toContain('jobTitle: Chief Executive Officer');
    expect(text).toContain('companyName: ARCO Interiors');
  });

  it('should show the job title when the flat title key is requested', () => {
    const text = buildRecordText(toRecordForModel(person), ['title']);

    expect(text).toBe('title: Chief Executive Officer');
  });

  it('should expose company fields for company rows', () => {
    const text = buildRecordText(
      toRecordForModel({
        id: 'c1',
        source: 'ephemeral',
        name: 'Acme',
        domain: 'acme.com',
        employees: '501-1000',
        otherFields: {},
      }),
      ['name', 'domain', 'size'],
    );

    expect(text).toContain('domain: acme.com');
    expect(text).toContain('company size (employees): 501-1000');
  });
});
