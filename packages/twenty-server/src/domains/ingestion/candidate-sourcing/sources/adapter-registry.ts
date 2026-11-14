import {
  type RunCandidate,
  type SourcingRunPorts,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import {
  type SourceAdapter,
  type SourceSearchResult,
  type SourceSpec,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  SOURCE_REGISTRY,
  type SourceAlias,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';
import { toSourceErrorCode } from 'src/domains/ingestion/candidate-sourcing/sources/source-error.util';

// alias -> adapter. A source is searched through here and nowhere else: the
// loop never names a provider, and a provider never decides when it is used.
export class SourceAdapterRegistry {
  private readonly adapters = new Map<SourceAlias, SourceAdapter>();

  register(alias: SourceAlias, adapter: SourceAdapter): void {
    this.adapters.set(alias, adapter);
  }

  has(alias: SourceAlias): boolean {
    return this.adapters.has(alias);
  }

  // Why the source cannot run the spec, or undefined when it can
  rejects(alias: SourceAlias, spec: SourceSpec): string | undefined {
    const adapter = this.adapters.get(alias);

    return adapter === undefined
      ? 'no adapter is registered for it yet'
      : adapter.rejects?.(spec);
  }

  // One page of one candidate. Never throws: a provider's own error becomes
  // the one error code, so retry, stop and the message read a single value.
  async search(
    candidate: Pick<RunCandidate, 'source' | 'spec' | 'pageSize'>,
    request: { page: number; cursor: string | undefined },
  ): Promise<SourceSearchResult> {
    const adapter = this.adapters.get(candidate.source);

    if (adapter === undefined) {
      return { fetched: 0, newUnique: 0, costUsd: 0, error: 'unconfigured' };
    }

    // A spec the source does not accept would otherwise be dropped or
    // misread by the provider, which looks like a bad query
    if (
      !SOURCE_REGISTRY[candidate.source].kinds.includes(candidate.spec.kind)
    ) {
      throw new Error(
        `Source "${candidate.source}" does not accept a ${candidate.spec.kind} spec`,
      );
    }

    try {
      return await adapter.search(candidate.spec, {
        pageSize: candidate.pageSize,
        ...(request.cursor !== undefined && { cursor: request.cursor }),
      });
    } catch (error) {
      return {
        fetched: 0,
        newUnique: 0,
        costUsd: 0,
        error: toSourceErrorCode(error),
      };
    }
  }
}

// The loop's search port, backed by the registry
export const createSearchPort =
  (registry: SourceAdapterRegistry): SourcingRunPorts['search'] =>
  (candidate, request) =>
    registry.search(candidate, request);
