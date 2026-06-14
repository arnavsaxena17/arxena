import { readFileSync } from 'fs';
import * as path from 'path';

import {
    applyBlankOrgChartSizeForExpectedHeadcount,
    applyBlankOrgChartSubsetFilter,
    expectedEmployeeCountToMaxBlankNodes,
    isBlankSubsetRequest,
} from './blank-org-chart-subset.util';

type BlankNodeRow = { key: number; parent: number | string };

function buildChildrenMap(nodes: BlankNodeRow[]): Map<number, number[]> {
  const children = new Map<number, number[]>();
  for (const n of nodes) {
    const p = n.parent;
    if (p === '' || p === null || p === undefined) {
      continue;
    }
    const pk = typeof p === 'number' ? p : Number(p);
    if (!children.has(pk)) {
      children.set(pk, []);
    }
    children.get(pk)!.push(n.key);
  }
  return children;
}

function assertBlankRootShapeConstraints(nodes: BlankNodeRow[]): void {
  const root = nodes.find(
    (n) => n.parent === '' || n.parent === null || n.parent === undefined,
  );
  if (!root) {
    return;
  }
  const children = buildChildrenMap(nodes);
  const direct = children.get(root.key) ?? [];
  expect(direct.length).toBeLessThanOrEqual(6);

  let leafDirect = 0;
  for (const k of direct) {
    if ((children.get(k)?.length ?? 0) === 0) {
      leafDirect += 1;
    }
  }
  expect(leafDirect).toBeLessThanOrEqual(2);

  for (const k of direct) {
    const subs = children.get(k) ?? [];
    expect(subs.length).toBeLessThanOrEqual(6);
  }
}

