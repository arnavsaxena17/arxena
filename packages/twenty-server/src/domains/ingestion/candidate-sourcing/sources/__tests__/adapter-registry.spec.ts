import { HttpException, HttpStatus } from '@nestjs/common';

import {
  SourceAdapterRegistry,
  createSearchPort,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter-registry';
import { type SourceSpec } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';

const BOOLEAN_SPEC: SourceSpec = { kind: 'boolean', query: 'cfo', facets: {} };

describe('SourceAdapterRegistry', () => {
  it('should search through the adapter registered for the source', async () => {
    const registry = new SourceAdapterRegistry();
    const search = jest.fn(async () => ({
      fetched: 25,
      newUnique: 20,
      costUsd: 0.1,
    }));

    registry.register('harvest', { search });

    const result = await registry.search(
      { source: 'harvest', spec: BOOLEAN_SPEC, pageSize: 25 },
      { page: 2, cursor: 'c1' },
    );

    expect(search).toHaveBeenCalledWith(BOOLEAN_SPEC, {
      cursor: 'c1',
      pageSize: 25,
    });
    expect(result).toEqual({ fetched: 25, newUnique: 20, costUsd: 0.1 });
  });

  it('should report a source with no adapter as unconfigured', async () => {
    const registry = new SourceAdapterRegistry();

    expect(registry.has('index')).toBe(false);
    expect(
      await createSearchPort(registry)(
        {
          source: 'index',
          spec: { kind: 'facets', filters: {} },
          pageSize: 25,
        } as never,
        { page: 1, cursor: undefined },
      ),
    ).toEqual({ fetched: 0, newUnique: 0, costUsd: 0, error: 'unconfigured' });
    expect(registry.rejects('index', { kind: 'facets', filters: {} })).toBe(
      'no adapter is registered for it yet',
    );
  });

  it('should turn a thrown provider error into the one error code', async () => {
    const registry = new SourceAdapterRegistry();

    registry.register('harvest', {
      search: async () => {
        throw new HttpException('slow down', HttpStatus.TOO_MANY_REQUESTS);
      },
    });

    expect(
      await registry.search(
        { source: 'harvest', spec: BOOLEAN_SPEC, pageSize: 25 },
        { page: 1, cursor: undefined },
      ),
    ).toEqual({ fetched: 0, newUnique: 0, costUsd: 0, error: 'rate_limited' });
  });

  it('should refuse a spec kind the source does not accept', async () => {
    const registry = new SourceAdapterRegistry();

    registry.register('harvest', { search: jest.fn() });

    await expect(
      registry.search(
        {
          source: 'harvest',
          spec: { kind: 'string', query: 'cfo' },
          pageSize: 25,
        },
        { page: 1, cursor: undefined },
      ),
    ).rejects.toThrow('does not accept a string spec');
  });

  it('should pass on why an adapter cannot run a spec', () => {
    const registry = new SourceAdapterRegistry();

    registry.register('harvest', {
      search: jest.fn(),
      rejects: (spec) =>
        spec.kind === 'boolean' && spec.query === ''
          ? 'it needs keywords'
          : undefined,
    });

    expect(registry.rejects('harvest', BOOLEAN_SPEC)).toBeUndefined();
    expect(
      registry.rejects('harvest', { kind: 'boolean', query: '', facets: {} }),
    ).toBe('it needs keywords');
  });
});
