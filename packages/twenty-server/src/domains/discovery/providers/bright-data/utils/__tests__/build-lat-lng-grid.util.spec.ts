import {
  buildLatLngGrid,
  resolveCityBoundingBox,
} from '../build-lat-lng-grid.util';

describe('buildLatLngGrid', () => {
  it('builds a non-empty Mumbai grid at default spacing', () => {
    const mumbai = resolveCityBoundingBox('mumbai');

    expect(mumbai).toBeDefined();

    const cells = buildLatLngGrid({
      minLat: mumbai!.minLat,
      maxLat: mumbai!.maxLat,
      minLng: mumbai!.minLng,
      maxLng: mumbai!.maxLng,
    });

    expect(cells.length).toBeGreaterThan(50);
    expect(cells[0]).toEqual(
      expect.objectContaining({
        lat: expect.any(Number),
        lng: expect.any(Number),
      }),
    );
  });
});
