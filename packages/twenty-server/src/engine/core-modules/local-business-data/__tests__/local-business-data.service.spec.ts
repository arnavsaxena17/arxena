import { LocalBusinessDataService } from 'src/engine/core-modules/local-business-data/local-business-data.service';

describe('LocalBusinessDataService', () => {
  it('search maps params and returns array data', async () => {
    const client = {
      get: jest.fn().mockResolvedValue([{ name: 'Hotel A' }]),
    };
    const service = new LocalBusinessDataService(client as never);

    const result = await service.search({
      query: 'Hotels in SF',
      limit: 5,
      extractEmailsAndContacts: true,
    });

    expect(result).toEqual([{ name: 'Hotel A' }]);
    expect(client.get).toHaveBeenCalledWith('/search', {
      query: 'Hotels in SF',
      limit: 5,
      lat: undefined,
      lng: undefined,
      zoom: undefined,
      language: undefined,
      region: undefined,
      extract_emails_and_contacts: true,
      subtypes: undefined,
      verified: undefined,
      business_status: undefined,
      fields: undefined,
    });
  });

  it('getBusinessDetails joins business ids', async () => {
    const client = {
      get: jest.fn().mockResolvedValue({ name: 'One business' }),
    };
    const service = new LocalBusinessDataService(client as never);

    const result = await service.getBusinessDetails({
      businessIds: ['id-1', 'id-2'],
      extractEmailsAndContacts: true,
    });

    expect(result).toEqual([{ name: 'One business' }]);
    expect(client.get).toHaveBeenCalledWith('/business-details', {
      business_id: 'id-1,id-2',
      extract_emails_and_contacts: true,
      extract_share_link: undefined,
      language: undefined,
      region: undefined,
      fields: undefined,
    });
  });
});
