import { HarvestSearchController } from '../harvest-search.controller';

describe('HarvestSearchController', () => {
  const createController = (geoIds: string[]) => {
    const searchSalesNavigatorCollection = jest.fn(async () => ({
      items: [],
      firstPage: 1,
      lastPage: 1,
      nextPage: null,
    }));
    const harvestLinkedinService = {
      isConfigured: () => true,
      resolveGeoIds: jest.fn(async () => geoIds),
      searchSalesNavigatorCollection,
    };

    return {
      controller: new HarvestSearchController(harvestLinkedinService as never),
      searchSalesNavigatorCollection,
    };
  };

  it('replaces a location with its resolved geo id', async () => {
    const { controller, searchSalesNavigatorCollection } = createController([
      '90009639',
    ]);

    await controller.searchLeads({
      searchParameters: { locations: 'Mumbai, Maharashtra, India' },
    });

    expect(searchSalesNavigatorCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { geoIds: '90009639' },
      }),
    );
  });

  it('keeps the location text when nothing resolves', async () => {
    const { controller, searchSalesNavigatorCollection } = createController([]);

    await controller.searchLeads({
      searchParameters: { locations: 'Nowhere In Particular' },
    });

    expect(searchSalesNavigatorCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { locations: 'Nowhere In Particular' },
      }),
    );
  });
});