describe('blank-org-chart-subset.util', () => {
  const blankPath = path.join(
    __dirname,
    '..',
    'static',
    'blank_org_chart_emp_obj.json',
  );

  it('isBlankSubsetRequest is false for global fullcompany', () => {
    expect(isBlankSubsetRequest({ country: 'global', functionRoot: '' })).toBe(
      false,
    );
    expect(
      isBlankSubsetRequest({ country: 'global', functionRoot: 'fullcompany' }),
    ).toBe(false);
  });

  it('isBlankSubsetRequest is true for country or function subset', () => {
    expect(isBlankSubsetRequest({ country: 'India', functionRoot: '' })).toBe(
      true,
    );
    expect(
      isBlankSubsetRequest({ country: 'global', functionRoot: 'engineering' }),
    ).toBe(true);
  });

  it('applyBlankOrgChartSubsetFilter trims engineering to fewer nodes than full blank', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const full = JSON.parse(parsed.orgchart as string) as unknown[];
    const filtered = applyBlankOrgChartSubsetFilter(parsed, {
      country: 'global',
      functionRoot: 'engineering',
    });
    const next = JSON.parse(filtered.orgchart as string) as unknown[];
    console.log(
      `blank subset engineering: full=${full.length} filtered=${next.length}`,
    );
    expect(next.length).toBeGreaterThan(0);
    expect(next.length).toBeLessThan(full.length);
    assertBlankRootShapeConstraints(next as BlankNodeRow[]);
  });

  it('applyBlankOrgChartSubsetFilter country-only BFS is smaller than full blank', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const full = JSON.parse(parsed.orgchart as string) as unknown[];
    const filtered = applyBlankOrgChartSubsetFilter(parsed, {
      country: 'Germany',
      functionRoot: 'fullcompany',
    });
    const next = JSON.parse(filtered.orgchart as string) as unknown[];
    const first = next[0] as { candidates?: { location_country?: string }[] };
    console.log(
      `blank subset country-only: full=${full.length} filtered=${next.length}`,
    );
    expect(next.length).toBeLessThanOrEqual(72);
    expect(next.length).toBeLessThan(full.length);
    expect(first.candidates?.[0]?.location_country).toBe('Germany');
    assertBlankRootShapeConstraints(next as BlankNodeRow[]);
  });

  it('expectedEmployeeCountToMaxBlankNodes maps tiers', () => {
    expect(expectedEmployeeCountToMaxBlankNodes(undefined)).toBe(120);
    expect(expectedEmployeeCountToMaxBlankNodes(30)).toBe(18);
    expect(expectedEmployeeCountToMaxBlankNodes(150)).toBe(32);
    expect(expectedEmployeeCountToMaxBlankNodes(800)).toBe(56);
    expect(expectedEmployeeCountToMaxBlankNodes(40000)).toBe(140);
    expect(expectedEmployeeCountToMaxBlankNodes(80000)).toBe(220);
  });

  it('applyBlankOrgChartSizeForExpectedHeadcount shrinks full blank for small companies', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const full = JSON.parse(parsed.orgchart as string) as unknown[];
    const sized = applyBlankOrgChartSizeForExpectedHeadcount(parsed, 40);
    const next = JSON.parse(sized.orgchart as string) as unknown[];
    console.log(
      `blank size by headcount: full=${full.length} sized=${next.length}`,
    );
    expect(next.length).toBeLessThan(full.length);
    expect(next.length).toBeLessThanOrEqual(18);
    assertBlankRootShapeConstraints(next as BlankNodeRow[]);
  });

  it('applyBlankOrgChartSizeForExpectedHeadcount enforces root shape for large headcount', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sized = applyBlankOrgChartSizeForExpectedHeadcount(parsed, 40000);
    const next = JSON.parse(sized.orgchart as string) as BlankNodeRow[];
    assertBlankRootShapeConstraints(next);
    expect(next.length).toBeLessThanOrEqual(
      expectedEmployeeCountToMaxBlankNodes(40000),
    );
  });

  it('applyBlankOrgChartSizeForExpectedHeadcount prefers HR and technology over teacher leadership', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sized = applyBlankOrgChartSizeForExpectedHeadcount(parsed, 40000);
    const next = JSON.parse(sized.orgchart as string) as Array<{
      key: number;
      parent: number | string;
      std_function_root?: string;
      std_function?: string;
      headline?: string;
    }>;

    const root = next.find(
      (n) => n.parent === '' || n.parent === null || n.parent === undefined,
    );
    expect(root).toBeDefined();

    const direct = next.filter((n) => n.parent === root?.key);
    const directFunctionRoots = direct.map((n) =>
      String(n.std_function_root ?? '').toLowerCase(),
    );

    console.log(
      `blank root direct reports: ${direct
        .map((n) => `${n.std_function_root}/${n.std_function}`)
        .join(', ')}`,
    );

    expect(directFunctionRoots).toContain('human resources');
    expect(directFunctionRoots).toContain('technology');
    expect(directFunctionRoots).toContain('finance');
    expect(directFunctionRoots).toContain('sales');
    expect(directFunctionRoots).not.toContain('education');
    expect(
      direct.some((n) =>
        String(n.headline ?? '').toLowerCase().includes('teacher leadership'),
      ),
    ).toBe(false);
  });

  it('applyBlankOrgChartSizeForExpectedHeadcount adds manager chains for HR, finance, sales, manufacturing, and technology', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sized = applyBlankOrgChartSizeForExpectedHeadcount(parsed, 40000);
    const next = JSON.parse(sized.orgchart as string) as Array<{
      std_function_root?: string;
      std_function?: string;
      std_grade?: string;
      headline?: string;
    }>;

    const managerHeadlines = next
      .filter(
        (node) =>
          node.std_grade === 'mid' ||
          String(node.headline ?? '').toUpperCase().includes('MANAGERS'),
      )
      .map((node) =>
        `${String(node.std_function_root ?? '').toLowerCase()}/${String(
          node.std_function ?? '',
        ).toLowerCase()}:${String(node.headline ?? '')}`,
      );

    console.log(`blank manager nodes: ${managerHeadlines.join(' | ')}`);

    const hasManagerFor = (matcher: (node: (typeof next)[number]) => boolean) =>
      next.some(
        (node) =>
          (node.std_grade === 'mid' ||
            String(node.headline ?? '').toUpperCase().includes('MANAGERS')) &&
          matcher(node),
      );

    expect(
      hasManagerFor(
        (node) =>
          String(node.std_function_root ?? '').toLowerCase() ===
          'human resources',
      ),
    ).toBe(true);
    expect(
      hasManagerFor(
        (node) => String(node.std_function_root ?? '').toLowerCase() === 'finance',
      ),
    ).toBe(true);
    expect(
      hasManagerFor(
        (node) => String(node.std_function_root ?? '').toLowerCase() === 'sales',
      ),
    ).toBe(true);
    expect(
      hasManagerFor((node) =>
        String(node.std_function ?? '').toLowerCase().includes('manufacturing'),
      ),
    ).toBe(true);
    expect(
      hasManagerFor(
        (node) => String(node.std_function_root ?? '').toLowerCase() === 'technology',
      ),
    ).toBe(true);
  });
});
