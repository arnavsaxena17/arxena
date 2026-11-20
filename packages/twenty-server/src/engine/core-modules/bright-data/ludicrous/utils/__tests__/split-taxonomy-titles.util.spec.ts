import {
  specialtyPhrasesFor,
  splitTaxonomyTitles,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/split-taxonomy-titles.util';

describe('splitTaxonomyTitles', () => {
  it('should keep titles that name the specialty and set the general class aside', () => {
    expect(
      splitTaxonomyTitles({
        added: [
          'consultant nephrologist',
          'renal physician',
          'consultant physician',
          'physician assistant',
          'dialysis technician',
        ],
        rubric: {
          titleIncludePatterns: ['nephrolog', 'renal'],
          titleExcludePatterns: ['technician'],
        },
        excludeTitleWords: ['assistant'],
      }),
    ).toEqual({
      specific: ['consultant nephrologist', 'renal physician'],
      generic: ['consultant physician'],
      excluded: ['physician assistant', 'dialysis technician'],
    });
  });

  it('should keep every title when the plan has no title patterns', () => {
    expect(
      splitTaxonomyTitles({
        added: ['chief executive', 'managing director'],
        rubric: { titleIncludePatterns: [], titleExcludePatterns: [] },
        excludeTitleWords: [],
      }).specific,
    ).toEqual(['chief executive', 'managing director']);
  });
});

describe('specialtyPhrasesFor', () => {
  it('should give whole words a profile would contain, not regex stems', () => {
    expect(
      specialtyPhrasesFor({
        typedTitles: ['nephrologist', 'consultant nephrologist'],
        rubric: { titleIncludePatterns: ['nephrolog', 'nephrology'] },
      }),
    ).toEqual(['nephrology', 'nephrologist']);
  });

  it('should skip regex-shaped patterns', () => {
    expect(
      specialtyPhrasesFor({
        typedTitles: ['head of data'],
        rubric: { titleIncludePatterns: ['\\bdata\\b'] },
      }),
    ).toEqual(['data']);
  });
});
