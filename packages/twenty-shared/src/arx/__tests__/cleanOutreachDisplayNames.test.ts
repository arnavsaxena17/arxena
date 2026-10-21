import {
  cleanCompanyNameForDisplay,
  cleanPersonNameForDisplay,
} from '../cleanOutreachDisplayNames';
import { renderOutreachDraftTemplate } from '../outreachDraftTemplates';

describe('cleanCompanyNameForDisplay', () => {
  it('strips trailing legal suffixes and title-cases', () => {
    expect(cleanCompanyNameForDisplay('Lite Bite Foods Pvt Ltd')).toBe(
      'Lite Bite Foods',
    );
    expect(cleanCompanyNameForDisplay('Monginis Foods Pvt. Ltd.')).toBe(
      'Monginis Foods',
    );
    expect(cleanCompanyNameForDisplay('Acme Retail, LLC')).toBe('Acme Retail');
    expect(cleanCompanyNameForDisplay('Nestle India Ltd')).toBe('Nestle India');
  });

  it('keeps the brand when only a suffix remains would empty it', () => {
    expect(cleanCompanyNameForDisplay('Limited')).toBe('Limited');
  });
});

describe('cleanPersonNameForDisplay', () => {
  it('title-cases and strips honorifics', () => {
    expect(cleanPersonNameForDisplay('ranjit paliath')).toBe('Ranjit Paliath');
    expect(cleanPersonNameForDisplay('Dr. Ranjit Paliath')).toBe(
      'Ranjit Paliath',
    );
    expect(cleanPersonNameForDisplay('mr ranjit')).toBe('Ranjit');
  });
});

describe('renderOutreachDraftTemplate display cleaning', () => {
  it('cleans person and company values before substitution', () => {
    const result = renderOutreachDraftTemplate(
      'Hi {{person.firstName}} at {{company.name}} — {{person.fullName}}',
      {
        'person.firstName': 'ranjit',
        'person.fullName': 'mr. ranjit paliath',
        'company.name': 'Lite Bite Foods Pvt Ltd',
      },
    );

    expect(result.message).toBe(
      'Hi Ranjit at Lite Bite Foods — Ranjit Paliath',
    );
    expect(result.missingVariableKeys).toEqual([]);
  });
});
