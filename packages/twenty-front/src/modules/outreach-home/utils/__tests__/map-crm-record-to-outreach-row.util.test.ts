import {
  mapCrmCompanyRecordToOutreachCompanyRow,
  mapCrmPersonRecordToOutreachPersonRow,
} from '@/outreach-home/utils/map-crm-record-to-outreach-row.util';

describe('map-crm-record-to-outreach-row', () => {
  it('maps company CRM fields into an OutreachCompanyRow', () => {
    const row = mapCrmCompanyRecordToOutreachCompanyRow({
      id: 'company-1',
      name: 'Acme',
      domainName: {
        primaryLinkUrl: 'https://acme.com',
        primaryLinkLabel: 'acme.com',
      },
      industry: 'Software',
      employees: 42,
      icpSegment: 'enterprise',
      icpFit: 'high',
    });

    expect(row).toEqual({
      id: 'company-1',
      name: 'Acme',
      domain: 'https://acme.com',
      industry: 'Software',
      employees: '42',
      segment: 'enterprise',
      icpFit: 'high',
      status: 'new',
    });
  });

  it('maps person CRM fields into an OutreachPersonRow', () => {
    const row = mapCrmPersonRecordToOutreachPersonRow({
      id: 'person-1',
      name: { firstName: 'Ada', lastName: 'Lovelace' },
      jobTitle: 'Engineer',
      jobCompanyName: 'Acme',
      companyId: 'company-1',
      linkedinLink: { primaryLinkUrl: 'https://linkedin.com/in/ada' },
      emails: { primaryEmail: 'ada@acme.com' },
      locationName: 'London',
    });

    expect(row).toEqual({
      id: 'person-1',
      name: 'Ada Lovelace',
      title: 'Engineer',
      companyId: 'company-1',
      companyName: 'Acme',
      linkedinUrl: 'https://linkedin.com/in/ada',
      warmPath: '—',
      stage: 'QUEUED',
      email: 'ada@acme.com',
      locationName: 'London',
    });
  });

  it('returns null when CRM id is missing', () => {
    expect(
      mapCrmCompanyRecordToOutreachCompanyRow({ name: 'No Id' }),
    ).toBeNull();
    expect(mapCrmPersonRecordToOutreachPersonRow({ name: 'No Id' })).toBeNull();
  });
});
