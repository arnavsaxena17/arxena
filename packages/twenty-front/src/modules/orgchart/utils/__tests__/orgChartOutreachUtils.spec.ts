import type { OrgChartNodeData } from 'twenty-shared/utils';

import { contextResultItemFromNodePersonSlot } from '../orgChartUtils';

describe('contextResultItemFromNodePersonSlot', () => {
  it('maps name title linkedin email phone for slot', () => {
    console.log('contextResultItemFromNodePersonSlot: building node');
    const node = {
      key: 42,
      headline: 'VP',
      name_0: 'Jane Doe',
      title_0: 'Engineer',
      linkedin_url_0: 'https://www.linkedin.com/in/janedoe',
      email_0: 'jane@example.com',
      phone_0: '+1 555 0100',
    } as OrgChartNodeData;

    const item = contextResultItemFromNodePersonSlot(node, 0, 'Acme');
    console.log('contextResultItemFromNodePersonSlot: item', item);
    expect(item).not.toBeNull();
    expect(item?.fullName).toBe('Jane Doe');
    expect(item?.linkedinUrl).toContain('linkedin.com/in/janedoe');
    expect(item?.email).toBe('jane@example.com');
    expect(item?.phone).toBe('+1 555 0100');
    expect(item?.company).toBe('Acme');
  });

  it('returns null when name missing for slot', () => {
    const node = { key: 1, headline: 'X' } as OrgChartNodeData;
    expect(contextResultItemFromNodePersonSlot(node, 0)).toBeNull();
  });
});
