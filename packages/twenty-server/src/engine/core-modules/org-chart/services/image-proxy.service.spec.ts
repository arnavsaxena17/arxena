import { ImageProxyService } from './image-proxy.service';

describe('ImageProxyService', () => {
  let service: ImageProxyService;

  beforeEach(() => {
    service = new ImageProxyService();
  });

  it('builds deterministic proxy URLs for allowed LinkedIn and TheOrg images', async () => {
    const linkedInUrl =
      'https://media.licdn.com/dms/image/v2/test-profile-photo?e=123&v=beta&t=abc';
    const theOrgUrl =
      'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg';

    const linkedInProxyUrl =
      await service.buildProxyUrl(linkedInUrl);
    const theOrgProxyUrl =
      await service.buildProxyUrl(theOrgUrl);

    expect(linkedInProxyUrl).toMatch(
      /^\/org-chart\/image-proxy\/images-2\//,
    );
    expect(theOrgProxyUrl).toBe(
      '/org-chart/image-proxy/images-1/e8fe8757-d356-4e6f-b055-c494040c2315/medium/jpg',
    );
    expect(linkedInProxyUrl).not.toContain('https://media.licdn.com');
    expect(linkedInProxyUrl).not.toContain('media.licdn.com');
    expect(theOrgProxyUrl).not.toContain('theorg');
  });

  it('reconstructs deterministic proxy paths back to upstream URLs', () => {
    expect(
      service.resolveUrlFromDeterministicPath(
        'images-1',
        'e8fe8757-d356-4e6f-b055-c494040c2315',
        'medium',
        'jpg',
      ),
    ).toBe(
      'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg',
    );

    const encodedPath = Buffer.from(
      '/dms/image/v2/test-profile-photo?e=123&v=beta&t=abc',
      'utf8',
    ).toString('base64url');
    const encodedHost = Buffer.from(
      'media.licdn.com',
      'utf8',
    ).toString('base64url');

    expect(
      service.resolveUrlFromDeterministicPath(
        'images-2',
        encodedHost,
        encodedPath,
      ),
    ).toBe(
      'https://media.licdn.com/dms/image/v2/test-profile-photo?e=123&v=beta&t=abc',
    );
  });

  it('leaves disallowed URLs unchanged', async () => {
    const rawUrl = 'https://example.com/avatar.jpg';

    await expect(service.buildProxyUrl(rawUrl)).resolves.toBe(rawUrl);
  });

  it('rewrites nested image fields and orgchart JSON strings', async () => {
    const payload = {
      items: [
        {
          profile_picture_url: 'https://media.licdn.com/dms/image/v2/test',
        },
      ],
      orgchart: JSON.stringify([
        {
          candidates: [
            {
              image: 'https://images.theorg.com/member.jpg',
            },
          ],
        },
      ]),
    };

    const result = await service.proxyImagesInPayload(payload);

    expect(result.items[0].profile_picture_url).toMatch(
      /^\/org-chart\/image-proxy\/images-2\//,
    );
    expect(JSON.parse(result.orgchart as string)).toEqual([
      {
        candidates: [
          {
            image:
              '/org-chart/image-proxy/images-1/member/original/jpg',
          },
        ],
      },
    ]);
  });

  it('rewrites orgchart when it is already a parsed array', async () => {
    const payload = {
      orgchart: [
        {
          candidates: [
            {
              image: 'https://images.theorg.com/member.jpg',
            },
          ],
        },
      ],
    };

    const result = await service.proxyImagesInPayload(payload);

    expect(Array.isArray(result.orgchart)).toBe(true);
    expect(
      (result.orgchart as { candidates: { image: string }[] }[])[0]
        .candidates[0].image,
    ).toBe('/org-chart/image-proxy/images-1/member/original/jpg');
  });
});
