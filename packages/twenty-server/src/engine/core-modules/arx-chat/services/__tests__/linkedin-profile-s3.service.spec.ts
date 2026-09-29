import { LinkedinProfileS3Service } from 'src/engine/core-modules/arx-chat/services/linkedin-profile-s3.service';

describe('LinkedinProfileS3Service', () => {
  const fileStorageService = {
    read: jest.fn(),
    write: jest.fn(),
  };

  let service: LinkedinProfileS3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LinkedinProfileS3Service(fileStorageService as never);
  });

  it('returns null when S3 read fails', async () => {
    fileStorageService.read.mockRejectedValue(new Error('not found'));

    const result = await service.getLinkedinUserProfile('arnavsaxena');

    expect(result).toBeNull();
    console.log('LinkedinProfileS3Service: S3 miss returns null');
  });

  const mockEnvelopeStream = (envelope: {
    fetchedAt: string;
    profile: Record<string, unknown>;
  }) => {
    fileStorageService.read.mockResolvedValue({
      on: jest.fn((event: string, handler: (chunk?: Buffer) => void) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify(envelope)));
        }
        if (event === 'end') {
          handler();
        }
      }),
    });
  };

  it('returns profile when S3 envelope is fresh', async () => {
    const profile = { public_identifier: 'arnavsaxena', first_name: 'Arnav' };

    mockEnvelopeStream({
      fetchedAt: new Date().toISOString(),
      profile,
    });

    const result = await service.getLinkedinUserProfile('arnavsaxena');

    expect(result).toEqual(profile);
  });

  it('returns profile older than one year by default (no S3 age expiry)', async () => {
    const profile = { public_identifier: 'arnavsaxena', first_name: 'Arnav' };
    const twoYearsAgo = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    mockEnvelopeStream({ fetchedAt: twoYearsAgo, profile });

    await expect(
      service.getLinkedinUserProfile('arnavsaxena'),
    ).resolves.toEqual(profile);
  });

  it('honors an explicit maxAgeMs when callers want freshness', async () => {
    const profile = { public_identifier: 'arnavsaxena', first_name: 'Arnav' };
    const twoYearsAgo = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    mockEnvelopeStream({ fetchedAt: twoYearsAgo, profile });

    await expect(
      service.getLinkedinUserProfile('arnavsaxena', 365 * 24 * 60 * 60 * 1000),
    ).resolves.toBeNull();
  });

  it('writes posts envelope to linkedin-profiles/users folder', async () => {
    const posts = { items: [{ id: '1', text: 'hello' }] };

    await service.saveLinkedinUserPosts('arnavsaxena', posts);

    expect(fileStorageService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'linkedin-profiles/users/arnavsaxena',
        name: 'posts.json',
        mimeType: 'application/json',
      }),
    );
  });
});
