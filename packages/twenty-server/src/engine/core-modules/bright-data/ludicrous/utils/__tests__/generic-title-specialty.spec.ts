import {
  readPersonProfileText,
  scoreRecordAgainstRubric,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-relevance.util';
import { compileShardFilter } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-shard-compiler.util';

const rubric = {
  titleIncludePatterns: ['nephrolog'],
  titleExcludePatterns: ['assistant'],
  industryIncludePatterns: [],
  countryCodes: ['IN'],
  companySizeFromBuckets: [],
};

describe('a generic title with the specialty on the profile', () => {
  it('should count a consulting physician whose profile names the specialty', () => {
    expect(
      scoreRecordAgainstRubric({
        entity: 'people',
        rubric,
        data: {
          current_title: 'Consulting Physician',
          country_code: 'IN',
          about: 'DM Nephrology, 12 years treating kidney disease',
        },
      }),
    ).toBe(true);
  });

  it('should not count a consulting physician with no sign of it', () => {
    expect(
      scoreRecordAgainstRubric({
        entity: 'people',
        rubric,
        data: {
          current_title: 'Consulting Physician',
          country_code: 'IN',
          about: 'General medicine and diabetes care',
        },
      }),
    ).toBe(false);
  });

  it('should still reject an excluded title whatever the profile says', () => {
    expect(
      scoreRecordAgainstRubric({
        entity: 'people',
        rubric,
        data: {
          current_title: 'Physician Assistant',
          country_code: 'IN',
          about: 'Nephrology ward',
        },
      }),
    ).toBe(false);
  });

  it('should read the headline, skills and degrees as profile text', () => {
    expect(
      readPersonProfileText({
        position: 'Consultant at Lilavati Hospital',
        skills: ['Dialysis', 'Nephrology'],
        education_details: 'DM Nephrology',
        about: '',
      }),
    ).toBe(
      'Consultant at Lilavati Hospital | Dialysis; Nephrology | DM Nephrology',
    );
  });

  it('should require any specialty word in the profile text for a people slice', () => {
    const { query } = compileShardFilter({
      entity: 'people',
      filter: {
        titles: ['consultant physician'],
        cities: ['Mumbai'],
        specialtiesAny: ['nephrology', 'nephrologist'],
      },
    });

    const serialized = JSON.stringify(query);

    expect(serialized).toContain('"about"');
    expect(serialized).toContain('"all_text"');
    expect(serialized).toContain('nephrologist');
  });
});
