import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { ArxenaSearchToolsConfigController } from 'src/engine/core-modules/arxena-tools/controllers/arxena-search-tools-config.controller';

describe('ArxenaSearchToolsConfigController', () => {
  it('should report a provider as disabled when its flag is false', () => {
    const twentyConfigService = {
      get: jest.fn((key: string) =>
        key === 'IS_SEARCH_EXA_ENABLED' ? false : undefined,
      ),
    } as unknown as TwentyConfigService;

    const config = new ArxenaSearchToolsConfigController(
      twentyConfigService,
    ).getSearchToolsConfig();

    expect(config.isSearchExaEnabled).toBe(false);
    expect(config.isSearchApolloPeopleEnabled).toBe(true);
  });
});
