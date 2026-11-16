import { Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { writeFile } from 'fs/promises';
import { type Readable } from 'stream';

import { Command, CommandRunner, Option } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { ProviderCallEntity } from 'src/engine/core-modules/provider-call-log/provider-call.entity';
import {
  type ProviderCallRecording,
  type ProviderCallRecordingEntry,
} from 'src/engine/core-modules/provider-call-log/types/provider-call-recording.type';

type ExportOptions = {
  thread?: string;
  turn?: string;
  scenario?: string;
  out?: string;
};

const streamToString = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });

@Command({
  name: 'provider-call:export-recording',
  description:
    'Write the provider calls of one chat thread as a replay recording for a sourcing-eval scenario. Run: npx nx run twenty-server:command provider-call:export-recording --thread <threadId> --scenario <id> --out <file>',
})
export class ProviderCallExportRecordingCommand extends CommandRunner {
  private readonly logger = new Logger(ProviderCallExportRecordingCommand.name);

  constructor(
    // Calls are logged outside any workspace too and read back by chat
    // thread, so the workspace guard does not apply
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(ProviderCallEntity)
    private readonly providerCallRepository: Repository<ProviderCallEntity>,
    @Optional()
    private readonly fileStorageService?: FileStorageService,
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
    flags: '--scenario <id>',
    description: 'Sourcing-eval scenario id',
  })
  parseScenario(value: string): string {
    return value;
  }

  @Option({ flags: '--out <path>', description: 'Recording file to write' })
  parseOut(value: string): string {
    return value;
  }

  async run(_passedParams: string[], options: ExportOptions): Promise<void> {
    if (
      !isDefined(options.thread) ||
      !isDefined(options.scenario) ||
      !isDefined(options.out)
    ) {
      this.logger.error('--thread, --scenario and --out are required');

      return;
    }

    const rows = await this.providerCallRepository.find({
      where: {
        threadId: options.thread,
        ...(isDefined(options.turn) && { turnId: options.turn }),
      },
      order: { createdAt: 'ASC' },
    });

    const calls: ProviderCallRecordingEntry[] = [];
    let missingResponses = 0;

    for (const row of rows) {
      const entry = await this.toEntry(row);

      if (entry === undefined) {
        missingResponses += 1;
        continue;
      }

      calls.push(entry);
    }

    const recording: ProviderCallRecording = {
      version: 1,
      scenarioId: options.scenario,
      recordedAt: new Date().toISOString(),
      threadId: options.thread,
      calls,
    };

    await writeFile(options.out, JSON.stringify(recording, null, 2));

    this.logger.log(
      `Wrote ${calls.length} of ${rows.length} provider calls to ${options.out}` +
        (missingResponses > 0
          ? `; ${missingResponses} had no stored response and will miss on replay`
          : ''),
    );
  }

  private async toEntry(
    row: ProviderCallEntity,
  ): Promise<ProviderCallRecordingEntry | undefined> {
    const base = {
      provider: row.provider,
      operation: row.operation,
      cacheKey: row.cacheKey,
      request: row.request as Record<string, unknown> | null,
    };

    if (!row.success) {
      return { ...base, errorMessage: row.errorMessage ?? 'failed' };
    }

    const response = await this.readResponse(row.responseLocation);

    return response === undefined ? undefined : { ...base, response };
  }

  // Both the provider query cache and the call log store an envelope whose
  // value is the provider's answer
  private async readResponse(
    location: string | null,
  ): Promise<unknown | undefined> {
    if (!isDefined(location) || !isDefined(this.fileStorageService)) {
      return undefined;
    }

    const separator = location.lastIndexOf('/');

    try {
      const stream = await this.fileStorageService.read({
        folderPath: location.slice(0, separator),
        filename: location.slice(separator + 1),
      });
      const envelope = JSON.parse(await streamToString(stream)) as {
        value?: unknown;
      };

      return envelope.value;
    } catch (error) {
      this.logger.warn(
        `Could not read ${location}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }
}
