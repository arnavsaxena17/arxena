import {
  SOURCING_SOURCE_KEYS,
  SOURCING_SOURCE_REGISTRY,
  countReliabilityOf,
  estimateSourceCostUsd,
  shouldRetrySourceError,
  sourcingSourceKeyOf,
} from 'src/engine/core-modules/candidate-sourcing/sources/registry';
import { DataSourceType } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { PEOPLE_DATA_SOURCE_CATEGORIES } from 'src/engine/core-modules/people-api/constants/people-data-source-aliases';
import { SOURCE_CAPABILITIES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-source-capabilities.constant';
import { SOURCING_SOURCES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';

describe('sourcing source registry', () => {
  it('should have one entry per SOURCING_SOURCES key and no other', () => {
    expect([...SOURCING_SOURCE_KEYS].sort()).toEqual(
      SOURCING_SOURCES.map((source) => source.key).sort(),
    );

    for (const key of SOURCING_SOURCE_KEYS) {
      expect(SOURCING_SOURCE_REGISTRY[key].key).toBe(key);
    }
  });

  it('should know every source the capability matrix describes', () => {
    for (const capability of SOURCE_CAPABILITIES) {
      expect(sourcingSourceKeyOf(capability.key)).toBe(capability.key);
    }
  });

  it('should fold every People API alias that names a choosable source', () => {
    const notASearchSource = ['auto', 'pdl', 'contactout'];

    for (const { alias } of PEOPLE_DATA_SOURCE_CATEGORIES) {
      if (notASearchSource.includes(alias)) {
        expect(sourcingSourceKeyOf(alias)).toBeUndefined();
      } else {
        expect(sourcingSourceKeyOf(alias)).toBeDefined();
      }
    }

    expect(sourcingSourceKeyOf('pool')).toBe('linkedin');
    expect(sourcingSourceKeyOf('bright_data')).toBe('bright-data');
  });

  it('should fold the LinkedIn and Naukri upload source types', () => {
    expect(sourcingSourceKeyOf(DataSourceType.LINKEDIN_SALES_NAVIGATOR)).toBe(
      'linkedin',
    );
    expect(sourcingSourceKeyOf(DataSourceType.RESDEX_NAUKRI)).toBe('naukri');
    expect(sourcingSourceKeyOf(DataSourceType.SPREADSHEET_IMPORT)).toBe(
      undefined,
    );
    expect(sourcingSourceKeyOf(' Harvest ')).toBe('harvest');
    expect(sourcingSourceKeyOf(undefined)).toBeUndefined();
  });

  it('should trust LinkedIn counts on Sales Navigator and never on classic', () => {
    expect(countReliabilityOf('linkedin', 'classic')).toBe('none');
    expect(countReliabilityOf('linkedin', 'sales_navigator')).toBe('exact');
    expect(countReliabilityOf('linkedin')).toBe('none');
    expect(countReliabilityOf('harvest')).toBe('exact');
  });

  it('should retry per source policy and never retry a non-transient error', () => {
    expect(shouldRetrySourceError('linkedin', 'rate_limited', 0)).toBe(false);
    expect(shouldRetrySourceError('harvest', 'upstream', 0)).toBe(true);
    expect(shouldRetrySourceError('harvest', 'upstream', 1)).toBe(false);
    expect(shouldRetrySourceError('serp', 'upstream', 2)).toBe(true);
    expect(shouldRetrySourceError('apollo', 'no_results', 0)).toBe(false);
    expect(shouldRetrySourceError('apollo', 'deferred', 0)).toBe(false);
  });

  it('should price records with one rounding rule', () => {
    expect(estimateSourceCostUsd('bright-data', { records: 3 })).toBe(0.006);
    expect(estimateSourceCostUsd('harvest', { records: 250 })).toBe(1);
    expect(estimateSourceCostUsd('serp', {})).toBe(0.0015);
    expect(estimateSourceCostUsd('linkedin', { records: 1000 })).toBe(0);
    expect(estimateSourceCostUsd('apollo', { records: 10 })).toBeUndefined();
  });
});
