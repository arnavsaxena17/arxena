import {
  readHarvestLeadFields,
  readHarvestLocationText,
} from 'src/engine/core-modules/org-chart/utils/harvest-lead-fields.util';

describe('readHarvestLocationText', () => {
  it('should unwrap the nested lead-search location', () => {
    expect(readHarvestLocationText({ linkedinText: ' Mumbai, India ' })).toBe(
      'Mumbai, India',
    );
  });

  it('should accept the flattened string location', () => {
    expect(readHarvestLocationText('Pune, India')).toBe('Pune, India');
  });

  it('should return empty for missing or unknown shapes', () => {
    expect(readHarvestLocationText(undefined)).toBe('');
    expect(readHarvestLocationText({ countryCode: 'IN' })).toBe('');
  });
});

describe('readHarvestLeadFields', () => {
  it('should read a raw lead-search item', () => {
    expect(
      readHarvestLeadFields({
        id: 'ACw1',
        firstName: 'Asha',
        lastName: 'Rao',
        linkedinUrl: 'https://www.linkedin.com/in/asha',
        pictureUrl: 'https://media.licdn.com/x.jpg',
        location: { linkedinText: 'Mumbai, India' },
        currentPositions: [
          {
            title: 'Plant Manager',
            companyName: 'Arvind',
            companyLinkedinUrl: 'https://www.linkedin.com/company/arvind',
          },
        ],
      }),
    ).toEqual({
      id: 'ACw1',
      fullName: '',
      firstName: 'Asha',
      lastName: 'Rao',
      title: 'Plant Manager',
      companyName: 'Arvind',
      companyLinkedinUrl: 'https://www.linkedin.com/company/arvind',
      linkedinUrl: 'https://www.linkedin.com/in/asha',
      location: 'Mumbai, India',
      pictureUrl: 'https://media.licdn.com/x.jpg',
    });
  });

  it('should skip empty positions and fall back to the headline', () => {
    const fields = readHarvestLeadFields({
      headline: 'Operations leader',
      currentPositions: [
        { title: '  ', companyName: '' },
        { companyName: 'Tata' },
      ],
    });

    expect(fields.title).toBe('Operations leader');
    expect(fields.companyName).toBe('Tata');
  });

  it('should return empty strings when fields are missing', () => {
    expect(readHarvestLeadFields({})).toMatchObject({
      id: '',
      firstName: '',
      title: '',
      location: '',
    });
  });
});
