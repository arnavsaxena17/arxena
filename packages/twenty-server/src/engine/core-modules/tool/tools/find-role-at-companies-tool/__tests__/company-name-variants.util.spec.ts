import {
  buildCompanyVariants,
  matchesAnyCompanyVariant,
  textMentionsAnyCompanyVariant,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/company-name-variants.util';

describe('buildCompanyVariants', () => {
  it('should add the name without its country word and the alternates', () => {
    expect(
      buildCompanyVariants('Baskin Robbins India', ['Graviss Foods']),
    ).toEqual(['Baskin Robbins India', 'baskin robbins', 'Graviss Foods']);
  });
});

describe('matchesAnyCompanyVariant', () => {
  it('should accept the brand with a country or legal suffix', () => {
    expect(
      matchesAnyCompanyVariant(buildCompanyVariants('Subway India'), 'Subway'),
    ).toBe(true);
    expect(
      matchesAnyCompanyVariant(
        buildCompanyVariants('Monginis'),
        'Monginis Foods Pvt. Ltd.',
      ),
    ).toBe(true);
  });

  it('should accept a brand inside a compound profile company', () => {
    expect(
      matchesAnyCompanyVariant(
        buildCompanyVariants('Baskin Robbins India'),
        'Graviss Foods Pvt Ltd – Baskin Robbins – India',
      ),
    ).toBe(true);
  });

  it('should reject a different company that shares a word', () => {
    expect(
      matchesAnyCompanyVariant(
        buildCompanyVariants('FACES CANADA'),
        'HAPPY FACES',
      ),
    ).toBe(false);
    expect(
      matchesAnyCompanyVariant(buildCompanyVariants('Acme'), 'Acme Robotics'),
    ).toBe(false);
  });

  it('should accept the parent when it is given as an alternate name', () => {
    expect(
      matchesAnyCompanyVariant(
        buildCompanyVariants('Arun Ice Cream', ['Hatsun Agro Product']),
        'Hatsun Agro Product Ltd',
      ),
    ).toBe(true);
  });

  it('should reject a missing company', () => {
    expect(matchesAnyCompanyVariant(['Acme'], undefined)).toBe(false);
  });
});

describe('textMentionsAnyCompanyVariant', () => {
  it('should find the brand as a phrase in free text', () => {
    expect(
      textMentionsAnyCompanyVariant(
        ['Baskin Robbins'],
        'Sanjay Goyal - VP - Baskin Robbins India | LinkedIn',
      ),
    ).toBe(true);
    expect(textMentionsAnyCompanyVariant(['Faces Canada'], 'Happy Faces')).toBe(
      false,
    );
  });
});
