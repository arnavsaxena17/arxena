import {
    canAppendToExistingSuperImposeChart,
    parseMultilineUrlInput,
} from '@/orgchart/utils/superImposeAppendEligibility';

describe('superImposeAppendEligibility', () => {
  it('blocks append for blank template charts', () => {
    expect(
      canAppendToExistingSuperImposeChart({
        isBlankTemplate: true,
        latestOrgChart: { candidateSource: 'unipile' },
        itemCount: 10,
      }).eligible,
    ).toBe(false);
  });

  it('blocks append for elasticsearch preview without saved chart', () => {
    expect(
      canAppendToExistingSuperImposeChart({
        isBlankTemplate: false,
        firstSourceUsed: 'elasticsearch',
        latestOrgChart: null,
        itemCount: 0,
      }).eligible,
    ).toBe(false);
  });

  it('allows append when saved chart exists', () => {
    expect(
      canAppendToExistingSuperImposeChart({
        isBlankTemplate: false,
        firstSourceUsed: 'unipile',
        latestOrgChart: { candidateSource: 'unipile', itemCount: 42 },
        itemCount: 42,
      }).eligible,
    ).toBe(true);
  });

  it('parses multiline urls', () => {
    expect(parseMultilineUrlInput('a\nb')).toEqual(['a', 'b']);
  });
});
