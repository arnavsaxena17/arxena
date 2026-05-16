import {
    buildDefaultPublishSlug,
    validatePublishSlug,
} from '../org-chart-published-slug.util';

describe('org-chart-published-slug.util', () => {
  it('buildDefaultPublishSlug uses company name', () => {
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
  });
});
