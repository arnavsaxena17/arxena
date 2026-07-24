import {
    buildDefaultPublishSlug,
    resolveBrandPublishSlug,
    validatePublishSlug,
} from './orgChartPublishedSlug';

describe('orgChartPublishedSlug', () => {
  it('resolveBrandPublishSlug strips org chart title suffix', () => {
    expect(
      resolveBrandPublishSlug({
        companyId: 'canarys',
        companyName: 'canarys — Org chart',
      }),
    ).toBe('canarys');
  });

  it('validatePublishSlug rejects slug with em dash from raw title', () => {
    expect(validatePublishSlug('canarys-—-org-chart').ok).toBe(false);
  });

  it('buildDefaultPublishSlug uses sanitized company name', () => {
    expect(
      buildDefaultPublishSlug({
        companyId: 'acme_inc',
        companyName: 'Acme Corp',
      }),
    ).toBe('acme-corp');
  });

  it('buildDefaultPublishSlug falls back to company id', () => {
    expect(buildDefaultPublishSlug({ companyId: 'acme_inc' })).toBe('acme-inc');
  });

  it('validatePublishSlug accepts brand slugs', () => {
    expect(validatePublishSlug('acme-corp')).toEqual({
      ok: true,
      slug: 'acme-corp',
    });
  });

  it('validatePublishSlug rejects reserved slugs', () => {
    expect(validatePublishSlug('share').ok).toBe(false);
  });

  it('validatePublishSlug rejects invalid characters', () => {
    expect(validatePublishSlug('Acme_Corp').ok).toBe(false);
    expect(validatePublishSlug('canarys-—-org-chart').ok).toBe(false);
  });
});
