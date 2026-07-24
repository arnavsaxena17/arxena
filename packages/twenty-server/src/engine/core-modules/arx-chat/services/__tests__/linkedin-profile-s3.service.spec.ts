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

  it('returns profile when S3 envelope is fresh', async () => {
    const profile = { public_identifier: 'arnavsaxena', first_name: 'Arnav' };
    const envelope = {
      fetchedAt: new Date().toISOString(),
      profile,
    };

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

    const result = await service.getLinkedinUserProfile('arnavsaxena');

    expect(result).toEqual(profile);
    console.log('LinkedinProfileS3Service: fresh S3 hit returns profile');
  });

  it('writes profile envelope to linkedin-profiles/users folder', async () => {
    const profile = { public_identifier: 'arnavsaxena' };

    await service.saveLinkedinUserProfile('arnavsaxena', profile);

    expect(fileStorageService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'linkedin-profiles/users/arnavsaxena',
        name: 'profile.json',
        mimeType: 'application/json',
      }),
    );
    console.log('LinkedinProfileS3Service: save writes to linkedin-profiles/users');
  });
});
