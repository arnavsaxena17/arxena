import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { mergePeople } from 'src/engine/core-modules/outreach-command/utils/merge-people.util';

const buildPerson = (
  overrides: Partial<OutreachEphemeralPerson>,
): OutreachEphemeralPerson => ({
  id: 'person-1',
  name: 'Ada Lovelace',
  title: 'Engineer',
  companyId: '',
  companyName: 'Analytical Engines',
  linkedinUrl: '',
  warmPath: '—',
  stage: 'QUEUED',
  email: '',
  ...overrides,
});

describe('mergePeople', () => {
  it('should merge a member-id row and a vanity-slug row when the names differ only by a middle name', () => {
    const harvestRow = buildPerson({
      id: 'harvest-row',
      name: 'Virender Singh Sehrawat',
      title: 'Executive Vice President and Head of Integrated Supply Chain',
      companyName: 'Jubilant FoodWorks Limited',
      linkedinUrl:
        'https://www.linkedin.com/in/ACwAAAFqIRoBWALqvHvvzeVnxsK7eyVN3P69qsc',
    });
    const webRow = buildPerson({
      id: 'web-row',
      name: 'Virender Sehrawat',
      title: 'EVP and Head of Integrated Supply Chain',
      companyName: 'Jubilant FoodWorks Ltd.',
      linkedinUrl: 'https://www.linkedin.com/in/virender-sehrawat-10ab467/',
    });

    const merged = mergePeople([harvestRow], [webRow]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        id: 'harvest-row',
        linkedinUrl: 'https://www.linkedin.com/in/virender-sehrawat-10ab467/',
      }),
    );
  });

  it('should keep two close names apart when both carry different vanity slugs', () => {
    const first = buildPerson({
      id: 'first',
      name: 'Ankit Sharma',
      companyName: 'Zomato',
      linkedinUrl: 'https://www.linkedin.com/in/ankit-sharma-1',
    });
    const second = buildPerson({
      id: 'second',
      name: 'Ankit Kumar Sharma',
      companyName: 'Zomato',
      linkedinUrl: 'https://www.linkedin.com/in/ankit-kumar-sharma-2',
    });

    expect(mergePeople([first], [second])).toHaveLength(2);
  });

  it('should keep a member-id row and a vanity-slug row apart when the names do not match', () => {
    const harvestRow = buildPerson({
      id: 'harvest-row',
      name: 'Virender Singh Sehrawat',
      companyName: 'Jubilant FoodWorks',
      linkedinUrl:
        'https://www.linkedin.com/in/ACwAAAFqIRoBWALqvHvvzeVnxsK7eyVN3P69qsc',
    });
    const webRow = buildPerson({
      id: 'web-row',
      name: 'Somnath Das',
      companyName: 'Jubilant FoodWorks',
      linkedinUrl: 'https://www.linkedin.com/in/somnath-das',
    });

    expect(mergePeople([harvestRow], [webRow])).toHaveLength(2);
  });

  it('should keep a member-id row and a vanity-slug row apart at different employers', () => {
    const harvestRow = buildPerson({
      id: 'harvest-row',
      name: 'Virender Singh Sehrawat',
      companyName: 'Jubilant FoodWorks',
      linkedinUrl:
        'https://www.linkedin.com/in/ACwAAAFqIRoBWALqvHvvzeVnxsK7eyVN3P69qsc',
    });
    const webRow = buildPerson({
      id: 'web-row',
      name: 'Virender Sehrawat',
      companyName: 'Zomato',
      linkedinUrl: 'https://www.linkedin.com/in/virender-sehrawat-10ab467/',
    });

    expect(mergePeople([harvestRow], [webRow])).toHaveLength(2);
  });
});
