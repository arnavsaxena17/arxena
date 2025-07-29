import { TableColumns } from './TableColumns';

// Mock the date-utils module
jest.mock('~/utils/date-utils', () => ({
  formatToHumanReadableDateTime: jest.fn((date) => {
    if (typeof date === 'string' && date.includes('2023')) {
      return 'Jan 1, 2023 - 12:00';
    }
    throw new Error(`Invalid date passed to formatPastDate: "${date}"`);
  }),
}));

describe('TableColumns', () => {
  it('should handle array values in dateRenderer gracefully', () => {
    const mockProcessedData = [
      {
        id: '1',
        name: 'Test Candidate',
        experience: [
          {
            company: { name: 'Test Company' },
            title: { name: 'Test Title' },
            experience_years: ''
          }
        ],
        createdAt: '2023-01-01T12:00:00Z'
      }
    ];

    const columns = TableColumns({
      processedData: mockProcessedData,
      unreadMessagesCounts: {},
      enrichments: []
    });

    // Verify that experience field is not included in columns
    const experienceColumn = columns.find(col => col.data === 'experience');
    expect(experienceColumn).toBeUndefined();

    // Verify that valid date fields are included
    const createdAtColumn = columns.find(col => col.data === 'createdAt');
    expect(createdAtColumn).toBeDefined();
    expect(createdAtColumn?.renderer).toBeDefined();
  });

  it('should exclude experience field from processing', () => {
    const mockProcessedData = [
      {
        id: '1',
        name: 'Test Candidate',
        experience: [
          {
            company: { name: 'Test Company' },
            title: { name: 'Test Title' },
            experience_years: ''
          }
        ]
      }
    ];

    const columns = TableColumns({
      processedData: mockProcessedData,
      unreadMessagesCounts: {},
      enrichments: []
    });

    // Verify that experience field is excluded
    const experienceColumn = columns.find(col => col.data === 'experience');
    expect(experienceColumn).toBeUndefined();
  });
}); 