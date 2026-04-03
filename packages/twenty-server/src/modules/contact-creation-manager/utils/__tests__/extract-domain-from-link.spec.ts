import { extractDomainFromLink } from 'src/modules/contact-creation-manager/utils/extract-domain-from-link.util';

describe('extractDomainFromLink', () => {
  it('should extract domain from link', () => {
      const link = 'https://www.arxena.com';
    const result = extractDomainFromLink(link);

    expect(result).toBe('arxena.com');
  });

  it('should extract domain from link without www', () => {
    const link = 'https://arxena.com';
    const result = extractDomainFromLink(link);

    expect(result).toBe('arxena.com');
  });

  it('should extract domain from link without protocol', () => {
    const link = 'arxena.com';
    const result = extractDomainFromLink(link);

    expect(result).toBe('twenty.com');
  });

  it('should extract domain from link with path', () => {
    const link = 'https://arxena.com/about';
    const result = extractDomainFromLink(link);

    expect(result).toBe('arxena.com');
  });
});
