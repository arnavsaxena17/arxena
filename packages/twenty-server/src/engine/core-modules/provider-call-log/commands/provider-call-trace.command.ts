import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { writeFile } from 'fs/promises';

import { Command, CommandRunner, Option } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { stableStringifyProviderQueryCacheValue } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';
import { ProviderCallEntity } from 'src/engine/core-modules/provider-call-log/provider-call.entity';

type TraceOptions = {
  thread?: string;
  turn?: string;
  compare?: boolean;
  requests?: boolean;
  cells?: boolean;
  out?: string;
};

type TurnTrace = {
  turnId: string;
  startedAt: Date;
  prompt: string | null;
  calls: ProviderCallEntity[];
};

const describeRequest = (call: ProviderCallEntity): string => {
  const request = stableStringifyProviderQueryCacheValue(call.request ?? {});

  return request.length > 200 ? `${request.slice(0, 200)}…` : request;
};

// The same request asked twice has the same signature, whichever cache
// layer answered it
const signatureOf = (call: ProviderCallEntity): string =>
  `${call.provider}|${call.operation}|${
    call.cacheKey ?? stableStringifyProviderQueryCacheValue(call.request ?? {})
  }`;

@Command({
  name: 'provider-call:trace',
  description:
    'Show every provider request a chat thread made, turn by turn, and diff the last two runs. Run: npx nx run twenty-server:command provider-call:trace --thread <threadId> --compare [--cells]',
})
export class ProviderCallTraceCommand extends CommandRunner {
  private readonly logger = new Logger(ProviderCallTraceCommand.name);

  constructor(
    // Calls are logged outside any workspace too and read back by chat
    // thread, so the workspace guard does not apply
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(ProviderCallEntity)
    private readonly providerCallRepository: Repository<ProviderCallEntity>,
  ) {
    super();
  }

  @Option({ flags: '--thread <threadId>', description: 'Agent chat thread id' })
  parseThread(value: string): string {
    return value;
  }

  @Option({ flags: '--turn <turnId>', description: 'Only this turn' })
  parseTurn(value: string): string {
    return value;
  }

  @Option({
    flags: '--compare',
    description: 'Diff the requests of the last two turns that made calls',
  })
  parseCompare(): boolean {
    return true;
  }

  @Option({ flags: '--requests', description: 'List every request' })
  parseRequests(): boolean {
    return true;
  }

  @Option({
    flags: '--cells',
    description:
      'Grid of company x cell (role family | source | tier) per turn, so a missing cell shows',
  })
  parseCells(): boolean {
    return true;
  }

  @Option({ flags: '--out <path>', description: 'Write all rows as JSON' })
  parseOut(value: string): string {
    return value;
  }

  async run(_passedParams: string[], options: TraceOptions): Promise<void> {
    if (!isDefined(options.thread)) {
      this.logger.error('--thread is required');

      return;
    }

    const calls = await this.providerCallRepository.find({
      where: {
        threadId: options.thread,
        ...(isDefined(options.turn) && { turnId: options.turn }),
      },
      order: { createdAt: 'ASC' },
    });

    if (calls.length === 0) {
      this.logger.log(
        `No provider calls recorded for thread ${options.thread}`,
      );

      return;
    }

    const turns = await this.groupByTurn(options.thread, calls);

    for (const turn of turns) {
      this.printTurn(turn, options.requests === true);

      if (options.cells === true) {
        this.printCells(turn);
      }
    }

    if (options.compare === true) {
      this.printComparison(turns);
    }

    if (isDefined(options.out)) {
      await writeFile(options.out, JSON.stringify(turns, null, 2));
      this.logger.log(`Wrote ${calls.length} rows to ${options.out}`);
    }
  }

