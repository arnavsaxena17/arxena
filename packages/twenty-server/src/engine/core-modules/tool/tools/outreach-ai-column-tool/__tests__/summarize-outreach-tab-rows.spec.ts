import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { summarizeOutreachTabRows } from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tools';

const row = (
  id: string,
  otherFields: Record<string, unknown>,
): OutreachTabRow =>
  ({
    id,
    source: 'ephemeral',
    name: `Company ${id}`,
    otherFields,
  }) as OutreachTabRow;

describe('summarizeOutreachTabRows', () => {
  const rows = [
    row('a', {
      brandCategory: 'Food',
      employeesOnLinkedin: 100,
      inIndia: true,
    }),
    row('b', {
      brandCategory: 'Food',
      employeesOnLinkedin: 300,
      inIndia: true,
    }),
    row('c', {
      brandCategory: 'Apparel',
      employeesOnLinkedin: 50,
      inIndia: false,
    }),
    row('d', { employeesOnLinkedin: 800 }),
  ];

  it('should count values of label and yes/no columns over all rows', () => {
    const summary = summarizeOutreachTabRows(rows, ['brandCategory', 'inIndia']);

    expect(summary.brandCategory).toMatchObject({
      filled: 3,
      empty: 1,
      counts: { Food: 2, Apparel: 1 },
    });
    expect(summary.inIndia).toMatchObject({
      counts: { true: 2, false: 1 },
    });
  });

  it('should give a distribution for number columns so a cut-off can be chosen', () => {
    const summary = summarizeOutreachTabRows(rows, ['employeesOnLinkedin']);

    expect(summary.employeesOnLinkedin).toMatchObject({
      filled: 4,
      min: 50,
      max: 800,
    });
  });
});
