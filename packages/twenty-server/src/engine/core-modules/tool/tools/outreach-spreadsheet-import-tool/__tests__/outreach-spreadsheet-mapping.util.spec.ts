import { utils, write } from 'xlsx';

import {
  applySpreadsheetMapping,
  suggestSpreadsheetMapping,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-mapping.util';
import { parseSpreadsheetBuffer } from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-parser.util';

const buildWideSheet = (): Buffer => {
  const sheet = utils.aoa_to_sheet([
    [
      '#',
      'Brand',
      'Operating company name',
      'Revenue (₹ cr)',
      'Contact 1 name',
      'Contact 1 title',
      'Contact 1 LinkedIn',
      'Contact 2 name',
      'Contact 2 title',
      'Contact 2 LinkedIn',
    ],
    [1, 'A2B', 'Adyar Ananda Bhavan Pvt Ltd', 1487.5, 'Raja', 'MD', 'Search LinkedIn', 'Venkat', 'Director', 'Search LinkedIn'],
    [2, 'Anjappar', '', '', 'Not found', '', '', '', '', ''],
  ]);

  sheet.G2.l = { Target: 'https://www.linkedin.com/search/results/people/?keywords=Raja' };

  const workbook = utils.book_new();

  utils.book_append_sheet(workbook, sheet, 'Lead List');

  return write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

describe('spreadsheet import mapping', () => {
  it('should unpivot Contact N column sets into people and keep the brand as company name', () => {
    const { headers, rows } = parseSpreadsheetBuffer(buildWideSheet());
    const mapping = suggestSpreadsheetMapping(headers);

    expect(mapping.company?.name).toBe('Brand');
    expect(mapping.company?.fallbackName).toBe('Operating company name');
    expect(mapping.peopleGroups).toHaveLength(2);

    const imported = applySpreadsheetMapping(headers, rows, mapping);

    expect(imported.companies.map((company) => company.name)).toEqual([
      'A2B',
      'Anjappar',
    ]);
    expect(imported.people.map((person) => person.name)).toEqual([
      'Raja',
      'Venkat',
    ]);
    expect(imported.skippedPeopleCount).toBe(2);
  });

  it('should use the cell hyperlink as the LinkedIn URL', () => {
    const { headers, rows } = parseSpreadsheetBuffer(buildWideSheet());
    const imported = applySpreadsheetMapping(
      headers,
      rows,
      suggestSpreadsheetMapping(headers),
    );

    expect(imported.people[0].linkedinUrl).toBe(
      'https://www.linkedin.com/search/results/people/?keywords=Raja',
    );
    expect(imported.people[1].linkedinUrl).toBe('');
  });

  it('should keep unmapped columns as extra columns with a proposed key', () => {
    const { headers, rows } = parseSpreadsheetBuffer(buildWideSheet());
    const mapping = suggestSpreadsheetMapping(headers);
    const revenue = mapping.company?.extra.find(
      (column) => column.header === 'Revenue (₹ cr)',
    );

    expect(revenue?.key).toBe('revenue_cr');
    expect(
      mapping.company?.extra.some(
        (column) => column.header === 'Operating company name',
      ),
    ).toBe(true);

    const imported = applySpreadsheetMapping(
      headers,
      rows,
      {
        ...mapping,
        company: {
          ...mapping.company!,
          extra: [{ ...revenue!, type: 'number' }],
        },
      },
    );

    expect(imported.companies[0].extra).toEqual({ revenue_cr: 1487.5 });
  });
});