  private async groupByTurn(
    threadId: string,
    calls: ProviderCallEntity[],
  ): Promise<TurnTrace[]> {
    const prompts: Array<{ turnId: string; prompt: string | null }> =
      await this.providerCallRepository.query(
        `SELECT DISTINCT ON (m."turnId") m."turnId" AS "turnId",
                left(p."textContent", 160) AS "prompt"
           FROM "core"."agentMessage" m
           JOIN "core"."agentMessagePart" p ON p."messageId" = m.id
          WHERE m."threadId" = $1 AND m.role = 'user' AND p.type = 'text'
          ORDER BY m."turnId", m."createdAt", p."orderIndex"`,
        [threadId],
      );
    const promptByTurn = new Map(
      prompts.map((row) => [row.turnId, row.prompt]),
    );
    const byTurn = new Map<string, TurnTrace>();

    for (const call of calls) {
      const turnId = call.turnId ?? 'no-turn';
      const turn = byTurn.get(turnId) ?? {
        turnId,
        startedAt: call.createdAt,
        prompt: promptByTurn.get(turnId) ?? null,
        calls: [],
      };

      turn.calls.push(call);
      byTurn.set(turnId, turn);
    }

    return [...byTurn.values()].sort(
      (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
    );
  }

  private printTurn(turn: TurnTrace, listRequests: boolean): void {
    const lines: string[] = [
      '',
      `=== turn ${turn.turnId} ${turn.startedAt.toISOString()} calls=${turn.calls.length}`,
    ];

    if (isDefined(turn.prompt)) {
      lines.push(`    prompt: ${turn.prompt.replace(/\s+/g, ' ')}`);
    }

    const byProvider = new Map<string, Map<string, number>>();

    for (const call of turn.calls) {
      const statuses = byProvider.get(call.provider) ?? new Map();

      statuses.set(call.cacheStatus, (statuses.get(call.cacheStatus) ?? 0) + 1);
      byProvider.set(call.provider, statuses);
    }

    for (const [provider, statuses] of byProvider) {
      const counts = [...statuses.entries()]
        .map(([status, count]) => `${status}=${count}`)
        .join(' ');

      lines.push(`    ${provider.padEnd(32)} ${counts}`);
    }

    const errors = turn.calls.filter((call) => !call.success);

    for (const error of errors.slice(0, 10)) {
      lines.push(
        `    ! ${error.provider} ${error.subject ?? ''} ${error.errorMessage ?? ''}`,
      );
    }

    if (listRequests) {
      // One row per call, so a retry or a cache hit repeats the same request.
      // The history is the distinct requests, with the repeat count beside it.
      const distinct = new Map<
        string,
        { call: ProviderCallEntity; count: number }
      >();

      for (const call of turn.calls) {
        const signature = signatureOf(call);
        const seen = distinct.get(signature);

        if (seen !== undefined) {
          seen.count += 1;
          continue;
        }

        distinct.set(signature, { call, count: 1 });
      }

      for (const { call, count } of distinct.values()) {
        lines.push(
          `    - ${count > 1 ? `x${count} ` : ''}[${
            call.cacheStatus
          }] ${call.provider} ${call.stage ?? ''} ${
            call.subject ?? ''
          } results=${call.resultCount ?? '?'} ${describeRequest(call)}`,
        );
      }
    }

    this.logger.log(lines.join('\n'));
  }

  // The finder tags each searched cell cell:<family>|<source>|<tier>, with the
  // company as the subject. A company missing a family x source cell was never
  // searched there; a lower tier shows only when the one above came back empty.
  private printCells(turn: TurnTrace): void {
    const byCompany = new Map<
      string,
      Map<string, { calls: number; results: number; errors: number }>
    >();

    for (const call of turn.calls) {
      if (!(call.stage ?? '').startsWith('cell:')) {
        continue;
      }

      const company = call.subject ?? '(no company)';
      const cells = byCompany.get(company) ?? new Map();
      const cell = (call.stage ?? '').slice('cell:'.length);
      const entry = cells.get(cell) ?? { calls: 0, results: 0, errors: 0 };

      entry.calls += 1;
      entry.results += call.resultCount ?? 0;
      entry.errors += call.success ? 0 : 1;
      cells.set(cell, entry);
      byCompany.set(company, cells);
    }

    if (byCompany.size === 0) {
      this.logger.log('    (no cell-tagged calls in this turn)');

      return;
    }

    const lines = ['    cells:'];

    for (const [company, cells] of byCompany) {
      lines.push(`      ${company}`);

      for (const [cell, entry] of [...cells.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        lines.push(
          `        ${cell.padEnd(56)} calls=${entry.calls} results=${entry.results}${
            entry.errors > 0 ? ` errors=${entry.errors}` : ''
          }`,
        );
      }
    }

    this.logger.log(lines.join('\n'));
  }

  private printComparison(turns: TurnTrace[]): void {
    const withCalls = turns.filter((turn) => turn.calls.length > 0);

    if (withCalls.length < 2) {
      this.logger.log('Need two turns with provider calls to compare');

      return;
    }

    const previous = withCalls[withCalls.length - 2];
    const latest = withCalls[withCalls.length - 1];
    const previousBySignature = new Map(
      previous.calls.map((call) => [signatureOf(call), call]),
    );
    const latestBySignature = new Map(
      latest.calls.map((call) => [signatureOf(call), call]),
    );
    const added = [...latestBySignature.entries()].filter(
      ([signature]) => !previousBySignature.has(signature),
    );
    const dropped = [...previousBySignature.entries()].filter(
      ([signature]) => !latestBySignature.has(signature),
    );
    const repeated = latestBySignature.size - added.length;

    const lines = [
      '',
      `=== compare ${previous.turnId} -> ${latest.turnId}`,
      `    distinct requests: ${previousBySignature.size} -> ${latestBySignature.size} (repeated ${repeated}, new ${added.length}, dropped ${dropped.length})`,
      '    new:',
      ...added.map(
        ([, call]) =>
          `      + ${call.provider} ${call.subject ?? ''} ${describeRequest(call)}`,
      ),
      '    dropped:',
      ...dropped.map(
        ([, call]) =>
          `      - ${call.provider} ${call.subject ?? ''} ${describeRequest(call)}`,
      ),
    ];

    this.logger.log(lines.join('\n'));
  }
}
