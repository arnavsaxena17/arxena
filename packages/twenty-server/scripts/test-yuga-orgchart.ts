import 'reflect-metadata';

import { readFile } from 'fs/promises';
import * as path from 'path';

import { PythonOrgChartService } from '../src/engine/core-modules/org-chart/services/python-org-chart.service';

async function main() {
  const service = new PythonOrgChartService();

  // Build org chart via the Python implementation (BooleanStandardize + OrgStructure)
  const built = await service.buildYugaLabsOrgChartFromPython();

  // Resolve arxena-site root in the same way as OrgChartService.getManualOrgChart
  const cwd = process.cwd();
  let arxenaSiteRoot: string;

  if (
    path.basename(cwd) === 'twenty-server' &&
    path.basename(path.dirname(cwd)) === 'packages'
  ) {
    // /.../arx/arxena/packages/twenty-server -> /.../arx/arxena-site
    // Go up three levels to the common /.../arx directory, then into arxena-site.
    arxenaSiteRoot = path.resolve(cwd, '..', '..', '..', 'arxena-site');
  } else if (path.basename(cwd) === 'packages') {
    // /.../arx/arxena/packages -> /.../arx/arxena-site
    arxenaSiteRoot = path.resolve(cwd, '..', 'arxena-site');
  } else {
    // /.../arx/arxena -> /.../arx/arxena-site
    arxenaSiteRoot = path.resolve(cwd, '..', 'arxena-site');
  }

  const expectedPath = path.resolve(
    arxenaSiteRoot,
    'arxenas3/static/yuga_labs_all_org_chart_assist.json',
  );
  const expectedRaw = await readFile(expectedPath, 'utf8');
  const expected = JSON.parse(expectedRaw) as Record<string, unknown>;

  const builtKeys = Object.keys(built).sort();
  const expectedKeys = Object.keys(expected).sort();

  // Log a small comparison summary instead of a huge diff
  // The main invariants we care about are the presence of core keys and
  // similarity in overall sizes.
  // eslint-disable-next-line no-console
  console.log('Built keys     :', builtKeys);
  // eslint-disable-next-line no-console
  console.log('Expected keys  :', expectedKeys);

  const builtCountOrg = (built as { count_org?: unknown }).count_org;
  const expectedCountOrg = (expected as { count_org?: unknown }).count_org;
  // eslint-disable-next-line no-console
  console.log('Built count_org    :', builtCountOrg);
  // eslint-disable-next-line no-console
  console.log('Expected count_org :', expectedCountOrg);

  const builtFunctions = (built as { functions?: unknown }).functions;
  const expectedFunctions = (expected as { functions?: unknown }).functions;
  // eslint-disable-next-line no-console
  console.log('Built functions len    :', Array.isArray(builtFunctions) ? builtFunctions.length : String(builtFunctions).length);
  // eslint-disable-next-line no-console
  console.log('Expected functions len :', Array.isArray(expectedFunctions) ? expectedFunctions.length : String(expectedFunctions).length);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Yuga Labs org chart test failed:', error);
  process.exit(1);
});

