import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import type { OrgChartData } from 'twenty-shared';

type PythonStdResult = {
  input_title: string;
  std_functions: string[];
  std_grades: string[];
  std_levels: string[];
};

@Injectable()
export class PythonOrgChartService {
  private readonly logger = new Logger(PythonOrgChartService.name);

  /**
   * Resolve the absolute path to the arxena-site arxenas3/model_arxena directory.
   *
   * We support being run from:
   * - /.../arx/arxena
   * - /.../arx/arxena/packages
   * - /.../arx/arxena/packages/twenty-server
   */
  private resolveModelArxenaRoot(): string {
    const cwd = process.cwd();
    const cwdBase = path.basename(cwd);
    const parentBase = path.basename(path.dirname(cwd));

    if (cwdBase === 'twenty-server' && parentBase === 'packages') {
      // /.../arx/arxena/packages/twenty-server -> /.../arx/arxena-site/arxenas3/model_arxena
      // Go up three levels to the common /.../arx directory, then into arxena-site.
      return path.resolve(
        cwd,
        '..',
        '..',
        '..',
        'arxena-site',
        'arxenas3',
        'model_arxena',
      );
    }

    if (cwdBase === 'packages') {
      // /.../arx/arxena/packages -> /.../arx/arxena-site/arxenas3/model_arxena
      return path.resolve(cwd, '..', 'arxena-site', 'arxenas3', 'model_arxena');
    }

    // Default: assume cwd is /.../arx/arxena
    return path.resolve(cwd, '..', 'arxena-site', 'arxenas3', 'model_arxena');
  }

  private getPythonCliPath(): string {
    const modelRoot = this.resolveModelArxenaRoot();
    return path.resolve(modelRoot, 'boolean_orgchart_cli.py');
  }

  private runPython<T = unknown>(args: string[], stdinPayload?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const scriptPath = this.getPythonCliPath();
      const pythonArgs = [scriptPath, ...args];

      // Prefer python3 explicitly since many environments no longer ship a bare `python` binary.
      const pythonExecutable = process.env.PYTHON_EXECUTABLE ?? 'python3';

      this.logger.log(
        `Spawning ${pythonExecutable} ${pythonArgs.join(' ')}`,
      );

      const child = spawn(pythonExecutable, pythonArgs, {
        cwd: this.resolveModelArxenaRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      const timeoutMs = Number(process.env.PYTHON_ORGCHART_TIMEOUT_MS ?? 300000);
      const timeoutHandle =
        timeoutMs > 0
          ? setTimeout(() => {
              this.logger.error(
                `Python orgchart process timed out after ${timeoutMs}ms. Killing child process. stderr=${stderr}`,
              );
              try {
                child.kill('SIGKILL');
              } catch {
                // ignore kill errors
              }
              reject(
                new Error(
                  `python boolean_orgchart_cli.py timed out after ${timeoutMs}ms`,
                ),
              );
            }, timeoutMs)
          : null;

      child.on('error', (err) => {
        this.logger.error('Failed to spawn python process', err);
        reject(err);
      });

      child.on('close', (code) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (code !== 0) {
          this.logger.error(
            `Python exited with code ${code}. stderr=${stderr}`,
          );
          reject(
            new Error(
              `python boolean_orgchart_cli.py failed with code ${code}: ${stderr}`,
            ),
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as T;
          resolve(parsed);
        } catch (err) {
          this.logger.error(
            `Failed to parse python JSON output: ${stdout}`,
            err as Error,
          );
          reject(err);
        }
      });

      if (stdinPayload !== undefined) {
        const toWrite = JSON.stringify(stdinPayload);
        child.stdin.write(toWrite);
      }
      child.stdin.end();
    });
  }

  /**
   * Convenience wrapper to standardize a single job title using the
   * canonical Python BooleanStandardize implementation.
   */
  async standardizeTitle(title: string): Promise<PythonStdResult> {
    const result = await this.runPython<PythonStdResult>([
      'standardize',
      title,
    ]);
    return result;
  }

  /**
   * Call arxena-site POST /api/orgchart/build when ARXENA_SITE_ORGCHART_URL is set.
   * Avoids subprocess/cwd/path issues and uses the same timeout as the CLI path.
   */
  private getOrgChartBuildEndpoint(): string {
    const baseUrl = (
      process.env.ARXENA_SITE_ORGCHART_URL ||
      process.env.ARXENA_SITE_URL ||
      'http://127.0.0.1:8000'
    )
      .replace(/\/api\/orgchart\/build\/?$/, '')
      .replace(/\/+$/, '');

    return `${baseUrl}/api/orgchart/build`;
  }

  private async callOrgChartBuildUrl(payload: {
    people: Record<string, unknown>[];
    job_name: string;
    job_id: string;
  }): Promise<OrgChartData> {
    const baseUrl = this.getOrgChartBuildEndpoint();
    const url = baseUrl;
    const timeoutMs = Number(process.env.PYTHON_ORGCHART_TIMEOUT_MS ?? 300000);

    this.logger.log(`Calling org chart build at ${url} (timeout ${timeoutMs}ms)`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `arxena-site orgchart build returned ${response.status}: ${text}`,
        );
      }
      const result = (await response.json()) as Record<string, unknown>;
      if (result && typeof (result as { error?: string }).error === 'string') {
        throw new Error((result as { error: string }).error);
      }
      return result as OrgChartData;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(
            `arxena-site orgchart build timed out after ${timeoutMs}ms`,
          );
        }
        throw err;
      }
      throw err;
    }
  }

  /**
   * Use the Python OrgStructure.create_org_charts_json_from_std_people_array
   * to generate an org chart object from the "all standardized" people array.
   *
   * By default calls the arxena-site REST API (ARXENA_SITE_ORGCHART_URL or
   * http://localhost:5050/api/orgchart/build). Set USE_PYTHON_CLI_ORGCHART=1
   * or ARXENA_SITE_ORGCHART_URL="" to spawn the CLI instead.
   *
   * The expected person objects and semantics match the Python
   * implementation in org_chart_list.py.
   */
  async createOrgChartFromStandardizedPeople(input: {
    people: Record<string, unknown>[];
    jobName?: string;
    jobId?: string;
    functionRoot?: string;
  }): Promise<OrgChartData> {
    const payload = {
      people: input.people,
      job_name: input.jobName ?? '',
      job_id: input.jobId ?? '',
      // Optional hint to Python about which function-root
      // subset is desired (e.g. "human resources").
      function_root: input.functionRoot ?? null,
    };

    const useCli =
      process.env.USE_PYTHON_CLI_ORGCHART === '1' ||
      process.env.USE_PYTHON_CLI_ORGCHART === 'true' ||
      process.env.ARXENA_SITE_ORGCHART_URL === '';

    this.logger.log(`Using ${useCli ? 'CLI' : 'HTTP'} orgchart build`);
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);
    if (useCli) {
      return this.runPython<OrgChartData>(['orgchart'], payload);
    }

    return this.callOrgChartBuildUrl(payload);
  }

  /**
   * Dev/test helper mirroring the Yuga Labs sanity-check:
   *   - call the dedicated python CLI subcommand that:
   *       * loads all_standardized_yuga_cs.json
   *       * runs OrgStructure.create_org_charts_json_from_std_people_array
   *   - return the raw org chart object
   *
   * The caller can then compare this against the static
   * yuga_labs_all_org_chart_assist.json contents.
   */
  async buildYugaLabsOrgChartFromPython(): Promise<OrgChartData> {
    const result = await this.runPython<OrgChartData>([
      'orgchart-yuga',
    ]);
    return result;
  }
}
